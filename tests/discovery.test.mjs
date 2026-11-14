import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(path, modules = {}) {
  const source = await readFile(new URL(`../src/app/core/${path}.ts`, import.meta.url), 'utf8');
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
  }).outputText)(name => {
    assert.ok(modules[name], `Unexpected import ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
const models = await load('models');
const {tasteProfile, recommendQueue, normalizeTitle, culturalCompatibility} = await load('discovery', {'./models': models});
const now = new Date(2026, 10, 13, 12).getTime();
const day = 86400000;
function entry(id, patch = {}) {
  return {id, authorId: 'ana', author: {displayName: 'Ana', photoURL: ''}, title: id,
    category: 'livro', rating: 4, quote: '', status: 'completed',
    createdAt: now - day, updatedAt: now - day, ...patch};
}
function queued(id, category, position) {return {id, title: id, category, position, createdAt: now};}

test('taste profile has honest empty values rather than fabricated ratings', () => {
  const result = tasteProfile([]);
  assert.equal(result.total, 0);
  assert.equal(result.completed, 0);
  assert.deepEqual(result.favorites, []);
  assert.equal(result.best, null);
  assert.equal(result.quote, null);
  assert.equal(result.average, null);
});

test('taste profile counts all works but rates only completed works, including legacy records', () => {
  const legacy = entry('legacy', {status: undefined, rating: 2});
  const best = entry('best', {rating: 5, category: 'filme'});
  const entries = [legacy, best, entry('ongoing', {status: 'in_progress', rating: 1}),
    entry('paused', {status: 'paused', rating: null, category: 'jogo'})];
  const before = structuredClone(entries);
  const result = tasteProfile(entries);
  assert.equal(result.total, 4);
  assert.equal(result.completed, 2);
  assert.equal(result.average, 3.5);
  assert.equal(result.best.id, best.id);
  assert.deepEqual(result.favorites[0], {category: 'livro', count: 2});
  assert.deepEqual(entries, before, 'calculation must not mutate loaded entries');
});

test('taste profile limits favorites to three categories and breaks best-rating ties by recency', () => {
  const entries = [entry('old', {rating: 5, createdAt: now - 10 * day}),
    entry('recent', {rating: 5, createdAt: now - day, category: 'filme'}),
    entry('series', {category: 'serie'}), entry('music', {category: 'musica'})];
  const result = tasteProfile(entries);
  assert.equal(result.favorites.length, 3);
  assert.equal(new Set(result.favorites.map(item => item.category)).size, 3);
  assert.equal(result.best.id, 'recent');
});

test('latest saved nonempty quotation can come from an older work edited recently', () => {
  const result = tasteProfile([
    entry('new-work', {quote: 'Outra frase', createdAt: now - day, updatedAt: now - day}),
    entry('edited-work', {quote: 'O que ficou', createdAt: now - 60 * day, updatedAt: now}),
    entry('blank', {quote: '   ', updatedAt: now + 1}),
  ]);
  assert.equal(result.quote.id, 'edited-work');
});

test('queue recommendation follows recent completed preference and queue priority', () => {
  const queue = [queued('film', 'filme', 1), queued('book-later', 'livro', 3), queued('book-first', 'livro', 2)];
  const entries = [entry('a'), entry('b'), entry('c', {category: 'filme'}),
    ...Array.from({length: 5}, (_, i) => entry(`stale-${i}`, {category: 'jogo', createdAt: now - 40 * day}))];
  const before = structuredClone(queue);
  assert.equal(recommendQueue(entries, queue, now).id, 'book-first');
  assert.deepEqual(queue, before);
});

test('queue recommendation falls back to first priority, never invents an empty queue item', () => {
  const queue = [queued('second', 'filme', 2), queued('first', 'podcast', 1)];
  assert.equal(recommendQueue([], queue, now).id, 'first');
  assert.equal(recommendQueue([entry('book')], queue, now).id, 'first');
  assert.equal(recommendQueue([], [], now), null);
});

test('title normalization catches harmless case, spacing and Unicode composition variations', () => {
  assert.equal(normalizeTitle('  AÇÃO   Entre Amigos '), normalizeTitle('ac\u0327a\u0303o entre amigos'));
  assert.notEqual(normalizeTitle('Duna'), normalizeTitle('Duna 2'));
});

function luminance(hex) {
  const rgb = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('all category labels have AA contrast and a central icon and color identity', () => {
  assert.ok(models.CATEGORIES.some(item => item.value === 'outros'));
  for (const category of models.CATEGORIES) {
    assert.ok(category.label && category.icon);
    for (const key of ['color', 'bgColor', 'textColor']) assert.match(category[key], /^#[0-9a-f]{6}$/i);
    const values = [luminance(category.bgColor), luminance(category.textColor)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${category.label} text contrast must be AA`);
  }
});


