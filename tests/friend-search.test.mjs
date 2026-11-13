import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(path, modules) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exports = {};
  const code = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  }}).outputText;
  new Function('require', 'exports', code)(name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
function signal(value) {
  const read = () => value;
  read.set = next => {value = next;};
  read.update = change => {value = change(value);};
  return read;
}
const decorate = () => value => value;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};};

async function serviceHarness({docs = [], user = {uid: 'me'}, failure} = {}) {
  const queries = [];
  const auth = {requireUser() {if (!user) throw new Error('Entre com sua conta'); return user;}};
  const constraint = kind => (...args) => ({kind, args});
  const sdk = Object.fromEntries(['collection', 'where', 'and', 'or', 'orderBy', 'startAfter', 'limit'].map(name => [name, constraint(name)]));
  const {DataService} = await load('src/app/core/data.service.ts', {
    '@angular/core': {Injectable: decorate, inject: token => token === 'auth' ? auth : {}, runInInjectionContext: (_ctx, work) => work()},
    '@angular/fire/firestore': {...sdk, Firestore: 'db', documentId: () => '__name__', query: (...args) => args,
      getDocs: async query => {queries.push(query); if (failure) throw failure; return {docs, size: docs.length};}},
    './auth.service': {AuthService: 'auth'}, './models': {PAGE_SIZE: 20},
  });
  return {service: new DataService(), queries};
}
const profileDoc = (id, displayName = 'Ana') => ({id, data: () => ({displayName, bio: 'Leitora', email: 'never-return@example.com'})});

test('name search queries existing displayName with bounded prefixes and deterministic pagination', async () => {
  const {service, queries} = await serviceHarness({docs: [profileDoc('ana')]});
  const result = await service.searchProfiles('  ana   ma  ');
  assert.equal(result.items[0].displayName, 'Ana');
  assert.equal(result.items[0].uid, 'ana');
  assert.equal(result.items[0].photoURL, '');
  assert.equal(result.items[0].email, undefined);
  const clauses = queries[0].find(item => item.kind === 'or').args;
  assert.deepEqual(clauses.map(item => item.args[0].args), [
    ['displayName', '>=', 'ana ma'], ['displayName', '>=', 'ANA MA'], ['displayName', '>=', 'Ana Ma'],
  ]);
  assert.deepEqual(queries[0].filter(item => item.kind === 'orderBy').map(item => item.args), [['displayName', 'asc'], ['__name__', 'asc']]);
  assert.deepEqual(queries[0].find(item => item.kind === 'limit').args, [21]);
  assert.equal(result.hasMore, false);
});

test('search excludes self and resumes after last consumed document, keeping the extra result for next page', async () => {
  const docs = [profileDoc('me'), ...Array.from({length: 20}, (_, i) => profileDoc(`ana-${i}`))];
  const {service, queries} = await serviceHarness({docs});
  const page = await service.searchProfiles('Ana');
  assert.equal(page.items.length, 19);
  assert.equal(page.items.some(item => item.uid === 'me'), false);
  assert.equal(page.hasMore, true);
  assert.equal(page.cursor, docs[19]);
  await service.searchProfiles('Ana', page.cursor);
  assert.equal(queries[1].find(item => item.kind === 'startAfter').args[0], docs[19]);
});

test('empty results, invalid input, expired session and SDK errors stay distinct', async () => {
  const {service, queries} = await serviceHarness();
  assert.deepEqual(await service.searchProfiles('Ál'), {items: [], cursor: null, hasMore: false});
  for (const name of ['', ' ', 'a', 'a'.repeat(61)]) await assert.rejects(service.searchProfiles(name), /2 e 60/);
  assert.equal(queries.length, 1);
  const anonymous = await serviceHarness({user: null});
  await assert.rejects(anonymous.service.searchProfiles('Ana'), /Entre/);
  const failure = new Error('permission-denied');
  const broken = await serviceHarness({failure});
  await assert.rejects(broken.service.searchProfiles('Ana'), error => error === failure);
});

async function pageHarness(searchProfiles) {
  const data = {searchProfiles, following: async () => [{uid: 'ana'}], getProfile: async () => ({displayName: 'Ana'}), feedPage: async () => ({items: [], cursor: null, hasMore: false})};
  const auth = {ready: Promise.resolve()};
  const {FeedPage} = await load('src/app/pages/feed.page.ts', {
    '@angular/core': {Component: decorate, signal, inject: token => token === 'auth' ? auth : data},
    '@angular/forms': {}, '@angular/router': {}, '../core/auth.service': {AuthService: 'auth'},
    '../core/data.service': {DataService: 'data', MAX_FOLLOWING: 30}, '../core/models': {}, './entry-card': {}, './active-journeys': {},
    '../core/data-error': {dataErrorMessage: (_err, fallback) => fallback},
  });
  const page = new FeedPage();
  await tick();
  return page;
}

test('editing a name discards an older in-flight search and keeps the current search busy', async () => {
  const old = deferred(), current = deferred();
  const page = await pageHarness(name => name === 'Ana' ? old.promise : current.promise);
  assert.equal(page.followedNames()['ana'], 'Ana');
  page.friend = 'Ana'; const first = page.findFriend(); await tick();
  page.friend = 'Bia'; page.resetSearch(); const second = page.findFriend(); await tick();
  old.resolve({items: [{uid: 'ana'}], hasMore: false, cursor: 'old'}); await first;
  assert.deepEqual(page.friends(), []);
  assert.equal(page.searching(), true);
  current.resolve({items: [{uid: 'bia', displayName: 'Bia'}], hasMore: false, cursor: 'new'}); await second;
  assert.equal(page.friends()[0].displayName, 'Bia');
  assert.equal(page.searching(), false);
});

test('search failures allow retry; loading more deduplicates profiles and preserves the query', async () => {
  const calls = []; let fail = true;
  const page = await pageHarness(async (...args) => {
    calls.push(args);
    if (fail) throw new Error('offline');
    return {items: [{uid: 'ana', displayName: 'Ana'}], cursor: 'next', hasMore: true};
  });
  page.friend = 'Ana'; await page.findFriend();
  assert.match(page.friendError(), /Não foi possível buscar/);
  assert.equal(page.searched(), false);
  fail = false; await page.findFriend(); await page.findFriend(true);
  assert.equal(page.friends().length, 1);
  assert.deepEqual(calls.at(-1), ['Ana', 'next']);
  page.friend = 'a'; page.resetSearch(); await page.findFriend();
  assert.match(page.friendError(), /2 e 60/);
  assert.equal(calls.length, 3);
});
