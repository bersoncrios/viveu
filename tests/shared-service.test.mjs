import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const sources = {};
for (const name of ['models', 'shared-models', 'shared-journey.service']) {
  sources[name] = ts.transpileModule(await readFile(new URL(`../src/app/core/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
  }).outputText;
}
const group = {ownerId: 'owner', ownerName: 'Ana', title: 'Uma obra', category: 'livro', description: '', pace: 'milestones', unit: 'capitulo',
  memberIds: ['owner'], invitedIds: [], audienceIds: ['owner'], milestones: [], archived: false, createdAt: 10, updatedAt: 20};
const member = {uid: 'owner', displayName: 'Ana', photoURL: '', role: 'owner', state: 'active', progress: 0, status: 'in_progress',
  entryId: 'reserved', entryPublished: false, rating: null, reflection: '', joinedAt: 10, invitedAt: 10, updatedAt: 20};
const createInput = {title: '  Uma obra  ', category: 'livro', description: '', pace: 'free', unit: 'capitulo'};
const postInput = {text: '  Minha impressão.  ', kind: 'note', progress: null, containsSpoilers: false, publishPublicly: false};
const finishInput = {rating: 5, reflection: 'Minha reflexão.', publishPublicly: false};

function fixture(extra = {}, initialUid = 'owner') {
  const records = new Map(Object.entries({
    'appConfig/sharedJourneys': {enabled: true, rulesVersion: 1},
    'users/owner': {displayName: 'Ana'}, 'users/friend': {displayName: 'Bia', photoURL: 'photo'},
    'sharedJourneys/group': structuredClone(group), 'sharedJourneys/group/members/owner': structuredClone(member), ...extra,
  }).filter(([, value]) => value !== null));
  const reads = [], writes = [], queries = [];
  let nextId = 0, uid = initialUid, transactionHook;
  const db = {};
  const snap = (ref, value = records.get(ref.path)) => ({id: ref.id, ref, exists: () => value !== undefined, data: () => structuredClone(value)});
  const ref = path => ({path, id: path.split('/').at(-1)});
  const firestore = {
    Firestore: 'db',
    collection: (_db, ...parts) => ref(parts.join('/')),
    doc: (...parts) => parts.length === 1 ? ref(`${parts[0].path}/auto-${++nextId}`) : ref(parts.slice(1).join('/')),
    documentId: () => '__name__',
    where: (...args) => ({where: args}), orderBy: (...args) => ({orderBy: args}), limit: count => ({limit: count}), startAfter: cursor => ({startAfter: cursor}),
    query: (collection, ...constraints) => ({collection, constraints}),
    getDoc: async reference => {reads.push(reference.path); return snap(reference);},
    getDocs: async query => {
      queries.push(query); const prefix = query.collection.path + '/';
      let docs = [...records].filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/')).map(([path, data]) => snap(ref(path), data));
      for (const constraint of query.constraints) {
        if (constraint.where) {
          const [field, op, value] = constraint.where;
          docs = docs.filter(doc => op === 'array-contains' ? doc.data()[field].includes(value)
            : op === 'in' ? value.includes(doc.data()[field]) : doc.data()[field] === value);
        }
      }
      const order = query.constraints.filter(item => item.orderBy).map(item => item.orderBy);
      docs.sort((a, b) => {
        for (const [field, direction] of order) {
          const av = field === '__name__' ? a.id : a.data()[field], bv = field === '__name__' ? b.id : b.data()[field];
          if (av !== bv) return (av < bv ? -1 : 1) * (direction === 'desc' ? -1 : 1);
        }
        return 0;
      });
      const cursor = query.constraints.find(item => item.startAfter)?.startAfter;
      if (cursor) docs = docs.slice(docs.findIndex(doc => doc.id === cursor.id) + 1);
      docs = docs.slice(0, query.constraints.find(item => item.limit)?.limit ?? Infinity);
      return {docs, size: docs.length};
    },
    runTransaction: async (_db, work) => {
      if (transactionHook) {const hook = transactionHook; transactionHook = undefined; hook(records);}
      const pending = [];
      const result = await work({
        get: async reference => {assert.equal(pending.length, 0, 'Transaction reads must precede all writes'); reads.push(reference.path); return snap(reference);},
        set: (reference, data) => pending.push({reference, data: structuredClone(data), update: false}),
        update: (reference, data) => pending.push({reference, data: structuredClone(data), update: true}),
      });
      for (const write of pending) {
        assert.notEqual(write.data, undefined);
        records.set(write.reference.path, write.update ? {...records.get(write.reference.path), ...write.data} : write.data);
        writes.push(write);
      }
      return result;
    },
  };
  const cache = {};
  const modules = {
    '@angular/core': {Injectable: () => value => value, inject: token => token === 'db' ? db : token === 'auth' ? {requireUser: () => {
      if (!uid) throw new Error('logged out'); return {uid};
    }} : {}, runInInjectionContext: (_injector, work) => work()},
    '@angular/fire/firestore': firestore,
    './auth.service': {AuthService: 'auth', validUid: value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') && !['.', '..'].includes(value)},
  };
  function load(name) {
    if (modules[name]) return modules[name];
    name = name.replace('./', '');
    if (!cache[name]) {cache[name] = {}; new Function('exports', 'require', sources[name])(cache[name], load);}
    return cache[name];
  }
  const {SharedJourneyService} = load('./shared-journey.service');
  return {service: new SharedJourneyService(), records, reads, writes, queries, as: value => {uid = value;}, beforeTransaction: hook => {transactionHook = hook;}};
}
const code = name => error => {assert.equal(error.code, `vaultlog/shared-${name}`); return true;};

const calls = [
  service => service.ensureAvailable(), service => service.list(), service => service.get('group'), service => service.membership('group'),
  service => service.members('group'), service => service.posts('group'), service => service.create(createInput),
  service => service.invite('group', 'friend'), service => service.respond('group', true),
  service => service.updateProgress('group', 1, 'paused'), service => service.leave('group'), service => service.archive('group'),
  service => service.addMilestone('group', {title: 'Até aqui', position: 2, question: '', meetingAt: null}),
  service => service.addPost('group', postInput), service => service.finish('group', finishInput),
];
for (const [index, call] of calls.entries()) {
  test(`public method ${index + 1} fails closed while feature gate is disabled`, async () => {
    const {service, writes, reads} = fixture({'appConfig/sharedJourneys': {enabled: false, rulesVersion: 1}});
    await assert.rejects(call(service), code('disabled')); assert.equal(writes.length, 0);
    assert.deepEqual(reads, ['appConfig/sharedJourneys']);
  });
}

test('missing config or wrong rules version cannot enable private data', async () => {
  for (const config of [null, {enabled: true, rulesVersion: 0}, {enabled: 'true', rulesVersion: 1}]) {
    const {service, writes} = fixture({'appConfig/sharedJourneys': config});
    await assert.rejects(service.list(), code('disabled')); assert.equal(writes.length, 0);
  }
});

test('creating reserves an entry ID without publishing an entry or touching the queue', async () => {
  const {service, records, writes} = fixture(); const id = await service.create(createInput);
  const created = records.get(`sharedJourneys/${id}`), own = records.get(`sharedJourneys/${id}/members/owner`);
  assert.equal(created.title, 'Uma obra'); assert.deepEqual(created.memberIds, ['owner']); assert.deepEqual(created.audienceIds, ['owner']);
  assert.deepEqual(created.invitedIds, []); assert.deepEqual(created.milestones, []); assert.equal(created.archived, false);
  assert.equal(own.state, 'active'); assert.equal(own.role, 'owner'); assert.equal(own.rating, null); assert.equal(own.entryPublished, false);
  assert.equal(own.photoURL, ''); assert.equal(records.has(`entries/${own.entryId}`), false);
  assert.ok(writes.every(write => write.reference.path.startsWith(`sharedJourneys/${id}`)));
});

test('invitation, accept, leave and reinvite preserve individual data and reserved identity', async () => {
  const {service, records, as} = fixture();
  await service.invite('group', 'friend');
  const path = 'sharedJourneys/group/members/friend'; const invited = records.get(path);
  assert.equal(invited.state, 'invited'); assert.equal(invited.joinedAt, null); assert.equal(invited.entryPublished, false);
  assert.deepEqual(records.get('sharedJourneys/group').invitedIds, ['friend']);
  as('friend'); await service.respond('group', true); await service.updateProgress('group', 10, 'paused'); await service.leave('group');
  assert.equal(records.get(path).state, 'left'); assert.equal(records.get(path).progress, 10);
  assert.deepEqual(records.get('sharedJourneys/group').audienceIds, ['owner']);
  as('owner'); await service.invite('group', 'friend');
  assert.equal(records.get(path).entryId, invited.entryId); assert.equal(records.get(path).progress, 10);
  as('friend'); await service.respond('group', false);
  assert.equal(records.get(path).state, 'declined'); assert.deepEqual(records.get('sharedJourneys/group').invitedIds, []);
});

test('duplicate/self/missing-profile invitations and audience above 30 are rejected', async () => {
  for (const target of ['owner', 'missing']) {
    const {service, writes} = fixture(); await assert.rejects(service.invite('group', target), code('validation')); assert.equal(writes.length, 0);
  }
  const f = fixture(); await f.service.invite('group', 'friend'); const count = f.writes.length;
  await assert.rejects(f.service.invite('group', 'friend'), code('validation')); assert.equal(f.writes.length, count);
  const full = fixture({'sharedJourneys/group': {...group, audienceIds: Array.from({length: 30}, (_, i) => `m${i}`)}});
  await assert.rejects(full.service.invite('group', 'friend'), code('validation')); assert.equal(full.writes.length, 0);
});

for (const state of ['invited', 'left', 'declined']) {
  test(`${state} cannot read private posts/members or mutate a journey`, async () => {
    const {service, writes} = fixture({'sharedJourneys/group/members/owner': {...member, state}});
    for (const call of [() => service.posts('group'), () => service.members('group'), () => service.updateProgress('group', 2, 'paused'),
      () => service.addPost('group', postInput), () => service.finish('group', finishInput)]) await assert.rejects(call(), code('access'));
    assert.equal(writes.length, 0);
  });
}

test('invited can see the group and own invitation, but a missing journey returns null', async () => {
  const {service} = fixture({'sharedJourneys/group/members/owner': {...member, state: 'invited'}});
  assert.equal((await service.get('group')).title, 'Uma obra'); assert.equal((await service.membership('group')).state, 'invited');
  assert.equal(await service.get('missing'), null);
});

test('nonowners cannot invite, add milestones or archive; owners cannot leave', async () => {
  const f = fixture({'sharedJourneys/group/members/owner': {...member, role: 'member'}, 'sharedJourneys/group': {...group, ownerId: 'someone'}});
  for (const action of [() => f.service.invite('group', 'friend'), () => f.service.addMilestone('group', {title: 'Marco', position: 1, meetingAt: null, question: ''}), () => f.service.archive('group')]) await assert.rejects(action(), code('access'));
  assert.equal(f.writes.length, 0); await assert.rejects(fixture().service.leave('group'), code('access'));
});

test('milestones validate positions, stay sorted and stop at twenty', async () => {
  const {service, records} = fixture();
  for (const position of [10, 2]) await service.addMilestone('group', {title: 'Marco', position, meetingAt: null, question: 'O que achou?'});
  assert.deepEqual(records.get('sharedJourneys/group').milestones.map(item => item.position), [2, 10]);
  await assert.rejects(service.addMilestone('group', {title: 'Duplicado', position: 2, meetingAt: null, question: ''}), code('validation'));
  const full = fixture({'sharedJourneys/group': {...group, milestones: Array.from({length: 20}, (_, i) => ({id: `${i}`, position: i}))}});
  await assert.rejects(full.service.addMilestone('group', {title: 'Outro', position: 30, question: '', meetingAt: null}), code('validation'));
});

test('a private post stays private by default, with no entry read/write and authenticated authorship', async () => {
  const {service, records, writes, reads} = fixture();
  await service.addPost('group', {...postInput, publishPublicly: undefined, authorId: 'forged'});
  const post = [...records.entries()].find(([path]) => path.includes('/posts/'))[1];
  assert.equal(post.authorId, 'owner'); assert.equal(post.authorName, 'Ana'); assert.equal(post.publishedPublicly, false); assert.equal(post.text, 'Minha impressão.');
  assert.ok(writes.every(write => !write.reference.path.startsWith('entries/')));
  assert.ok(reads.every(path => !path.startsWith('entries/')));
});

test('explicit publication creates only the authors reserved entry and only their note', async () => {
  const {service, records} = fixture({'sharedJourneys/group/posts/other': {authorId: 'friend', text: 'Segredo do amigo'}});
  await service.addPost('group', {...postInput, publishPublicly: true, containsSpoilers: true});
  const entry = records.get('entries/reserved');
  assert.equal(entry.authorId, 'owner'); assert.equal(entry.status, 'in_progress'); assert.equal(entry.rating, null);
  assert.equal(entry.title, group.title); assert.equal(entry.notes.length, 1); assert.equal(entry.notes[0].text, 'Minha impressão.');
  assert.equal(entry.notes[0].containsSpoilers, true); assert.equal(entry.reflection, '');
  assert.equal(JSON.stringify(entry).includes('Segredo do amigo'), false);
  for (const key of ['groupId', 'sharedJourneyId', 'memberIds', 'audienceIds']) assert.equal(Object.hasOwn(entry, key), false);
  assert.equal(records.get('sharedJourneys/group/members/owner').entryPublished, true);
});

test('public note append preserves prior private reflection and notes, and enforces 100-note capacity atomically', async () => {
  const old = {authorId: 'owner', title: 'Título editado', createdAt: 5, updatedAt: 10, reflection: 'Reflexão anterior', notes: [{id: 'old', text: 'Antiga'}]};
  const f = fixture({'entries/reserved': old}); await f.service.addPost('group', {...postInput, publishPublicly: true});
  const entry = f.records.get('entries/reserved'); assert.equal(entry.reflection, old.reflection); assert.equal(entry.createdAt, 5); assert.equal(entry.title, old.title); assert.equal(entry.notes.length, 2);
  const full = fixture({'entries/reserved': {...old, notes: Array.from({length: 100}, () => ({text: 'Antiga'}))}});
  await assert.rejects(full.service.addPost('group', {...postInput, publishPublicly: true}), code('validation'));
  assert.equal(full.writes.length, 0);
});

test('finish is individual and private unless publication is explicitly selected', async () => {
  const f = fixture(); await f.service.finish('group', {...finishInput, publishPublicly: undefined});
  const own = f.records.get('sharedJourneys/group/members/owner'); assert.equal(own.status, 'completed'); assert.equal(own.rating, 5); assert.equal(own.reflection, finishInput.reflection);
  assert.equal(f.records.has('entries/reserved'), false); assert.deepEqual(f.records.get('sharedJourneys/group').memberIds, ['owner']);
  const pub = fixture({'entries/reserved': {authorId: 'owner', createdAt: 3, reflection: 'Antes', notes: [{id: 'old', text: 'Nota'}]}});
  await pub.service.finish('group', {...finishInput, publishPublicly: true});
  const entry = pub.records.get('entries/reserved'); assert.equal(entry.status, 'completed'); assert.equal(entry.rating, 5); assert.equal(entry.createdAt, 3); assert.equal(entry.notes.length, 1); assert.equal(entry.reflection, finishInput.reflection);
});

test('a reserved public entry owned by another person blocks publication before any write', async () => {
  for (const action of [service => service.addPost('group', {...postInput, publishPublicly: true}), service => service.finish('group', {...finishInput, publishPublicly: true})]) {
    const f = fixture({'entries/reserved': {authorId: 'friend'}}); await assert.rejects(action(f.service), code('access')); assert.equal(f.writes.length, 0);
  }
});

test('archiving preserves records, forbids further group changes but allows individual finish', async () => {
  const f = fixture(); await f.service.archive('group'); assert.equal(f.records.get('sharedJourneys/group').archived, true);
  assert.equal((await f.service.get('group')).archived, true);
  await assert.rejects(f.service.addPost('group', postInput), code('access'));
  await assert.rejects(f.service.updateProgress('group', 1, 'paused'), code('access'));
  await f.service.finish('group', finishInput); assert.equal(f.records.get('sharedJourneys/group/members/owner').status, 'completed');
});

test('updated clocks advance even when the local clock moves backwards', async () => {
  const realNow = Date.now; Date.now = () => 1;
  try {
    const f = fixture(); await f.service.updateProgress('group', 1, 'paused'); await f.service.updateProgress('group', 2, 'in_progress');
    assert.equal(f.records.get('sharedJourneys/group').updatedAt, 22);
    assert.equal(f.records.get('sharedJourneys/group/members/owner').updatedAt, 22);
  } finally {Date.now = realNow;}
});

for (const [name, action] of [
  ['fractional progress', service => service.updateProgress('group', 1.5, 'paused')],
  ['negative progress', service => service.updateProgress('group', -1, 'paused')],
  ['excess progress', service => service.updateProgress('group', 1000001, 'paused')],
  ['completion through progress', service => service.updateProgress('group', 1, 'completed')],
  ['unknown status', service => service.updateProgress('group', 1, 'other')],
  ['bad create category', service => service.create({...createInput, category: 'other'})],
  ['bad create pace', service => service.create({...createInput, pace: 'other'})],
  ['bad create unit', service => service.create({...createInput, unit: 'other'})],
  ['long create title', service => service.create({...createInput, title: 'a'.repeat(161)})],
  ['long description', service => service.create({...createInput, description: 'a'.repeat(1001)})],
  ['empty post', service => service.addPost('group', {...postInput, text: ' '})],
  ['long post', service => service.addPost('group', {...postInput, text: 'a'.repeat(1001)})],
  ['bad post kind', service => service.addPost('group', {...postInput, kind: 'other'})],
  ['bad post spoilers', service => service.addPost('group', {...postInput, containsSpoilers: 'false'})],
  ['bad post publication', service => service.addPost('group', {...postInput, publishPublicly: 'true'})],
  ['bad post progress', service => service.addPost('group', {...postInput, progress: -1})],
  ['bad rating', service => service.finish('group', {...finishInput, rating: 0})],
  ['fractional rating', service => service.finish('group', {...finishInput, rating: 3.5})],
  ['long reflection', service => service.finish('group', {...finishInput, reflection: 'a'.repeat(3001)})],
  ['long milestone title', service => service.addMilestone('group', {title: 'a'.repeat(121), position: 1, meetingAt: null, question: ''})],
  ['long milestone question', service => service.addMilestone('group', {title: 'A', position: 1, meetingAt: null, question: 'a'.repeat(501)})],
  ['invalid milestone date', service => service.addMilestone('group', {title: 'A', position: 1, meetingAt: NaN, question: ''})],
]) {
  test(`${name} is rejected before any mutation`, async () => {
    const f = fixture(); await assert.rejects(action(f.service), code('validation')); assert.equal(f.writes.length, 0);
  });
}

test('list and posts use a lookahead document and stable cursor pagination', async () => {
  const extra = {};
  for (let i = 0; i < 25; i++) {
    extra[`sharedJourneys/g${String(i).padStart(2, '0')}`] = {...group, updatedAt: 100};
    extra[`sharedJourneys/group/posts/p${String(i).padStart(2, '0')}`] = {authorId: 'owner', createdAt: 100, text: `${i}`};
  }
  const f = fixture(extra);
  const first = await f.service.list(); assert.equal(first.items.length, 20); assert.equal(first.hasMore, true);
  const second = await f.service.list(first.cursor); assert.equal(second.items.length, 6); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 26);
  const p1 = await f.service.posts('group'), p2 = await f.service.posts('group', p1.cursor);
  assert.equal(p1.items.length, 20); assert.equal(p2.items.length, 5);
  assert.equal(new Set([...p1.items, ...p2.items].map(item => item.id)).size, 25);
});

test('a gate disabled after the initial check is rechecked inside the write transaction', async () => {
  const f = fixture();
  f.beforeTransaction(records => records.set('appConfig/sharedJourneys', {enabled: false, rulesVersion: 1}));
  await assert.rejects(f.service.addPost('group', postInput), code('disabled'));
  assert.equal(f.writes.length, 0);
});

test('the service cannot read or write another member simply by adding a forged input uid', async () => {
  const f = fixture();
  await f.service.updateProgress('group', 3, 'paused', 'friend');
  const memberWrites = f.writes.filter(write => write.reference.path.includes('/members/'));
  assert.deepEqual(memberWrites.map(write => write.reference.path), ['sharedJourneys/group/members/owner']);
});

test('an active nonowner can leave an archived group without deleting its contributions', async () => {
  const f = fixture({
    'sharedJourneys/group': {...group, archived: true, memberIds: ['owner', 'friend'], audienceIds: ['owner', 'friend']},
    'sharedJourneys/group/members/friend': {...member, uid: 'friend', role: 'member', entryId: 'friends-entry'},
    'sharedJourneys/group/posts/old': {authorId: 'friend', text: 'Minha contribuição anterior.'},
  }, 'friend');
  await f.service.leave('group');
  assert.equal(f.records.get('sharedJourneys/group/members/friend').state, 'left');
  assert.deepEqual(f.records.get('sharedJourneys/group').memberIds, ['owner']);
  assert.deepEqual(f.records.get('sharedJourneys/group').audienceIds, ['owner']);
  assert.equal(f.records.get('sharedJourneys/group/posts/old').text, 'Minha contribuição anterior.');
  const owner = fixture({'sharedJourneys/group': {...group, archived: true}});
  await assert.rejects(owner.service.leave('group'), code('access'));
});

test('member listing excludes departed invitation history before applying the thirty-person limit', async () => {
  const extra = {};
  for (let i = 0; i < 40; i++) extra[`sharedJourneys/group/members/old-${i}`] = {...member, uid: `old-${i}`, state: i % 2 ? 'left' : 'declined'};
  extra['sharedJourneys/group/members/pending'] = {...member, uid: 'pending', role: 'member', state: 'invited'};
  extra['sharedJourneys/group/members/z-active'] = {...member, uid: 'z-active', role: 'member'};
  const f = fixture(extra); const members = await f.service.members('group');
  assert.deepEqual(members.map(person => person.uid), ['owner', 'pending', 'z-active']);
  assert.deepEqual(f.queries[0].constraints, [
    {where: ['state', 'in', ['active', 'invited']]}, {orderBy: ['__name__', 'asc']}, {limit: 30},
  ]);
});

test('an archived pending invitation can be declined but cannot be accepted', async () => {
  const setup = {
    'sharedJourneys/group': {...group, archived: true, invitedIds: ['friend'], audienceIds: ['owner', 'friend']},
    'sharedJourneys/group/members/friend': {...member, uid: 'friend', role: 'member', state: 'invited', joinedAt: null, entryId: 'friends-entry'},
  };
  const accept = fixture(setup, 'friend');
  await assert.rejects(accept.service.respond('group', true), code('access'));
  assert.equal(accept.writes.length, 0);
  assert.equal(accept.records.get('sharedJourneys/group/members/friend').state, 'invited');
  const decline = fixture(setup, 'friend');
  await decline.service.respond('group', false);
  assert.equal(decline.records.get('sharedJourneys/group/members/friend').state, 'declined');
  assert.deepEqual(decline.records.get('sharedJourneys/group').invitedIds, []);
  assert.deepEqual(decline.records.get('sharedJourneys/group').audienceIds, ['owner']);
  assert.deepEqual(decline.records.get('sharedJourneys/group').memberIds, ['owner']);
  assert.equal(decline.records.get('sharedJourneys/group').archived, true);
});

test('publishing a final reflection enables spoiler protection while preserving quotation and notes', async () => {
  const previous = {authorId: 'owner', quote: 'Uma frase anterior.', notes: [{id: 'old', text: 'Minha nota.'}], containsSpoilers: false, createdAt: 5};
  const f = fixture({'entries/reserved': previous});
  await f.service.finish('group', {...finishInput, publishPublicly: true});
  const saved = f.records.get('entries/reserved');
  assert.equal(saved.containsSpoilers, true);
  assert.equal(saved.reflection, finishInput.reflection);
  assert.equal(saved.quote, previous.quote);
  assert.deepEqual(saved.notes, previous.notes);
  for (const flag of [true, false]) {
    const empty = fixture({'entries/reserved': {...previous, containsSpoilers: flag}});
    await empty.service.finish('group', {...finishInput, reflection: '   ', publishPublicly: true});
    assert.equal(empty.records.get('entries/reserved').containsSpoilers, flag);
  }
  const privateFinish = fixture({'entries/reserved': previous});
  await privateFinish.service.finish('group', finishInput);
  assert.deepEqual(privateFinish.records.get('entries/reserved'), previous);
  assert.ok(privateFinish.writes.every(write => !write.reference.path.startsWith('entries/')));
});