test('profile quotation excludes spoilers even if they were saved last', () => {
  const result = tasteProfile([entry('plain', {quote: 'Sem spoiler'}),
    entry('spoiler', {quote: 'O final', updatedAt: now, containsSpoilers: true})]);
  assert.equal(result.quote.id, 'plain');
  assert.equal(tasteProfile([entry('spoiler-only', {quote: 'Final', containsSpoilers: true})]).quote, null);
});

test('best work uses completion date when recent completion belongs to an older record', () => {
  const result = tasteProfile([entry('recent-created', {rating: 5}),
    entry('recent-completed', {rating: 5, createdAt: now - 100 * day, completedAt: now})]);
  assert.equal(result.best.id, 'recent-completed');
});

test('recommendation ignores ongoing and future work and honors recent completion of an old record', () => {
  const queue = [queued('film-first', 'filme', 1), queued('book', 'livro', 2)];
  const entries = [entry('old-start', {createdAt: now - 100 * day, completedAt: now}),
    ...Array.from({length: 4}, (_, i) => entry(`ongoing-${i}`, {category: 'filme', status: 'in_progress'})),
    entry('future', {category: 'filme', completedAt: now + day})];
  assert.equal(recommendQueue(entries, queue, now).id, 'book');
});

test('cultural compatibility gives full score to identical libraries and counts shared title plus category', () => {
  const first = [entry('Ação entre amigos', {category: 'filme', rating: 5}), entry('Duna', {category: 'livro', rating: 3})];
  const second = [entry('  AÇÃO   ENTRE AMIGOS ', {category: 'filme', rating: 5}), entry('Duna', {category: 'livro', rating: 3})];
  assert.deepEqual(culturalCompatibility(first, second), {score: 100, sharedWorks: 2, sharedCategories: 2, comparableParts: 3});
});

test('cultural compatibility is symmetric and only intersects the top three categories', () => {
  const first = [entry('one', {category: 'filme'}), entry('two', {category: 'livro'}), entry('three', {category: 'jogo'}), entry('four', {category: 'serie'})];
  const second = [entry('one', {category: 'filme'}), entry('other', {category: 'podcast'}), entry('another', {category: 'musica'}), entry('last', {category: 'outros'})];
  assert.deepEqual(culturalCompatibility(first, second), culturalCompatibility(second, first));
  assert.equal(culturalCompatibility(first, second).sharedCategories, 1);
});

test('missing ratings are excluded and remaining compatibility dimensions are renormalized', () => {
  const first = [entry('same', {category: 'filme', rating: null})];
  const second = [entry('same', {category: 'filme', rating: 5})];
  const result = culturalCompatibility(first, second);
  assert.equal(result.comparableParts, 2);
  assert.equal(result.score, 100);
});

test('compatibility handles empty or unrated profiles without NaN and caps score', () => {
  assert.deepEqual(culturalCompatibility([], []), {score: 0, sharedWorks: 0, sharedCategories: 0, comparableParts: 0});
  const result = culturalCompatibility([entry('a', {rating: 1, category: 'filme'})], [entry('b', {rating: 5, category: 'livro'})]);
  assert.equal(result.score, 0);
  assert.ok(Number.isFinite(result.score));
});
