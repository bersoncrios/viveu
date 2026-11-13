import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadClass(path, modules = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
  }).outputText;
  const exports = {};
  new Function('require', 'exports', 'document', 'console', compiled)(name => {
    assert.ok(modules[name], `Unexpected import: ${name}`);
    return modules[name];
  }, exports, {getElementById: () => null, querySelector: () => null}, {error() {}});
  return exports;
}

const models = await loadClass('src/app/core/models.ts');
const dataErrors = await loadClass('src/app/core/data-error.ts');
function signal(initial) {
  let value = initial;
  const read = () => value;
  read.set = next => {value = next;};
  return read;
}
const component = () => value => value;
const legacy = {
  id: 'legacy-entry', authorId: 'test-user', author: {displayName: 'Ana', photoURL: ''},
  title: 'Um livro', category: 'livro', rating: 5, quote: 'Uma frase antiga.',
  createdAt: 100, updatedAt: 100,
};

async function cardFor(entry) {
  const input = initial => signal(initial);
  input.required = () => signal(undefined);
  const {EntryCard} = await loadClass('src/app/pages/entry-card.ts', {
    '@angular/core': {Component: component, computed: compute => compute, input, signal, output: () => ({emit() {}})},
    '@angular/common': {DatePipe: class {}},
    '@angular/router': {RouterLink: class {}},
    '../core/models': models,
  });
  const card = new EntryCard();
  card.entry.set(entry);
  return card;
}

async function pageFor({entry, editId = entry?.id, queueId, query = {}, queued = [], failSave = false} = {}) {
  const calls = [];
  const navigations = [];
  const auth = {ready: Promise.resolve(), user: () => ({uid: 'test-user'})};
  const data = {
    getEntry: async () => entry,
    queue: async () => queued,
    saveEntry: async (...args) => {
      calls.push(args);
      if (failSave) throw failSave === true ? new Error('offline') : failSave;
      return 'saved-entry';
    },
  };
  const route = {snapshot: {
    paramMap: {get: key => key === 'id' ? editId : null},
    queryParamMap: {get: key => key === 'queue' ? queueId : query[key] ?? null},
  }};
  const router = {navigate: async commands => {navigations.push(commands); return true;}};
  const dependencies = {auth, data, route, router};
  const {EntryPage} = await loadClass('src/app/pages/entry.page.ts', {
    '@angular/core': {Component: component, signal, inject: token => dependencies[token]},
    '@angular/forms': {FormsModule: class {}},
    '@angular/common': {DatePipe: class {}},
    '@angular/router': {ActivatedRoute: 'route', Router: 'router', RouterLink: class {}},
    '../core/auth.service': {AuthService: 'auth'},
    '../core/data.service': {DataService: 'data'},
    '../core/data-error': dataErrors,
    '../core/models': models,
  });
  const page = new EntryPage();
  // Let the constructor's real asynchronous initialize() finish.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.loading(), false);
  return {page, calls, navigations};
}

test('spoiler text starts hidden, can be toggled and is hidden again for changed content or id', async () => {
  const entry = {...legacy, reflection: 'Uma revelação.', containsSpoilers: true};
  const card = await cardFor(entry);
  assert.equal(card.textVisible(), false);
  card.toggleSpoilers();
  assert.equal(card.textVisible(), true);
  card.toggleSpoilers();
  assert.equal(card.textVisible(), false);
  card.toggleSpoilers();
  card.entry.set({...entry, id: 'another-entry'});
  assert.equal(card.textVisible(), false);
  card.toggleSpoilers();
  card.entry.set({...entry, id: 'another-entry', reflection: 'Outro final.'});
  assert.equal(card.textVisible(), false);
  card.toggleSpoilers();
  card.entry.set({...entry, id: 'another-entry', reflection: 'Outro final.', quote: 'Outra citação.'});
  assert.equal(card.textVisible(), false);
});

