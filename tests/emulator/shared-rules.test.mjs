import nodeTest, {after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as firestoreSdk from 'firebase/firestore';
import {initializeApp, deleteApp} from 'firebase/app';
import {getFirestore, connectFirestoreEmulator, doc, collection, collectionGroup, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, query, where, orderBy, limit, terminate, setLogLevel} from 'firebase/firestore';

const project = 'demo-vaultlog-shared';
const test = (name, work) => nodeTest(name, {timeout: 60000}, work);
setLogLevel('silent');
const endpoint = process.env.FIRESTORE_EMULATOR_HOST;
assert.equal(endpoint, '127.0.0.1:8089', 'Run only through firebase.shared-test.json against the isolated demo emulator');
const clients = new Map();
function dbFor(uid = null) {
  const key = uid ?? 'anonymous';
  if (!clients.has(key)) {
    const app = initializeApp({projectId: project, apiKey: 'demo-key', appId: 'demo-app'}, `shared-rules-${key}`);
    const db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', 8089, uid ? {mockUserToken: {sub: uid, user_id: uid, email: `${uid}@example.test`}} : {});
    clients.set(key, {app, db});
  }
  return clients.get(key).db;
}
function encode(value) {
  if (value === null) return {nullValue: null};
  if (typeof value === 'string') return {stringValue: value};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number') return Number.isInteger(value) ? {integerValue: String(value)} : {doubleValue: value};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(encode)}};
  return {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]))}};
}
async function adminSeed(path, data) {
  const response = await fetch(`http://${endpoint}/v1/projects/${project}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: {'Authorization': 'Bearer owner', 'Content-Type': 'application/json'},
    body: JSON.stringify({fields: encode(data).mapValue.fields}),
  });
  assert.equal(response.ok, true, await response.text());
}
async function denied(work) {
  await assert.rejects(work, error => error.code === 'permission-denied', 'Firestore rules must reject the operation');
}
const groupPath = id => `sharedJourneys/${id}`;
const memberPath = (id, person) => `${groupPath(id)}/members/${person}`;
const postPath = (id, post = 'private-post') => `${groupPath(id)}/posts/${post}`;
const groupData = (ownerId = 'owner') => ({
  ownerId, ownerName: 'Pessoa criadora', title: 'Um livro em companhia', category: 'livro', description: 'Uma jornada privada',
  pace: 'milestones', unit: 'capitulo', memberIds: [ownerId], invitedIds: [], audienceIds: [ownerId], milestones: [],
  archived: false, createdAt: 100, updatedAt: 100,
});
const memberData = (person, {owner = false, state = 'invited', now = 100} = {}) => ({
  uid: person, displayName: `Pessoa ${person}`, photoURL: '', role: owner ? 'owner' : 'member', state,
  progress: 0, status: 'in_progress', entryId: `entry-${person}`, entryPublished: false, rating: null, reflection: '',
  joinedAt: state === 'active' ? now : null, invitedAt: now, updatedAt: now,
});
const postData = (authorId = 'owner') => ({authorId, authorName: 'Pessoa autora', text: 'Uma impressão só para a jornada', kind: 'note', progress: 4, containsSpoilers: true, publishedPublicly: false, createdAt: 110});
async function createGroup(id = 'journey', person = 'owner') {
  const db = dbFor(person), batch = writeBatch(db);
  batch.set(doc(db, groupPath(id)), groupData(person));
  batch.set(doc(db, memberPath(id, person)), memberData(person, {owner: true, state: 'active'}));
  await batch.commit();
  return db;
}
async function invite(person = 'guest', id = 'journey', actor = 'owner') {
  const db = dbFor(actor);
  await runTransaction(db, async tx => {
    const groupRef = doc(db, groupPath(id)), memberRef = doc(db, memberPath(id, person));
    const group = (await tx.get(groupRef)).data();
    const existing = await tx.get(memberRef);
    if (existing.exists()) tx.update(memberRef, {state: 'invited', invitedAt: 200, updatedAt: 200});
    else tx.set(memberRef, memberData(person));
    tx.update(groupRef, {invitedIds: [...group.invitedIds, person], audienceIds: [...group.audienceIds, person], updatedAt: group.updatedAt + 1});
  });
}
async function respond(person = 'guest', accept = true, id = 'journey') {
  const db = dbFor(person);
  await runTransaction(db, async tx => {
    const groupRef = doc(db, groupPath(id)), memberRef = doc(db, memberPath(id, person));
    const group = (await tx.get(groupRef)).data(), member = (await tx.get(memberRef)).data();
    tx.update(memberRef, {state: accept ? 'active' : 'declined', joinedAt: accept ? member.updatedAt + 1 : member.joinedAt, updatedAt: member.updatedAt + 1});
    tx.update(groupRef, {
      invitedIds: group.invitedIds.filter(uid => uid !== person),
      memberIds: accept ? [...group.memberIds, person] : group.memberIds,
      audienceIds: accept ? group.audienceIds : group.audienceIds.filter(uid => uid !== person), updatedAt: group.updatedAt + 1,
    });
  });
}
async function leave(person = 'guest', id = 'journey') {
  const db = dbFor(person);
  await runTransaction(db, async tx => {
    const ref = doc(db, groupPath(id)), memberRef = doc(db, memberPath(id, person));
    const group = (await tx.get(ref)).data(), member = (await tx.get(memberRef)).data();
    tx.update(memberRef, {state: 'left', updatedAt: member.updatedAt + 1});
    tx.update(ref, {memberIds: group.memberIds.filter(uid => uid !== person), invitedIds: group.invitedIds.filter(uid => uid !== person), audienceIds: group.audienceIds.filter(uid => uid !== person), updatedAt: group.updatedAt + 1});
  });
}
async function activeGuest() {await createGroup(); await invite(); await respond();}

const sources = {};
for (const name of ['models', 'shared-models', 'shared-journey.service']) {
  sources[name] = ts.transpileModule(await readFile(new URL(`../../src/app/core/${name}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
  }).outputText;
}
function realService(person) {
  const db = dbFor(person), cache = {};
  const modules = {
    '@angular/core': {Injectable: () => value => value,
      inject: token => token === 'db' ? db : token === 'auth' ? {requireUser: () => ({uid: person})} : {},
      runInInjectionContext: (_context, work) => work()},
    '@angular/fire/firestore': {...firestoreSdk, Firestore: 'db'},
    './auth.service': {AuthService: 'auth', validUid: value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') && !['.', '..'].includes(value)},
  };
  function load(name) {
    if (modules[name]) return modules[name];
    const key = name.replace('./', '');
    assert.ok(sources[key], `Unexpected service import: ${name}`);
    if (!cache[key]) {
      cache[key] = {};
      new Function('exports', 'require', sources[key])(cache[key], load);
    }
    return cache[key];
  }
  return new (load('./shared-journey.service').SharedJourneyService)();
}

async function closeClients() {
  await Promise.all([...clients.values()].map(async ({db, app}) => {await terminate(db); await deleteApp(app);}));
  clients.clear();
}
beforeEach(async () => {
  await closeClients();
  const response = await fetch(`http://${endpoint}/emulator/v1/projects/${project}/databases/(default)/documents`, {method: 'DELETE', headers: {Authorization: 'Bearer owner'}});
  assert.equal(response.ok, true, await response.text());
  await adminSeed('appConfig/sharedJourneys', {enabled: true, rulesVersion: 1});
});
after(closeClients);

test('base profiles stay public while identity and creation date remain owned', async () => {
  const owner = dbFor('owner'), stranger = dbFor('stranger'), anonymous = dbFor();
  await setDoc(doc(owner, 'users/owner'), {uid: 'owner', displayName: 'Ana', createdAt: 100});
  assert.equal((await getDoc(doc(anonymous, 'users/owner'))).data().displayName, 'Ana');
  await updateDoc(doc(owner, 'users/owner'), {displayName: 'Ana Maria'});
  await denied(updateDoc(doc(stranger, 'users/owner'), {displayName: 'Impostora'}));
  await denied(updateDoc(doc(owner, 'users/owner'), {uid: 'stranger'}));
  await denied(updateDoc(doc(owner, 'users/owner'), {createdAt: 200}));
  await denied(setDoc(doc(stranger, 'users/owner2'), {uid: 'owner2', createdAt: 100}));
});

test('base queue and following remain private even when profiles are public', async () => {
  const owner = dbFor('owner');
  for (const path of ['users/owner/queue/queued', 'users/owner/following/friend']) {
    await setDoc(doc(owner, path), {title: 'Privado'});
    await getDoc(doc(owner, path));
    await denied(getDoc(doc(dbFor('stranger'), path)));
    await denied(getDoc(doc(dbFor(), path)));
    await denied(updateDoc(doc(dbFor('stranger'), path), {title: 'Invasão'}));
  }
});

test('base entries allow public legacy reads and author CRUD without transferring authorship', async () => {
  const owner = dbFor('owner'), ref = doc(owner, 'entries/legacy');
  await setDoc(ref, {authorId: 'owner', author: {displayName: 'Ana'}, title: 'Legado', createdAt: 100});
  assert.equal((await getDoc(doc(dbFor(), 'entries/legacy'))).data().title, 'Legado');
  await updateDoc(ref, {title: 'Revisitado', author: {displayName: 'Ana Maria'}});
  await denied(updateDoc(doc(dbFor('stranger'), 'entries/legacy'), {title: 'Outro autor'}));
  await denied(updateDoc(ref, {authorId: 'stranger'}));
  await denied(updateDoc(ref, {createdAt: 200}));
  await denied(deleteDoc(doc(dbFor('stranger'), 'entries/legacy')));
  await deleteDoc(ref);
});

test('the availability flag is readable only to signed-in users and never writable by clients', async () => {
  await getDoc(doc(dbFor('owner'), 'appConfig/sharedJourneys'));
  await denied(getDoc(doc(dbFor(), 'appConfig/sharedJourneys')));
  await denied(getDocs(collection(dbFor('owner'), 'appConfig')));
  await denied(updateDoc(doc(dbFor('owner'), 'appConfig/sharedJourneys'), {enabled: false}));
});

test('a shared journey and its active owner member must be created atomically', async () => {
  const db = await createGroup();
  assert.equal((await getDoc(doc(db, groupPath('journey')))).data().ownerId, 'owner');
  await denied(setDoc(doc(db, groupPath('missing-member')), groupData()));
  await denied(setDoc(doc(db, memberPath('missing-group', 'owner')), memberData('owner', {owner: true, state: 'active'})));
  await denied(createGroup('anonymous-group', null));
});

test('a group cannot be created with pre-accepted people or a forged owner role', async () => {
  const db = dbFor('owner');
  const batch = writeBatch(db);
  batch.set(doc(db, groupPath('forged')), {...groupData(), memberIds: ['owner', 'guest'], audienceIds: ['owner', 'guest']});
  batch.set(doc(db, memberPath('forged', 'owner')), memberData('owner', {owner: true, state: 'active'}));
  await denied(batch.commit());
  const noOwner = writeBatch(db);
  noOwner.set(doc(db, groupPath('no-owner')), groupData());
  noOwner.set(doc(db, memberPath('no-owner', 'owner')), memberData('owner', {state: 'active'}));
  await denied(noOwner.commit());
});

test('outsiders cannot read or enumerate journeys; audience queries are bounded to 21', async () => {
  await createGroup(); await invite();
  const stranger = dbFor('stranger'), guest = dbFor('guest');
  await denied(getDoc(doc(stranger, groupPath('journey'))));
  await denied(getDoc(doc(dbFor(), groupPath('journey'))));
  await denied(getDocs(collection(stranger, 'sharedJourneys')));
  await denied(getDocs(query(collection(guest, 'sharedJourneys'), limit(21))));
  await denied(getDocs(query(collection(guest, 'sharedJourneys'), where('audienceIds', 'array-contains', 'guest'), limit(22))));
  const groups = await getDocs(query(collection(guest, 'sharedJourneys'), where('audienceIds', 'array-contains', 'guest'), orderBy('updatedAt', 'desc'), limit(21)));
  assert.deepEqual(groups.docs.map(item => item.id), ['journey']);
  assert.equal((await getDocs(query(collection(stranger, 'sharedJourneys'), where('audienceIds', 'array-contains', 'stranger'), limit(21)))).size, 0);
});

test('invited people see only the group and their own invitation, not private members or posts', async () => {
  const owner = await createGroup(); await invite();
  await setDoc(doc(owner, postPath('journey')), postData());
  const guest = dbFor('guest');
  await getDoc(doc(guest, groupPath('journey')));
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().state, 'invited');
  await denied(getDoc(doc(guest, memberPath('journey', 'owner'))));
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/members')));
  await denied(getDoc(doc(guest, postPath('journey'))));
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/posts')));
  await denied(setDoc(doc(guest, postPath('journey', 'guest-post')), postData('guest')));
});

