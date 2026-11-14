import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/core/data.service.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
}).outputText;
const modelSource = await readFile(new URL('../src/app/core/models.ts', import.meta.url), 'utf8');
const models = {};
new Function('exports', ts.transpileModule(modelSource, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText)(models);

function serviceWithProfile(profile, existing = null, records = {}) {
  const writes = [];
  const deletions = [];
  const reads = [];
  const queries = [];
  const db = {};
  const auth = {requireUser: () => ({uid: 'test-user'})};
  const firestore = {
    Firestore: 'firestore',
    collection: (...path) => path,
    doc: (...path) => ({id: path.length === 1 ? 'new-entry' : path.at(-1)}),
    where: (...args) => ({where: args}),
    orderBy: (...args) => ({orderBy: args}),
    documentId: () => '__name__',
    limit: value => ({limit: value}),
    query: (...parts) => parts,
    getDocs: async query => {queries.push(query); return {docs: [], size: 0};},
    setDoc: async (reference, data) => writes.push({reference, data}),
    runTransaction: async (_db, work) => {
      const pendingWrites = [];
      const pendingDeletions = [];
      const result = await work({
      get: async reference => {
        assert.equal(pendingWrites.length + pendingDeletions.length, 0, 'All transaction reads must precede writes');
        reads.push(reference.id);
        const data = Object.hasOwn(records, reference.id) ? records[reference.id] : existing;
        return {exists: () => !!data, data: () => data};
      },
      set: (reference, data) => {
        for (const value of Object.values(data.author)) {
          assert.notEqual(value, undefined, 'Firestore rejects undefined author fields');
        }
        pendingWrites.push({reference, data});
      },
      delete: reference => pendingDeletions.push(reference),
      });
      writes.push(...pendingWrites);
      deletions.push(...pendingDeletions);
      return result;
    },
  };
  const modules = {
    '@angular/core': {
      Injectable: () => value => value,
      inject: token => token === 'firestore' ? db : token === 'auth' ? auth : {},
      runInInjectionContext: (_injector, work) => work(),
    },
    '@angular/fire/firestore': firestore,
    './auth.service': {AuthService: 'auth', validUid: uid => !!uid && !uid.includes('/')},
    './models': models,
    './engagement': {},
  };
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    assert.ok(modules[name], `Unexpected import: ${name}`);
    return modules[name];
  }, exports);
  const service = new exports.DataService();
  service.getProfile = async () => profile;
  service.recordActivity = async () => {};
  service.refreshEngagement = async () => {};
  return {service, writes, deletions, reads, queries};
}

const input = {title: '  Um livro  ', category: 'livro', rating: 5, quote: ''};

test('saving an entry accepts a legacy profile without a photo', async () => {
  const {service, writes} = serviceWithProfile({displayName: 'Ana'});
  assert.equal(await service.saveEntry(input), 'new-entry');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].data.author, {displayName: 'Ana', photoURL: ''});
  assert.equal(writes[0].data.title, 'Um livro');
});

test('saving normalizes missing legacy identity and preserves a valid photo', async () => {
  const {service, writes} = serviceWithProfile({photoURL: 'https://example.com/photo.png'});
  await service.saveEntry(input);
  assert.deepEqual(writes[0].data.author, {
    displayName: 'Pessoa Viveu', photoURL: 'https://example.com/photo.png',
  });
});

test('a missing profile still prevents an entry write', async () => {
  const {service, writes} = serviceWithProfile(null);
  await assert.rejects(service.saveEntry(input), /Conclua seu perfil/);
  assert.equal(writes.length, 0);
});

test('legacy inputs receive defaults without converting their quotation into a reflection', async () => {
  const {service, writes} = serviceWithProfile({displayName: 'Ana'});
  await service.saveEntry({...input, quote: '  Uma citação antiga.  '});
  assert.equal(writes[0].data.quote, 'Uma citação antiga.');
  assert.equal(writes[0].data.reflection, '');
  assert.deepEqual(writes[0].data.feelings, []);
  assert.equal(writes[0].data.containsSpoilers, false);
});

test('reflection, unique feelings and spoilers are normalized and saved together', async () => {
  const {service, writes, deletions} = serviceWithProfile({displayName: 'Ana'}, {title: 'Da fila'});
  await service.saveEntry({
    ...input, quote: undefined, reflection: '  Fez-me pensar sobre escolhas.  ',
    feelings: ['inspirado', 'curioso', 'inspirado'], containsSpoilers: true,
  }, undefined, 'queue-item');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.quote, '');
  assert.equal(writes[0].data.reflection, 'Fez-me pensar sobre escolhas.');
  assert.deepEqual(writes[0].data.feelings, ['inspirado', 'curioso']);
  assert.equal(writes[0].data.containsSpoilers, true);
  assert.deepEqual(deletions, [{id: 'queue-item'}]);
});