test('a legacy quotation remains visible without requiring new experience fields', async () => {
  const card = await cardFor(legacy);
  assert.equal(card.textVisible(), true);
  assert.equal(card.entry().quote, 'Uma frase antiga.');
  assert.equal(card.feelingLabel('curioso'), 'Curioso');
});

test('editing a legacy entry preserves its quotation and defaults the new fields', async () => {
  const {page} = await pageFor({entry: legacy});
  assert.equal(page.title, legacy.title);
  assert.equal(page.category, legacy.category);
  assert.equal(page.rating, legacy.rating);
  assert.equal(page.quote, legacy.quote);
  assert.equal(page.reflection, '');
  assert.deepEqual(page.feelings, []);
  assert.equal(page.containsSpoilers, false);
  assert.equal(page.status, 'completed');
  assert.equal(page.loadFailed(), false);
});

test('editing an experience initializes new values without sharing its feelings array', async () => {
  const entry = {...legacy, reflection: 'Fiquei pensando.', feelings: ['curioso', 'emocionado'], containsSpoilers: true};
  const {page} = await pageFor({entry, queueId: 'irrelevant-queue-item'});
  assert.equal(page.reflection, entry.reflection);
  assert.deepEqual(page.feelings, entry.feelings);
  assert.notEqual(page.feelings, entry.feelings);
  assert.equal(page.containsSpoilers, true);
  assert.equal(page.queueId, undefined);
});

test('feelings allow three choices, removal and replacement, and ignore actions while saving', async () => {
  const {page} = await pageFor();
  for (const value of ['inspirado', 'emocionado', 'curioso', 'surpreso']) page.toggleFeeling(value);
  assert.deepEqual(page.feelings, ['inspirado', 'emocionado', 'curioso']);
  page.toggleFeeling('emocionado');
  page.toggleFeeling('surpreso');
  assert.deepEqual(page.feelings, ['inspirado', 'curioso', 'surpreso']);
  page.busy.set(true);
  page.toggleFeeling('inspirado');
  assert.deepEqual(page.feelings, ['inspirado', 'curioso', 'surpreso']);
});

test('saving a queued experience submits new fields and navigates only after success', async () => {
  const {page, calls, navigations} = await pageFor({queueId: 'queue-item', queued: [{id: 'queue-item', title: 'Da fila', category: 'livro'}]});
  assert.equal(page.title, 'Da fila');
  page.title = '  Um livro  '; page.rating = 4; page.quote = '  Uma frase.  ';
  page.reflection = '  Uma reflexão.  '; page.feelings = ['curioso']; page.containsSpoilers = true;
  await page.save();
  assert.deepEqual(calls, [[{
    title: 'Um livro', category: 'livro', rating: 4, quote: 'Uma frase.',
    reflection: 'Uma reflexão.', feelings: ['curioso'], containsSpoilers: true,
    status: 'completed', reason: '', resumePoint: '', notes: [], previousEntryId: undefined, expectedUpdatedAt: undefined,
  }, undefined, 'queue-item']]);
  assert.notEqual(calls[0][0].feelings, page.feelings);
  assert.equal(page.saved(), true);
  assert.deepEqual(navigations, [['/diary']]);
  await page.save();
  assert.equal(calls.length, 1, 'a confirmed save cannot be submitted twice');
});

test('a failed save preserves all experience inputs and allows a retry', async () => {
  const {page, calls, navigations} = await pageFor({entry: {
    ...legacy, reflection: 'Uma reflexão.', feelings: ['surpreso'], containsSpoilers: true,
  }, failSave: true});
  const before = {
    title: page.title, category: page.category, rating: page.rating, quote: page.quote,
    reflection: page.reflection, feelings: [...page.feelings], containsSpoilers: page.containsSpoilers,
  };
  await page.save();
  for (const [key, value] of Object.entries(before)) assert.deepEqual(page[key], value, key);
  assert.equal(page.saved(), false);
  assert.equal(page.busy(), false);
  assert.match(page.error(), /Seu texto continua aqui/);
  assert.deepEqual(navigations, []);
  assert.equal(calls[0][1], legacy.id);
  await page.save();
  assert.equal(calls.length, 2);
});