test('acceptance changes only the invited person and immediately unlocks private posts', async () => {
  await createGroup(); await invite();
  await setDoc(doc(dbFor('owner'), postPath('journey')), postData());
  await respond();
  const guest = dbFor('guest');
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().state, 'active');
  assert.equal((await getDoc(doc(guest, postPath('journey')))).data().text, postData().text);
  assert.equal((await getDocs(collection(guest, 'sharedJourneys/journey/members'))).size, 2);
  await setDoc(doc(guest, postPath('journey', 'guest-post')), postData('guest'));
});

test('neither the owner nor the invited person can accept without matching membership arrays', async () => {
  await createGroup(); await invite();
  const guest = dbFor('guest'), owner = dbFor('owner');
  await denied(updateDoc(doc(guest, memberPath('journey', 'guest')), {state: 'active', joinedAt: 101, updatedAt: 101}));
  await denied(updateDoc(doc(guest, groupPath('journey')), {memberIds: ['owner', 'guest'], invitedIds: [], updatedAt: 102}));
  const forced = writeBatch(owner);
  forced.update(doc(owner, memberPath('journey', 'guest')), {state: 'active', joinedAt: 101, updatedAt: 101});
  forced.update(doc(owner, groupPath('journey')), {memberIds: ['owner', 'guest'], invitedIds: [], updatedAt: 102});
  await denied(forced.commit());
});

