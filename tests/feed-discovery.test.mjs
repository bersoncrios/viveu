import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(path, modules = {}, storage = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exports = {};
  const code = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  }}).outputText;
  new Function('require', 'exports', 'sessionStorage', code)(name => {
    assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name];
  }, exports, storage);
  return exports;
}
function signal(value) {
  const read = () => value;
  read.set = next => {value = next;};
  read.update = change => {value = change(value);};
  return read;
}
const models = await load('src/app/core/models.ts');
const discovery = await load('src/app/core/discovery.ts', {'./models': models});
const tick = () => new Promise(resolve => setImmediate(resolve));
const friendEntry = {id: 'friend-entry', title: '  Uma   História ', category: 'livro'};
async function harness({queue = [], own = [], add, storage} = {}) {
  const calls = [];
  const auth = {ready: Promise.resolve()};
  const data = {following: async () => [], feedPage: async () => ({items: [], cursor: null, hasMore: false}),
    queue: async () => queue, allEntries: async () => own,
    addQueue: async (...args) => {calls.push(args); return add?.(...args);}};
  const values = new Map();
  storage ??= {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  const {FeedPage} = await load('src/app/pages/feed.page.ts', {
    '@angular/core': {Component: () => value => value, signal, computed: compute => compute,
      inject: token => token === 'auth' ? auth : data},
    '@angular/forms': {}, '@angular/router': {}, '../core/auth.service': {AuthService: 'auth'},
    '../core/data.service': {DataService: 'data', MAX_FOLLOWING: 30}, '../core/models': models,
    '../core/discovery': discovery, './entry-card': {}, './active-journeys': {}, './engagement-panel': {}, './retention-panels': {}, './shared-memory-suggestions': {}, '../shared/skeleton-card': {},
    '../core/data-error': {dataErrorMessage: (_err, fallback) => fallback},
  }, storage);
  const page = new FeedPage(); await tick();
  return {page, calls, data, values};
}

test('feed queue action catches normalized title/category duplicates already queued', async () => {
  const {page, calls} = await harness({queue: [{title: 'uma história', category: 'livro'}]});
  await page.addToQueue(friendEntry);
  assert.equal(page.queueNotice(), 'Essa obra já está na sua fila');
  assert.deepEqual(calls, []);
  assert.equal(page.adding(), '');
});

test('feed queue action catches works already recorded by current user', async () => {
  const {page, calls} = await harness({own: [{title: 'UMA HISTÓRIA', category: 'livro'}]});
  await page.addToQueue(friendEntry);
  assert.equal(page.queueNotice(), 'Você já registrou essa obra');
  assert.deepEqual(calls, []);
});

test('same title in a different category can be added and copies no friend private details', async () => {
  const {page, calls} = await harness({queue: [{title: 'uma história', category: 'filme'}]});
  await page.addToQueue({...friendEntry, reason: 'Motivo alheio', quote: 'Texto alheio', rating: 5});
  assert.deepEqual(calls, [[friendEntry.title, friendEntry.category]]);
  assert.equal(page.queueNotice(), 'Adicionado à sua fila!');
});

test('feed queue action awaits confirmed write and ignores concurrent clicks', async () => {
  let resolve;
  const pending = new Promise(yes => {resolve = yes;});
  const {page, calls} = await harness({add: () => pending});
  const first = page.addToQueue(friendEntry); await tick();
  assert.equal(page.adding(), friendEntry.id);
  assert.equal(page.queueNotice(), '');
  await page.addToQueue(friendEntry);
  await page.addToQueue({...friendEntry, id: 'another'});
  assert.equal(calls.length, 1);
  resolve(); await first;
  assert.equal(page.adding(), '');
  assert.equal(page.queueNotice(), 'Adicionado à sua fila!');
});

test('feed queue failure keeps retry available and never claims success', async () => {
  let fail = true;
  const {page, calls} = await harness({add: () => {if (fail) throw new Error('offline');}});
  await page.addToQueue(friendEntry);
  assert.match(page.queueNotice(), /Não foi possível adicionar/);
  assert.equal(page.adding(), '');
  fail = false; await page.addToQueue(friendEntry);
  assert.equal(calls.length, 2);
  assert.equal(page.queueNotice(), 'Adicionado à sua fila!');
});

test('duplicate-check read failure prevents queue write', async () => {
  const {page, calls, data} = await harness();
  data.allEntries = async () => {throw new Error('permission-denied');};
  await page.addToQueue(friendEntry);
  assert.deepEqual(calls, []);
  assert.match(page.queueNotice(), /Não foi possível adicionar/);
});

test('feed category filters local entries and restores category across page instances in same session', async () => {
  const store = new Map();
  const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  const {page} = await harness({storage});
  const entries = [friendEntry, {...friendEntry, id: 'film', category: 'filme'}];
  page.entries.set(entries);
  assert.equal(page.visibleEntries().length, 2);
  page.selectCategory('livro');
  assert.deepEqual(page.visibleEntries(), [friendEntry]);
  assert.deepEqual(page.entries(), entries, 'filter must not remove loaded data');
  const next = await harness({storage});
  assert.equal(next.page.activeCategory(), 'livro');
  next.page.entries.set(entries); next.page.selectCategory('');
  assert.equal(next.page.visibleEntries().length, 2);
});

test('invalid saved category and unavailable session storage preserve usable in-memory filtering', async () => {
  const invalid = await harness({storage: {getItem: () => 'not-a-category'}});
  assert.equal(invalid.page.activeCategory(), '');
  const blocked = await harness({storage: {getItem() {throw new Error('blocked');}, setItem() {throw new Error('blocked');}}});
  blocked.page.entries.set([friendEntry]); blocked.page.selectCategory('livro');
  assert.equal(blocked.page.activeCategory(), 'livro');
  assert.deepEqual(blocked.page.visibleEntries(), [friendEntry]);
});
