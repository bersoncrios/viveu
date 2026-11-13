import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {BehaviorSubject} from 'rxjs';

const compiled = new Map();
async function load(path, modules = {}) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
  }).outputText);
  const exports = {};
  new Function('require', 'exports', 'console', 'document', compiled.get(path))(name => {
    assert.ok(modules[name], `Unexpected import: ${name}`); return modules[name];
  }, exports, {error() {}}, {getElementById: () => null});
  return exports;
}
const models = await load('src/app/core/models.ts');
const sharedModels = await load('src/app/core/shared-models.ts', {'./models': models});
const errors = await load('src/app/core/data-error.ts');
function signal(initial) {
  let value = initial; const get = () => value;
  get.set = next => {value = next;}; get.update = update => {value = update(value);}; return get;
}
function deferred() {
  let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const emptyPage = () => ({items: [], cursor: null, hasMore: false});
const group = {id: 'group-a', ownerId: 'owner', ownerName: 'Ana', title: 'Uma obra', category: 'livro', description: '', pace: 'free', unit: 'capitulo',
  memberIds: ['owner'], invitedIds: [], audienceIds: ['owner'], milestones: [], archived: false, createdAt: 10, updatedAt: 20};
const me = {uid: 'owner', displayName: 'Ana', role: 'owner', state: 'active', progress: 2, status: 'in_progress', rating: null, reflection: '', entryId: 'reserved', entryPublished: false};
const other = {uid: 'friend', displayName: 'Bia', role: 'member', state: 'active', progress: 8, status: 'completed', rating: 5, reflection: 'Uma revelação final.'};

async function pageFor({detail = false, shared: suppliedShared = {}, data: suppliedData = {}, queueId = null, navigate, ready = Promise.resolve()} = {}) {
  const calls = [], navigations = [];
  const base = {
    list: async () => emptyPage(), create: async () => 'created',
    get: async id => ({...group, id}), membership: async () => ({...me}), members: async () => [{...me}, {...other}], posts: async () => emptyPage(),
    addPost: async () => {}, finish: async () => {}, respond: async () => {}, invite: async () => {}, updateProgress: async () => {},
    leave: async () => {}, archive: async () => {}, addMilestone: async () => {},
  };
  const shared = Object.fromEntries(Object.entries({...base, ...suppliedShared}).map(([method, work]) => [method, (...args) => {
    calls.push([method, ...args]); return work(...args);
  }]));
  const data = Object.fromEntries(Object.entries({queue: async () => [], searchProfiles: async () => emptyPage(), ...suppliedData}).map(([method, work]) => [method, (...args) => {
    calls.push([method, ...args]); return work(...args);
  }]));
  const routeParams = new BehaviorSubject({get: key => key === 'id' ? 'group-a' : null});
  const route = {paramMap: routeParams, snapshot: {queryParamMap: {get: key => key === 'queue' ? queueId : null}}};
  const dependencies = {
    auth: {ready, user: () => ({uid: 'owner'})}, shared, data, route,
    router: {navigate: async commands => {navigations.push(commands); return navigate ? navigate(commands) : true;}},
  };
  const modules = {
    '@angular/core': {Component: () => value => value, signal, inject: token => dependencies[token], DestroyRef: 'destroy'},
    '@angular/common': {DatePipe: class {}}, '@angular/forms': {FormsModule: class {}},
    '@angular/router': {ActivatedRoute: 'route', Router: 'router', RouterLink: class {}},
    '@angular/core/rxjs-interop': {takeUntilDestroyed: () => stream => stream},
    '../core/auth.service': {AuthService: 'auth'}, '../core/data.service': {DataService: 'data'},
    '../core/shared-journey.service': {SharedJourneyService: 'shared'}, '../core/data-error': errors,
    '../core/models': models, '../core/shared-models': sharedModels,
  };
  const exports = await load(`src/app/pages/${detail ? 'together-detail' : 'together'}.page.ts`, modules);
  const page = detail ? new exports.TogetherDetailPage() : new exports.TogetherPage();
  await flush();
  return {page, calls, shared, data, navigations, route: id => routeParams.next({get: key => key === 'id' ? id : null})};
}
const count = (fixture, name) => fixture.calls.filter(([method]) => method === name).length;
const failure = () => Object.assign(new Error('offline'), {code: 'unavailable'});

test('creation prevents concurrent submits and keeps the confirmed ID when navigation fails', async () => {
  const pending = deferred();
  const f = await pageFor({shared: {create: () => pending.promise}, navigate: async () => {throw new Error('router failed');}});
  f.page.title = '  Livro  '; f.page.category = 'livro'; f.page.description = '  Convite  ';
  const saving = f.page.create(); assert.equal(f.page.busy(), true);
  await f.page.create(); assert.equal(count(f, 'create'), 1);
  pending.resolve('created-group'); await saving;
  assert.equal(f.page.createdId(), 'created-group'); assert.equal(f.page.busy(), false); assert.equal(f.page.createError(), '');
  assert.deepEqual(f.navigations, [['/together', 'created-group']]);
  await f.page.create(); assert.equal(count(f, 'create'), 1);
  const payload = f.calls.find(([name]) => name === 'create')[1]; assert.equal(payload.title, 'Livro'); assert.equal(payload.description, 'Convite');
});

test('a disabled feature cannot create or read a queue item through its create shortcut', async () => {
  const disabled = Object.assign(new Error('not yet'), {code: 'vaultlog/shared-disabled'});
  const f = await pageFor({queueId: 'queued', shared: {list: async () => {throw disabled;}}});
  assert.equal(f.page.disabled(), true); assert.match(f.page.error(), /preparação/);
  f.page.title = 'Livro'; f.page.category = 'livro'; await f.page.create();
  assert.equal(count(f, 'create'), 0); assert.equal(count(f, 'queue'), 0);
});

test('queue shortcut prefills only the work and category, preserving private motivation and the queue item', async () => {
  const queued = {id: 'queued', title: 'Livro escolhido', category: 'livro', reason: 'Uma lembrança só minha.'};
  const f = await pageFor({queueId: 'queued', data: {queue: async () => [queued]}});
  assert.equal(f.page.title, queued.title); assert.equal(f.page.category, 'livro'); assert.equal(f.page.unit, 'capitulo');
  assert.equal(f.page.description, ''); assert.equal(f.page.showCreate(), true);
  await f.page.create();
  assert.equal(f.calls.find(([name]) => name === 'create')[1].description, '');
  assert.equal(count(f, 'removeQueue'), 0); assert.equal(queued.reason, 'Uma lembrança só minha.');
});

test('an unsuccessful create keeps the form and does not claim a saved journey', async () => {
  const f = await pageFor({shared: {create: async () => {throw failure();}}});
  f.page.title = 'Minha obra'; f.page.category = 'livro'; f.page.description = 'Meu convite';
  await f.page.create(); assert.equal(f.page.createdId(), ''); assert.equal(f.page.title, 'Minha obra');
  assert.equal(f.page.description, 'Meu convite'); assert.match(f.page.createError(), /dados continuam/);
});

test('an invited participant sees only the invitation and own membership', async () => {
  const f = await pageFor({detail: true, shared: {membership: async () => ({...me, state: 'invited'})}});
  assert.equal(f.page.me().state, 'invited'); assert.equal(count(f, 'get'), 1); assert.equal(count(f, 'membership'), 1);
  assert.equal(count(f, 'members'), 0); assert.equal(count(f, 'posts'), 0); assert.deepEqual(f.page.members(), []);
});

test('active participation loads the mural and starts both publication choices private', async () => {
  const f = await pageFor({detail: true});
  assert.equal(count(f, 'members'), 1); assert.equal(count(f, 'posts'), 1); assert.equal(f.page.loading(), false);
  assert.equal(f.page.postPublic, false); assert.equal(f.page.finishPublic, false); assert.equal(f.page.progress, 2);
  f.page.postText = 'Uma nota'; await f.page.addPost();
  assert.equal(f.calls.find(([name]) => name === 'addPost')[2].publishPublicly, false);
  f.page.finishRating = 4; f.page.finishReflection = 'Minha conclusão'; await f.page.finish();
  assert.equal(f.calls.find(([name]) => name === 'finish')[2].publishPublicly, false);
});

test('spoilers and progress each require an independent reveal; changed content hides again', async () => {
  const {page} = await pageFor({detail: true});
  const spoiler = {id: 'spoiler', authorId: 'friend', text: 'Revelação.', progress: 1, containsSpoilers: true};
  const ahead = {id: 'ahead', authorId: 'friend', text: 'Capítulo seguinte.', progress: 5, containsSpoilers: false};
  const ordinary = {id: 'ordinary', authorId: 'friend', text: 'Começo.', progress: 1, containsSpoilers: false};
  assert.equal(page.postVisible(spoiler), false); assert.equal(page.postVisible(ahead), false); assert.equal(page.postVisible(ordinary), true);
  page.togglePost(spoiler); assert.equal(page.postVisible(spoiler), true); assert.equal(page.postVisible(ahead), false);
  page.togglePost(ahead); assert.equal(page.postVisible(ahead), true);
  assert.equal(page.postVisible({...spoiler, text: 'Outra revelação.'}), false);
  assert.equal(page.postVisible({...ahead, progress: 9}), false);
  page.togglePost(spoiler); assert.equal(page.postVisible(spoiler), false);
  assert.equal(page.postVisible({...spoiler, authorId: 'owner'}), true);
});

test('final reflections begin hidden until individual completion or explicit reveal', async () => {
  const {page} = await pageFor({detail: true});
  assert.equal(page.reflectionVisible(other), false); assert.equal(page.reflectionVisible({...other, uid: 'owner'}), true);
  page.revealReflection(other); assert.equal(page.reflectionVisible(other), true);
  assert.equal(page.reflectionVisible({...other, reflection: 'Uma nova revelação.'}), false);
  page.me.set({...me, status: 'completed'}); assert.equal(page.reflectionVisible({...other, reflection: 'Nova'}), true);
});

test('a failed write preserves post and conclusion drafts, including explicit publication choices', async () => {
  const f = await pageFor({detail: true, shared: {
    addPost: async () => {throw failure();}, finish: async () => {throw failure();},
  }});
  Object.assign(f.page, {postText: 'Não perder', postPublic: true, postSpoiler: true, postProgress: 4,
    finishReflection: 'Minha reflexão pendente', finishRating: 5, finishPublic: true});
  await f.page.addPost(); assert.equal(f.page.postText, 'Não perder'); assert.equal(f.page.postPublic, true);
  assert.equal(f.page.postSpoiler, true); assert.equal(f.page.postProgress, 4); assert.match(f.page.error(), /dados continuam/);
  assert.equal(f.page.notice(), ''); assert.equal(f.page.busy(), false);
  await f.page.finish(); assert.equal(f.page.finishReflection, 'Minha reflexão pendente'); assert.equal(f.page.finishRating, 5); assert.equal(f.page.finishPublic, true);
});

test('a confirmed post clears its draft only after success and preserves confirmation if refreshing fails', async () => {
  const pending = deferred(); let failRefresh = false;
  const f = await pageFor({detail: true, shared: {
    addPost: () => pending.promise,
    get: async id => {if (failRefresh) throw failure(); return {...group, id};},
  }});
  Object.assign(f.page, {postText: 'Uma nota salva', postPublic: true, postSpoiler: true});
  const saving = f.page.addPost(); assert.equal(f.page.postText, 'Uma nota salva'); assert.equal(f.page.busy(), true);
  failRefresh = true; pending.resolve(); await saving;
  assert.equal(f.page.postText, ''); assert.equal(f.page.postPublic, false); assert.equal(f.page.postSpoiler, false);
  assert.match(f.page.notice(), /compartilhada/); assert.match(f.page.error(), /alteração foi salva/);
  assert.doesNotMatch(f.page.error(), /Seus dados continuam aqui/); assert.equal(count(f, 'addPost'), 1);
});

test('a mural-only refresh failure keeps a saved-post notice and exposes a separate read error', async () => {
  let failPosts = false;
  const f = await pageFor({detail: true, shared: {posts: async () => {if (failPosts) throw failure(); return emptyPage();}}});
  f.page.postText = 'Uma descoberta'; failPosts = true; await f.page.addPost();
  assert.equal(f.page.postText, ''); assert.match(f.page.notice(), /ficou com o grupo/);
  assert.equal(f.page.error(), ''); assert.match(f.page.postsError(), /carregar o mural/);
});

test('a route change during a pending post cannot clear new drafts or apply old results', async () => {
  const pending = deferred();
  const f = await pageFor({detail: true, shared: {addPost: () => pending.promise}});
  f.page.postText = 'Grupo A'; const saving = f.page.addPost();
  f.route('group-b'); await flush(); Object.assign(f.page, {postText: 'Rascunho do B', postPublic: true, finishReflection: 'Reflexão do B'});
  pending.resolve(); await saving;
  assert.equal(f.page.id, 'group-b'); assert.equal(f.page.group().id, 'group-b'); assert.equal(f.page.postText, 'Rascunho do B');
  assert.equal(f.page.postPublic, true); assert.equal(f.page.finishReflection, 'Reflexão do B'); assert.equal(f.page.notice(), '');
  assert.equal(f.calls.filter(([method, id]) => method === 'get' && id === 'group-a').length, 1);
});

test('a delayed action failure for an earlier route does not replace the new route state', async () => {
  const pending = deferred(); const f = await pageFor({detail: true, shared: {finish: () => pending.promise}});
  f.page.finishRating = 5; f.page.finishReflection = 'Do A'; const saving = f.page.finish();
  f.route('group-b'); await flush(); f.page.finishReflection = 'Do B';
  pending.reject(failure()); await saving;
  assert.equal(f.page.error(), ''); assert.equal(f.page.finishReflection, 'Do B'); assert.equal(f.page.busy(), false);
});

test('a delayed initial route response cannot overwrite the newly opened journey', async () => {
  const pending = deferred(); const f = await pageFor({detail: true, shared: {get: id => id === 'group-a' ? pending.promise : Promise.resolve({...group, id})}});
  assert.equal(f.page.loading(), true); f.route('group-b'); await flush();
  pending.resolve({...group, id: 'group-a'}); await flush();
  assert.equal(f.page.group().id, 'group-b'); assert.equal(f.page.loading(), false);
});

test('stale name-search results and errors are ignored after the search text changes', async () => {
  const pending = deferred(); const second = deferred(); let searches = 0;
  const f = await pageFor({detail: true, data: {searchProfiles: () => ++searches === 1 ? pending.promise : second.promise}});
  f.page.friendName = 'Ana'; const first = f.page.findPeople();
  f.page.friendName = 'Bia'; f.page.resetPeople(); const current = f.page.findPeople();
  pending.resolve({items: [{uid: 'ana', displayName: 'Ana'}], cursor: null, hasMore: true}); await first;
  assert.deepEqual(f.page.people(), []); assert.equal(f.page.finding(), true);
  second.resolve({items: [{uid: 'bia', displayName: 'Bia'}], cursor: null, hasMore: false}); await current;
  assert.equal(f.page.people()[0].uid, 'bia'); assert.equal(f.page.finding(), false);
  const stale = deferred(); f.data.searchProfiles = () => stale.promise; f.page.friendName = 'Carol';
  const old = f.page.findPeople(); f.page.resetPeople(); stale.reject(failure()); await old;
  assert.equal(f.page.peopleError(), ''); assert.deepEqual(f.page.people(), []);
});

test('route changes invalidate name searches from the previous group', async () => {
  const pending = deferred(); const f = await pageFor({detail: true, data: {searchProfiles: () => pending.promise}});
  f.page.friendName = 'Ana'; const search = f.page.findPeople(); f.route('group-b'); await flush();
  pending.resolve({items: [{uid: 'ana'}], cursor: null, hasMore: true}); await search;
  assert.deepEqual(f.page.people(), []); assert.equal(f.page.peopleSearched(), false); assert.equal(f.page.finding(), false);
});

test('refreshing the current journey preserves post, milestone and conclusion drafts', async () => {
  const f = await pageFor({detail: true});
  const drafts = {postText: 'Ainda escrevendo', postKind: 'question', postPublic: true, postSpoiler: true, postProgress: 8,
    finishReflection: 'Não terminei de escrever', finishRating: 4, finishPublic: true, milestoneTitle: 'Novo marco', milestoneQuestion: 'Uma pergunta'};
  Object.assign(f.page, drafts); await f.page.load('group-a');
  for (const [key, value] of Object.entries(drafts)) assert.deepEqual(f.page[key], value, key);
});

test('a successful unrelated action refresh preserves the other forms drafts', async () => {
  const f = await pageFor({detail: true});
  Object.assign(f.page, {postText: 'Rascunho', postPublic: true, finishReflection: 'Reflexão pendente', finishRating: 3, finishPublic: true});
  f.page.progress = 4; await f.page.saveProgress();
  assert.equal(f.page.postText, 'Rascunho'); assert.equal(f.page.postPublic, true);
  assert.equal(f.page.finishReflection, 'Reflexão pendente'); assert.equal(f.page.finishRating, 3); assert.equal(f.page.finishPublic, true);
});

test('retrying the current journey after a read failure preserves drafts from before the failure', async () => {
  let failLoad = false;
  const f = await pageFor({detail: true, shared: {get: async id => {
    if (failLoad) throw failure(); return {...group, id};
  }}});
  Object.assign(f.page, {postText: 'Minha nota pendente', postPublic: true, finishReflection: 'Minha reflexão pendente', finishRating: 4, finishPublic: true});
  failLoad = true; await f.page.load('group-a');
  assert.equal(f.page.postText, 'Minha nota pendente');
  failLoad = false; await f.page.load('group-a');
  assert.equal(f.page.postText, 'Minha nota pendente'); assert.equal(f.page.postPublic, true);
  assert.equal(f.page.finishReflection, 'Minha reflexão pendente'); assert.equal(f.page.finishRating, 4); assert.equal(f.page.finishPublic, true);
});