test('outsiders cannot auto-join, and invite acceptance cannot add a second person', async () => {
  await createGroup(); await invite();
  const outsider = dbFor('stranger'), batch = writeBatch(outsider);
  batch.set(doc(outsider, memberPath('journey', 'stranger')), memberData('stranger', {state: 'active'}));
  batch.update(doc(outsider, groupPath('journey')), {memberIds: ['owner', 'stranger'], audienceIds: ['owner', 'guest', 'stranger'], updatedAt: 103});
  await denied(batch.commit());
  const guest = dbFor('guest'), escalation = writeBatch(guest);
  escalation.update(doc(guest, memberPath('journey', 'guest')), {state: 'active', joinedAt: 101, updatedAt: 101});
  escalation.update(doc(guest, groupPath('journey')), {memberIds: ['owner', 'guest', 'stranger'], invitedIds: [], audienceIds: ['owner', 'guest', 'stranger'], updatedAt: 103});
  await denied(escalation.commit());
});

test('declining removes the invitation and group access but preserves access to the own membership', async () => {
  await createGroup(); await invite(); await respond('guest', false);
  const guest = dbFor('guest');
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().state, 'declined');
  await denied(getDoc(doc(guest, groupPath('journey'))));
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/posts')));
  await denied(updateDoc(doc(guest, memberPath('journey', 'guest')), {state: 'active', updatedAt: 102}));
});