test('editing a legacy record retains its creation date and saves the new fields', async () => {
  const {service, writes} = serviceWithProfile({displayName: 'Ana'}, {
    authorId: 'test-user', createdAt: 100, quote: 'Legado',
  });
  await service.saveEntry({...input, quote: 'Legado', reflection: 'Agora posso refletir.'}, 'legacy-entry');
  assert.equal(writes[0].data.createdAt, 100);
  assert.equal(writes[0].data.quote, 'Legado');
  assert.equal(writes[0].data.reflection, 'Agora posso refletir.');
});

test('the maximum reflection and three feelings are accepted', async () => {
  const {service, writes} = serviceWithProfile({displayName: 'Ana'});
  await service.saveEntry({
    ...input, reflection: 'a'.repeat(models.REFLECTION_MAX_LENGTH),
    feelings: ['emocionado', 'surpreso', 'divertido'],
  });
  assert.equal(writes[0].data.reflection.length, 3000);
  assert.equal(writes[0].data.feelings.length, 3);
});

for (const [name, patch, message] of [
  ['overlong reflection', {reflection: 'a'.repeat(3001)}, /3000/],
  ['non-text reflection', {reflection: 42}, /reflexão deve ser um texto/],
  ['too many feelings', {feelings: ['inspirado', 'emocionado', 'curioso', 'surpreso']}, /até 3 sentimentos/],
  ['unknown feeling', {feelings: ['feliz']}, /sentimentos válidos/],
  ['non-list feelings', {feelings: 'curioso'}, /sentimentos válidos/],
  ['non-boolean spoilers', {containsSpoilers: 'false'}, /contém spoilers/],
  ['overlong legacy quotation', {quote: 'a'.repeat(501)}, /500/],
]) {
  test(`invalid ${name} is rejected before any write or queue removal`, async () => {
    const {service, writes, deletions} = serviceWithProfile({displayName: 'Ana'});
    await assert.rejects(service.saveEntry({...input, ...patch}, undefined, 'queue-item'), message);
    assert.equal(writes.length, 0);
    assert.equal(deletions.length, 0);
  });
}

test('reflection prompts cover every category and provide a default', () => {
  const prompts = models.CATEGORIES.map(({value}) => models.reflectionPrompt(value));
  assert.ok(prompts.every(prompt => typeof prompt === 'string' && prompt.endsWith('?')));
  assert.equal(new Set(prompts).size, models.CATEGORIES.length);
  assert.ok(models.reflectionPrompt('').endsWith('?'));
});

const note = {id: 'note-1', text: 'Uma descoberta.', createdAt: 123, containsSpoilers: false};
const profile = {displayName: 'Ana'};

test('legacy journeys remain completed and retain their original completion date', async () => {
  const {service, writes} = serviceWithProfile(profile, {authorId: 'test-user', createdAt: 100, updatedAt: 101});
  await service.saveEntry(input, 'legacy');
  assert.equal(writes[0].data.status, 'completed');
  assert.equal(writes[0].data.completedAt, 100);
  assert.equal(writes[0].data.startedAt, null);
  assert.equal(models.journeyStatus({}), 'completed');
  assert.equal(models.journeyStatusLabel(), 'Terminei');
});

for (const status of ['in_progress', 'paused', 'abandoned']) {
  test(`${status} accepts an unrated journey`, async () => {
    const {service, writes} = serviceWithProfile(profile);
    await service.saveEntry({...input, status, rating: null});
    const saved = writes[0].data;
    assert.equal(saved.rating, null);
    assert.equal(saved.status, status);
    assert.equal(saved.completedAt, null);
    assert.equal(saved.startedAt, status === 'abandoned' ? null : saved.createdAt);
  });
}

test('completion requires a rating and rejects the write atomically', async () => {
  const {service, writes, deletions} = serviceWithProfile(profile, {title: 'Fila'});
  await assert.rejects(service.saveEntry({...input, rating: null}, undefined, 'queue'), /nota/);
  assert.equal(writes.length, 0);
  assert.equal(deletions.length, 0);
});