test('an ongoing journey saves without a rating and carries its version and progress', async () => {
  const entry = {...legacy, status: 'in_progress', rating: null, reason: 'Uma indicação', resumePoint: 'Capítulo 2', notes: [{id: 'note-1', text: 'Uma impressão', createdAt: 101, containsSpoilers: false}]};
  const {page, calls} = await pageFor({entry});
  assert.equal(page.rating, null);
  assert.equal(page.status, 'in_progress');
  assert.notEqual(page.notes[0], entry.notes[0]);
  page.resumePoint = '  Capítulo 3  ';
  await page.save();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].rating, null);
  assert.equal(calls[0][0].reason, 'Uma indicação');
  assert.equal(calls[0][0].resumePoint, 'Capítulo 3');
  assert.equal(calls[0][0].expectedUpdatedAt, entry.updatedAt);
  assert.deepEqual(calls[0][0].notes, entry.notes);
  assert.notEqual(calls[0][0].notes[0], page.notes[0]);
});

test('a completed journey requires a rating before writing', async () => {
  const {page, calls} = await pageFor();
  page.title = 'Um livro'; page.category = 'livro';
  assert.equal(page.status, 'completed');
  await page.save();
  assert.equal(calls.length, 0);
  assert.match(page.error(), /nota inteira/);
  assert.equal(page.busy(), false);
});

test('starting from the queue inherits its reason and starts an unrated journey', async () => {
  const {page, calls} = await pageFor({queueId: 'queued', query: {start: '1'}, queued: [{id: 'queued', title: 'Na fila', category: 'filme', reason: 'Indicação de uma amiga'}]});
  assert.equal(page.status, 'in_progress');
  assert.equal(page.reason, 'Indicação de uma amiga');
  assert.equal(page.rating, null);
  await page.save();
  assert.equal(calls[0][2], 'queued');
  assert.equal(calls[0][0].reason, 'Indicação de uma amiga');
});

test('revisiting creates a fresh journey linked to the owned source without copying experience details', async () => {
  const source = {...legacy, reflection: 'Reflexão anterior', feelings: ['emocionado'], containsSpoilers: true, reason: 'Motivo anterior', resumePoint: 'Fim', notes: [{id: 'old-note', text: 'Impressão anterior', createdAt: 101, containsSpoilers: true}]};
  const {page, calls} = await pageFor({entry: source, editId: null, query: {revisit: source.id}});
  assert.equal(page.title, source.title);
  assert.equal(page.category, source.category);
  assert.equal(page.status, 'in_progress');
  assert.equal(page.rating, null);
  assert.equal(page.reflection, '');
  assert.equal(page.quote, '');
  assert.deepEqual(page.feelings, []);
  assert.deepEqual(page.notes, []);
  assert.equal(page.reason, '');
  assert.equal(page.resumePoint, '');
  assert.equal(page.containsSpoilers, false);
  await page.save();
  assert.equal(calls[0][0].previousEntryId, source.id);
  assert.equal(calls[0][0].expectedUpdatedAt, undefined);
  assert.equal(calls[0][1], undefined, 'revisit must create rather than edit the source');
});

test('revisiting another person’s entry fails before a new journey can be initialized', async () => {
  const {page, calls} = await pageFor({entry: {...legacy, authorId: 'someone-else'}, editId: null, query: {revisit: legacy.id}});
  assert.equal(page.loadFailed(), true);
  assert.equal(page.title, '');
  assert.equal(calls.length, 0);
});