test('leaving removes private access, and re-invitation never forces re-acceptance', async () => {
  await activeGuest(); await leave();
  const guest = dbFor('guest');
  const previous = (await getDoc(doc(guest, memberPath('journey', 'guest')))).data();
  assert.equal(previous.state, 'left');
  await denied(getDoc(doc(guest, groupPath('journey'))));
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/posts')));
  await invite();
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().state, 'invited');
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/posts')));
  await respond();
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().entryId, previous.entryId);
});

test('the owner remains active and cannot leave or silently remove another member', async () => {
  await activeGuest();
  await denied(leave('owner'));
  const db = dbFor('owner'), removal = writeBatch(db);
  removal.update(doc(db, memberPath('journey', 'guest')), {state: 'left', updatedAt: 200});
  removal.update(doc(db, groupPath('journey')), {memberIds: ['owner'], audienceIds: ['owner'], updatedAt: 200});
  await denied(removal.commit());
});

test('only the owner invites, and each invitation must add exactly one pending member atomically', async () => {
  await activeGuest();
  await denied(invite('third', 'journey', 'guest'));
  const db = dbFor('owner');
  await denied(updateDoc(doc(db, groupPath('journey')), {invitedIds: ['third'], audienceIds: ['owner', 'guest', 'third'], updatedAt: 200}));
  const multiple = writeBatch(db);
  for (const person of ['third', 'fourth']) multiple.set(doc(db, memberPath('journey', person)), memberData(person));
  multiple.update(doc(db, groupPath('journey')), {invitedIds: ['third', 'fourth'], audienceIds: ['owner', 'guest', 'third', 'fourth'], updatedAt: 200});
  await denied(multiple.commit());
  await invite('third');
});