test('completion, editing and reopening retain start date and handle completion date', async () => {
  const original = {authorId: 'test-user', status: 'in_progress', startedAt: 10, createdAt: 10, updatedAt: 20};
  const completed = serviceWithProfile(profile, original);
  await completed.service.saveEntry({...input, status: 'completed'}, 'journey');
  const saved = completed.writes[0].data;
  assert.equal(saved.startedAt, 10);
  assert.ok(saved.completedAt >= 20);
  const edited = serviceWithProfile(profile, saved);
  await edited.service.saveEntry({...input, reflection: 'Outra ideia.'}, 'journey');
  assert.equal(edited.writes[0].data.completedAt, saved.completedAt);
  const reopened = serviceWithProfile(profile, saved);
  await reopened.service.saveEntry({...input, status: 'in_progress', rating: null}, 'journey');
  assert.equal(reopened.writes[0].data.startedAt, 10);
  assert.equal(reopened.writes[0].data.completedAt, null);
});

test('omitted optional fields preserve saved journey data and note dates', async () => {
  const existing = {
    authorId: 'test-user', status: 'paused', startedAt: 10, createdAt: 10, updatedAt: 20,
    reason: 'Uma indicação.', resumePoint: 'Capítulo 4', notes: [note],
    reflection: 'Uma reflexão.', feelings: ['curioso'], containsSpoilers: true, quote: 'Citação.',
    previousEntryId: 'source',
  };
  const {service, writes} = serviceWithProfile(profile, existing);
  await service.saveEntry({title: 'Livro', category: 'livro', rating: null}, 'journey');
  for (const key of ['status', 'startedAt', 'reason', 'resumePoint', 'notes', 'reflection', 'feelings', 'containsSpoilers', 'quote', 'previousEntryId']) {
    assert.deepEqual(writes[0].data[key], existing[key], key);
  }
  const edited = serviceWithProfile(profile, existing);
  await edited.service.saveEntry({...input, notes: [{...note, text: 'Texto atualizado.', createdAt: 999}]}, 'journey');
  assert.equal(edited.writes[0].data.notes[0].createdAt, note.createdAt);
  assert.equal(edited.writes[0].data.notes[0].text, 'Texto atualizado.');
});

test('a stale version prevents overwriting and returns the UI conflict code', async () => {
  const {service, writes} = serviceWithProfile(profile, {authorId: 'test-user', updatedAt: 200});
  await assert.rejects(service.saveEntry({...input, expectedUpdatedAt: 100}, 'journey'), error => {
    assert.equal(error.code, 'vaultlog/stale-entry');
    return true;
  });
  assert.equal(writes.length, 0);
});

test('the expected version can save, and source link cannot be changed in an edit', async () => {
  const {service, writes, reads} = serviceWithProfile(profile, {
    authorId: 'test-user', updatedAt: 200, previousEntryId: 'original-source',
  });
  await service.saveEntry({...input, expectedUpdatedAt: 200, previousEntryId: 'other-source'}, 'journey');
  assert.equal(writes[0].data.previousEntryId, 'original-source');
  assert.deepEqual(reads, ['journey']);
});

test('revisiting reads its source in the transaction without copying or mutating it', async () => {
  const original = {authorId: 'test-user', rating: 1, reflection: 'Antiga', notes: [note]};
  const {service, writes, reads} = serviceWithProfile(profile, null, {'source': original});
  await service.saveEntry({...input, status: 'in_progress', rating: null, previousEntryId: 'source'});
  assert.deepEqual(reads, ['source']);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].reference.id, 'new-entry');
  assert.equal(writes[0].data.previousEntryId, 'source');
  assert.equal(writes[0].data.rating, null);
  assert.equal(writes[0].data.reflection, '');
  assert.deepEqual(writes[0].data.notes, []);
  assert.equal(original.reflection, 'Antiga');
});

for (const [name, source] of [['missing', null], ['other author', {authorId: 'other'}]]) {
  test(`a ${name} revisit source prevents the new record`, async () => {
    const {service, writes} = serviceWithProfile(profile, null, {source});
    await assert.rejects(service.saveEntry({...input, previousEntryId: 'source'}), /próprios registros/);
    assert.equal(writes.length, 0);
  });
}

test('queue motivation is copied in the same transaction unless explicitly overridden', async () => {
  for (const [reason, expected] of [[undefined, 'Indicação de uma amiga.'], ['', ''], ['Outro motivo', 'Outro motivo']]) {
    const {service, writes, deletions, reads} = serviceWithProfile(profile, null, {
      queue: {reason: 'Indicação de uma amiga.'},
    });
    await service.saveEntry({...input, reason, notes: [note], status: 'in_progress', rating: null}, undefined, 'queue');
    assert.deepEqual(reads, ['queue']);
    assert.equal(writes[0].data.reason, expected);
    assert.deepEqual(writes[0].data.notes, [note]);
    assert.equal(deletions.length, 1);
  }
});