test('an unsent note draft is included on save and retained in the journey after a conflict', async () => {
  const {page, calls} = await pageFor({entry: {...legacy, status: 'in_progress', rating: null}, failSave: Object.assign(new Error('Outra sessão atualizou a jornada.'), {code: 'vaultlog/stale-entry'})});
  page.noteDraft = '  Ainda pensando nesta cena.  '; page.noteSpoilers = true;
  page.reason = 'Quero entender'; page.resumePoint = 'Capítulo 8';
  await page.save();
  assert.equal(page.notes.length, 1);
  assert.equal(page.notes[0].text, 'Ainda pensando nesta cena.');
  assert.equal(page.notes[0].containsSpoilers, true);
  assert.equal(page.noteDraft, '');
  assert.deepEqual(calls[0][0].notes, page.notes);
  assert.equal(page.reason, 'Quero entender');
  assert.equal(page.resumePoint, 'Capítulo 8');
  assert.equal(page.saved(), false);
  assert.match(page.error(), /mudou em outra sessão/);
  await page.save();
  assert.equal(page.notes.length, 1, 'retry cannot append the draft again');
  assert.equal(calls[1][0].expectedUpdatedAt, legacy.updatedAt);
});

test('notes enforce text and count limits and can be removed before saving', async () => {
  const {page, calls} = await pageFor({entry: {...legacy, status: 'in_progress', rating: null}});
  page.noteDraft = 'x'.repeat(models.JOURNEY_NOTE_MAX_LENGTH + 1);
  assert.equal(page.addNote(), false);
  assert.equal(page.notes.length, 0);
  page.noteDraft = 'x'.repeat(models.JOURNEY_NOTE_MAX_LENGTH);
  assert.equal(page.addNote(), true);
  assert.equal(page.notes[0].text.length, models.JOURNEY_NOTE_MAX_LENGTH);
  const firstId = page.notes[0].id;
  page.busy.set(true); page.removeNote(firstId);
  assert.equal(page.notes.length, 1);
  page.busy.set(false); page.removeNote(firstId);
  assert.equal(page.notes.length, 0);
  page.notes = Array.from({length: models.MAX_JOURNEY_NOTES}, (_, i) => ({id: `note-${i}`, text: 'Uma impressão', createdAt: i, containsSpoilers: false}));
  page.noteDraft = 'Não pode ser perdida';
  await page.save();
  assert.equal(calls.length, 0);
  assert.equal(page.noteDraft, 'Não pode ser perdida');
  assert.equal(page.notes.length, models.MAX_JOURNEY_NOTES);
  page.removeNote('note-0');
  await page.save();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].notes.length, models.MAX_JOURNEY_NOTES);
  assert.equal(calls[0][0].notes.at(-1).text, 'Não pode ser perdida');
});

test('card note spoilers are independent of the reflection and of other notes', async () => {
  const first = {id: 'first', text: 'Uma revelação', createdAt: 101, containsSpoilers: true};
  const second = {id: 'second', text: 'Outra revelação', createdAt: 102, containsSpoilers: true};
  const plain = {id: 'plain', text: 'Uma impressão sem spoiler', createdAt: 103, containsSpoilers: false};
  const entry = {...legacy, reflection: 'O final', containsSpoilers: true, notes: [first, second, plain]};
  const card = await cardFor(entry);
  assert.equal(card.noteVisible(first), false);
  assert.equal(card.noteVisible(second), false);
  assert.equal(card.noteVisible(plain), true);
  card.toggleNote(first);
  assert.equal(card.noteVisible(first), true);
  assert.equal(card.noteVisible(second), false);
  assert.equal(card.textVisible(), false);
  card.toggleSpoilers();
  assert.equal(card.textVisible(), true);
  assert.equal(card.noteVisible(second), false);
  card.toggleNote(first);
  assert.equal(card.noteVisible(first), false);
  assert.equal(card.textVisible(), true);
  card.toggleNote(first);
  assert.equal(card.noteVisible({...first, text: 'Nota editada'}), false);
  card.entry.set({...entry, id: 'another-entry'});
  assert.equal(card.noteVisible(first), false);
});