test('member progress and assessment belong only to that member; role and entry identity are immutable', async () => {
  await activeGuest();
  const guest = dbFor('guest'), own = doc(guest, memberPath('journey', 'guest'));
  await updateDoc(own, {progress: 8, status: 'paused', rating: 4, reflection: 'Minha impressão', updatedAt: 200});
  await denied(updateDoc(doc(dbFor('owner'), memberPath('journey', 'guest')), {progress: 9, updatedAt: 201}));
  await denied(updateDoc(doc(guest, memberPath('journey', 'owner')), {reflection: 'Controlando outra pessoa', updatedAt: 201}));
  for (const patch of [{role: 'owner'}, {uid: 'owner'}, {entryId: 'someone-elses-entry'}, {joinedAt: 999}, {progress: -1}, {progress: 1.5}, {progress: 1000001}, {rating: 6}, {reflection: 'x'.repeat(3001)}]) {
    await denied(updateDoc(own, {...patch, updatedAt: 201}));
  }
});

test('active members can touch recency but only the owner controls schedule, metadata and archive', async () => {
  await activeGuest();
  const guest = dbFor('guest'), owner = dbFor('owner');
  await updateDoc(doc(guest, groupPath('journey')), {updatedAt: 200});
  const milestone = {id: 'chapter-4', title: 'Primeiro encontro', position: 4, meetingAt: 10000, question: 'O que chamou atenção?'};
  for (const patch of [{title: 'Tomando controle'}, {milestones: [milestone]}, {pace: 'free'}, {unit: 'pagina'}, {archived: true}, {ownerId: 'guest'}, {createdAt: 1}]) {
    await denied(updateDoc(doc(guest, groupPath('journey')), {...patch, updatedAt: 201}));
  }
  await updateDoc(doc(owner, groupPath('journey')), {milestones: [milestone], updatedAt: 201});
  await denied(updateDoc(doc(owner, groupPath('journey')), {ownerId: 'guest', updatedAt: 202}));
  await denied(updateDoc(doc(owner, groupPath('journey')), {memberIds: ['guest'], audienceIds: ['guest'], updatedAt: 202}));
});

test('bounded group schemas reject unknown fields, excessive milestones and invalid membership unions', async () => {
  const db = await createGroup();
  const milestone = {id: 'one', title: 'Um marco', position: 1, meetingAt: null, question: ''};
  for (const patch of [
    {description: 'x'.repeat(1001)}, {title: ''}, {category: 'unknown'}, {unit: 'unknown'}, {pace: 'unknown'},
    {privateBackdoor: true}, {audienceIds: ['owner', 'owner']}, {audienceIds: ['owner', 'stranger']},
    {memberIds: ['owner', 'owner']}, {invitedIds: ['owner']},
    {milestones: Array.from({length: 21}, (_, i) => ({...milestone, id: `m-${i}`, position: i}))},
    {milestones: [{...milestone, question: 'x'.repeat(501)}]}, {milestones: [{...milestone, extra: 'not allowed'}]},
  ]) await denied(updateDoc(doc(db, groupPath('journey')), {...patch, updatedAt: 200}));
  const milestones = [];
  for (let i = 0; i < 20; i++) {
    milestones.push({...milestone, id: `m-${i}`, position: i});
    await updateDoc(doc(db, groupPath('journey')), {milestones: [...milestones], updatedAt: 200 + i});
  }
  // Recency/progress touches must still work at the maximum schedule size.
  await updateDoc(doc(db, groupPath('journey')), {updatedAt: 300});
  await invite();
  await respond();
});

test('the total audience cannot exceed thirty active people and pending invitations', async () => {
  await createGroup();
  const invitedIds = Array.from({length: 29}, (_, i) => `pending-${i}`);
  await adminSeed(groupPath('journey'), {...groupData(), invitedIds, audienceIds: ['owner', ...invitedIds]});
  await denied(invite('one-too-many'));
});