for (const [name, patch] of [
  ['unknown status', {status: 'unknown'}],
  ['null status', {status: null}],
  ['reason over 500', {reason: 'a'.repeat(501)}],
  ['invalid reason', {reason: 123}],
  ['resume over 160', {resumePoint: 'a'.repeat(161)}],
  ['note over 1000', {notes: [{...note, text: 'a'.repeat(1001)}]}],
  ['empty note', {notes: [{...note, text: '   '}]}],
  ['duplicate note id', {notes: [note, {...note}]}],
  ['invalid note id', {notes: [{...note, id: 'bad/id'}]}],
  ['non-finite date', {notes: [{...note, createdAt: NaN}]}],
  ['non-numeric date', {notes: [{...note, createdAt: '123'}]}],
  ['invalid note spoiler', {notes: [{...note, containsSpoilers: 'true'}]}],
  ['too many notes', {notes: Array.from({length: 101}, (_, i) => ({...note, id: `n-${i}`}))}],
  ['invalid notes list', {notes: {}}],
  ['sparse notes', {notes: Array(1)}],
  ['sparse feelings', {feelings: Array(1)}],
  ['invalid previous entry', {previousEntryId: 42}],
  ['invalid version', {expectedUpdatedAt: Infinity}],
]) {
  test(`${name} prevents journey writes and queue removals`, async () => {
    const {service, writes, deletions} = serviceWithProfile(profile, {title: 'Fila'});
    await assert.rejects(service.saveEntry({...input, ...patch}, undefined, 'queue'));
    assert.equal(writes.length, 0);
    assert.equal(deletions.length, 0);
  });
}

test('100 notes of 1000 characters and motive/resume limits can be saved', async () => {
  const {service, writes} = serviceWithProfile(profile);
  const notes = Array.from({length: 100}, (_, i) => ({...note, id: `n-${i}`, text: 'a'.repeat(1000)}));
  await service.saveEntry({...input, notes, reason: 'a'.repeat(500), resumePoint: 'b'.repeat(160)});
  assert.equal(writes[0].data.notes.length, 100);
});

test('queue creation saves a normalized reason and rejects an excessive reason', async () => {
  const {service, writes} = serviceWithProfile(profile);
  service.queue = async () => [];
  await service.addQueue('Livro', 'livro', '  Indicação.  ');
  assert.equal(writes[0].data.reason, 'Indicação.');
  await assert.rejects(service.addQueue('Livro', 'livro', 'a'.repeat(501)), /500/);
  assert.equal(writes.length, 1);
});

test('active journeys query only the current author, active states and latest 20 updates', async () => {
  const {service, queries} = serviceWithProfile(profile);
  assert.deepEqual(await service.activeJourneys(), []);
  assert.deepEqual(queries[0].slice(1), [
    {where: ['authorId', '==', 'test-user']},
    {where: ['status', 'in', ['in_progress', 'paused']]},
    {orderBy: ['updatedAt', 'desc']},
    {orderBy: ['__name__', 'desc']},
    {limit: 20},
  ]);
});

test('version advances with a frozen clock and rejects a second edit from the same version', async () => {
  const realNow = Date.now;
  Date.now = () => 100;
  try {
    for (const updatedAt of [100, 200]) {
      const saved = {authorId: 'test-user', createdAt: 50, updatedAt};
      const first = serviceWithProfile(profile, saved);
      await first.service.saveEntry({...input, expectedUpdatedAt: updatedAt}, 'journey');
      assert.equal(first.writes[0].data.updatedAt, updatedAt + 1);
      assert.equal(first.writes[0].data.createdAt, 50);
      const second = serviceWithProfile(profile, first.writes[0].data);
      await assert.rejects(second.service.saveEntry({...input, expectedUpdatedAt: updatedAt}, 'journey'), {
        code: 'vaultlog/stale-entry',
      });
      assert.equal(second.writes.length, 0);
    }
  } finally {
    Date.now = realNow;
  }
});

test('starting a legacy completed journey initializes its first start date only once', async () => {
  const legacy = {authorId: 'test-user', createdAt: 100, updatedAt: 101};
  const first = serviceWithProfile(profile, legacy);
  await first.service.saveEntry({...input, status: 'in_progress', rating: null}, 'legacy');
  const started = first.writes[0].data;
  assert.equal(typeof started.startedAt, 'number');
  assert.ok(started.startedAt >= 101);
  assert.equal(started.completedAt, null);
  assert.equal(started.createdAt, 100);
  const second = serviceWithProfile(profile, started);
  await second.service.saveEntry({...input, status: 'paused', rating: null}, 'legacy');
  assert.equal(second.writes[0].data.startedAt, started.startedAt);
});