test('private posts have a strict schema, immutable author and no anonymous or collection-group leak', async () => {
  await activeGuest();
  const guest = dbFor('guest'), ref = doc(guest, postPath('journey', 'guest-note'));
  await setDoc(ref, postData('guest'));
  await denied(updateDoc(ref, {text: 'Alterado'}));
  await denied(deleteDoc(ref));
  await denied(getDoc(doc(dbFor(), postPath('journey', 'guest-note'))));
  await denied(getDocs(collectionGroup(dbFor(), 'posts')));
  await denied(getDocs(collectionGroup(dbFor('stranger'), 'posts')));
  assert.equal((await getDoc(doc(dbFor(), 'entries/entry-guest'))).exists(), false);
  assert.equal((await getDocs(collection(dbFor(), 'entries'))).size, 0);
  for (const patch of [{authorId: 'owner'}, {text: ''}, {text: 'x'.repeat(1001)}, {kind: 'broadcast'}, {progress: -1}, {progress: 0.5}, {progress: 1000001}, {containsSpoilers: 'true'}, {publishedPublicly: 'true'}, {extra: true}]) {
    await denied(setDoc(doc(guest, postPath('journey', 'invalid')), {...postData('guest'), ...patch}));
  }
});

test('explicit own publication creates only the chosen post and never copies a different private post', async () => {
  await activeGuest();
  const db = dbFor('guest');
  await setDoc(doc(db, postPath('journey', 'private')), postData('guest'));
  const batch = writeBatch(db);
  batch.set(doc(db, postPath('journey', 'public')), {...postData('guest'), text: 'Texto escolhido', publishedPublicly: true});
  batch.set(doc(db, 'entries/entry-guest'), {authorId: 'guest', title: 'Um livro em companhia', quote: '', notes: [{id: 'public', text: 'Texto escolhido'}], createdAt: 200});
  batch.update(doc(db, memberPath('journey', 'guest')), {entryPublished: true, updatedAt: 200});
  batch.update(doc(db, groupPath('journey')), {updatedAt: 200});
  await batch.commit();
  const published = (await getDoc(doc(dbFor(), 'entries/entry-guest'))).data();
  assert.deepEqual(published.notes.map(note => note.text), ['Texto escolhido']);
  await denied(getDoc(doc(dbFor(), postPath('journey', 'private'))));
  await denied(updateDoc(doc(db, memberPath('journey', 'guest')), {entryPublished: false, updatedAt: 201}));
});

test('publication flags require an actual own public entry and cannot fabricate publication', async () => {
  await activeGuest();
  const db = dbFor('guest');
  await denied(updateDoc(doc(db, memberPath('journey', 'guest')), {entryPublished: true, updatedAt: 200}));
  await denied(setDoc(doc(db, postPath('journey', 'fake-public')), {...postData('guest'), publishedPublicly: true}));
  await adminSeed('entries/entry-guest', {authorId: 'owner', title: 'Registro de outra pessoa', createdAt: 100});
  await denied(updateDoc(doc(db, memberPath('journey', 'guest')), {entryPublished: true, updatedAt: 200}));
});

test('archived journeys remain readable but block progress, posts and invitations while allowing own finish', async () => {
  await activeGuest();
  await updateDoc(doc(dbFor('owner'), groupPath('journey')), {archived: true, updatedAt: 200});
  const guest = dbFor('guest');
  await getDoc(doc(guest, groupPath('journey')));
  await getDocs(collection(guest, 'sharedJourneys/journey/posts'));
  await denied(updateDoc(doc(guest, memberPath('journey', 'guest')), {progress: 50, updatedAt: 201}));
  await denied(setDoc(doc(guest, postPath('journey')), postData('guest')));
  await denied(invite('third'));
  await denied(leave('owner'));
  await denied(updateDoc(doc(dbFor('owner'), groupPath('journey')), {archived: false, updatedAt: 201}));
  const finish = writeBatch(guest);
  finish.update(doc(guest, memberPath('journey', 'guest')), {status: 'completed', rating: 5, reflection: 'Uma experiência minha', updatedAt: 201});
  finish.update(doc(guest, groupPath('journey')), {updatedAt: 201});
  await finish.commit();
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().rating, 5);
});

test('an active non-owner can leave an archived journey atomically without retaining private access', async () => {
  await activeGuest();
  await updateDoc(doc(dbFor('owner'), groupPath('journey')), {archived: true, updatedAt: 200});
  const guest = dbFor('guest');
  await denied(updateDoc(doc(guest, memberPath('journey', 'guest')), {state: 'left', updatedAt: 201}));
  await leave();
  assert.equal((await getDoc(doc(guest, memberPath('journey', 'guest')))).data().state, 'left');
  await denied(getDoc(doc(guest, groupPath('journey'))));
  await denied(getDocs(collection(guest, 'sharedJourneys/journey/posts')));
  await denied(leave('owner'));
  assert.deepEqual((await getDoc(doc(dbFor('owner'), groupPath('journey')))).data().memberIds, ['owner']);
});

test('pending invitations can be declined after archive but cannot be accepted', async () => {
  await createGroup(); await invite();
  await updateDoc(doc(dbFor('owner'), groupPath('journey')), {archived: true, updatedAt: 200});
  await denied(respond('guest', true));
  await respond('guest', false);
  const db = dbFor('guest');
  assert.equal((await getDoc(doc(db, memberPath('journey', 'guest')))).data().state, 'declined');
  await denied(getDoc(doc(db, groupPath('journey'))));
  await denied(getDocs(collection(db, 'sharedJourneys/journey/posts')));
  assert.deepEqual((await getDoc(doc(dbFor('owner'), groupPath('journey')))).data().audienceIds, ['owner']);
});

for (const config of [{enabled: false, rulesVersion: 1}, {enabled: true, rulesVersion: 2}, {enabled: true}]) {
  test(`the configuration gate blocks shared operations with ${JSON.stringify(config)}`, async () => {
    const db = await createGroup();
    // PATCH replaces the document fields so a missing version really is absent.
    await fetch(`http://${endpoint}/v1/projects/${project}/databases/(default)/documents/appConfig/sharedJourneys`, {method: 'DELETE', headers: {Authorization: 'Bearer owner'}});
    await adminSeed('appConfig/sharedJourneys', config);
    await denied(getDoc(doc(db, groupPath('journey'))));
    await denied(updateDoc(doc(db, groupPath('journey')), {updatedAt: 200}));
    await denied(setDoc(doc(db, postPath('journey')), postData()));
    await denied(createGroup('disabled-create'));
    await setDoc(doc(db, 'entries/personal-still-works'), {authorId: 'owner', title: 'Individual', createdAt: 200});
  });
}

test('the real SharedJourneyService completes the cooperative workflow against actual emulator rules', async () => {
  for (const person of ['owner', 'guest']) {
    await setDoc(doc(dbFor(person), `users/${person}`), {uid: person, displayName: `Pessoa ${person}`, photoURL: '', createdAt: 100});
  }
  const owner = realService('owner'), guest = realService('guest');
  console.info('SDK stage: create');
  const id = await owner.create({title: 'Uma leitura conjunta', category: 'livro', description: 'Somente para participantes', pace: 'milestones', unit: 'capitulo'});
  await owner.invite(id, 'guest');
  console.info('SDK stage: invited');
  assert.equal((await guest.membership(id)).state, 'invited');
  assert.equal((await guest.get(id)).title, 'Uma leitura conjunta');
  await assert.rejects(guest.posts(id), error => error.code === 'vaultlog/shared-access');
  await guest.respond(id, true);
  console.info('SDK stage: accepted');
  await guest.updateProgress(id, 8, 'paused');
  await owner.addMilestone(id, {title: 'Conversar sobre o início', position: 10, meetingAt: Date.now() + 86400000, question: 'O que chamou atenção?'});
  console.info('SDK stage: milestone');
  const privateText = 'Minha nota permanece somente na jornada.';
  await guest.addPost(id, {text: privateText, kind: 'note', progress: 8, containsSpoilers: true, publishPublicly: false});
  console.info('SDK stage: private-post');
  const ownMember = await guest.membership(id);
  assert.equal((await getDoc(doc(dbFor(), `entries/${ownMember.entryId}`))).exists(), false);
  console.info('SDK stage: anonymous-entry-read');
  assert.equal((await owner.posts(id)).items[0].text, privateText);
  await guest.addPost(id, {text: 'Esta impressão eu escolhi publicar.', kind: 'question', progress: 8, containsSpoilers: false, publishPublicly: true});
  console.info('SDK stage: public-post');
  let publicEntry = (await getDoc(doc(dbFor(), `entries/${ownMember.entryId}`))).data();
  assert.deepEqual(publicEntry.notes.map(note => note.text), ['Esta impressão eu escolhi publicar.']);
  assert.equal(JSON.stringify(publicEntry).includes(privateText), false);
  await guest.finish(id, {rating: 4, reflection: 'Meu balanço reservado.', publishPublicly: false});
  console.info('SDK stage: finish-private');
  assert.equal((await guest.membership(id)).status, 'completed');
  publicEntry = (await getDoc(doc(dbFor(), `entries/${ownMember.entryId}`))).data();
  assert.equal(publicEntry.reflection, '', 'a private finish cannot silently change the public entry');
  await guest.finish(id, {rating: 4, reflection: 'Meu balanço público.', publishPublicly: true});
  console.info('SDK stage: finish-public');
  assert.equal((await getDoc(doc(dbFor(), `entries/${ownMember.entryId}`))).data().reflection, 'Meu balanço público.');
  await owner.finish(id, {rating: 5, reflection: 'Primeiro balanço privado.', publishPublicly: false});
  const ownerMember = await owner.membership(id);
  assert.equal((await getDoc(doc(dbFor(), `entries/${ownerMember.entryId}`))).exists(), false);
  await owner.finish(id, {rating: 5, reflection: 'Meu balanço compartilhado.', publishPublicly: true});
  assert.equal((await owner.members(id)).length, 2);
  assert.equal((await guest.list()).items[0].id, id);
  await owner.archive(id);
  console.info('SDK stage: archive');
  await guest.finish(id, {rating: 5, reflection: 'Reflexão após arquivar.', publishPublicly: false});
  await guest.leave(id);
  console.info('SDK stage: left');
  assert.equal((await guest.membership(id)).state, 'left');
  assert.equal((await guest.list()).items.length, 0);
  assert.deepEqual((await owner.members(id)).map(member => member.uid), ['owner']);
  await denied(getDoc(doc(dbFor('guest'), postPath(id, (await owner.posts(id)).items[0].id))));
});

test('the real SharedJourneyService respects the disabled gate without publishing existing private content', async () => {
  await setDoc(doc(dbFor('owner'), 'users/owner'), {uid: 'owner', displayName: 'Ana', photoURL: '', createdAt: 100});
  const service = realService('owner');
  const id = await service.create({title: 'Jornada reservada', category: 'filme', description: '', pace: 'free', unit: 'sessao'});
  await service.addPost(id, {text: 'Não publicar.', kind: 'session', progress: null, containsSpoilers: false, publishPublicly: false});
  const member = await service.membership(id);
  await adminSeed('appConfig/sharedJourneys', {enabled: false, rulesVersion: 1});
  await assert.rejects(service.addPost(id, {text: 'Nova publicação', kind: 'note', progress: null, containsSpoilers: false, publishPublicly: true}), error => error.code === 'vaultlog/shared-disabled');
  await assert.rejects(service.list(), error => error.code === 'vaultlog/shared-disabled');
  await denied(getDoc(doc(dbFor('owner'), groupPath(id))));
  assert.equal((await getDoc(doc(dbFor(), `entries/${member.entryId}`))).exists(), false);
});

test('the real service lets an invited person decline an archived group while blocking acceptance', async () => {
  for (const person of ['owner', 'guest']) {
    await setDoc(doc(dbFor(person), `users/${person}`), {uid: person, displayName: `Pessoa ${person}`, photoURL: '', createdAt: 100});
  }
  const owner = realService('owner'), guest = realService('guest');
  const id = await owner.create({title: 'Convite pendente', category: 'livro', description: '', pace: 'free', unit: 'capitulo'});
  await owner.invite(id, 'guest');
  await owner.archive(id);
  await assert.rejects(guest.respond(id, true), error => error.code === 'vaultlog/shared-access');
  assert.equal((await guest.membership(id)).state, 'invited');
  await guest.respond(id, false);
  assert.equal((await guest.membership(id)).state, 'declined');
  assert.equal((await guest.list()).items.length, 0);
  assert.deepEqual((await owner.get(id)).audienceIds, ['owner']);
});
