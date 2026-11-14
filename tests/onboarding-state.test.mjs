import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(path, modules = {}) {
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
const models = await load('src/app/core/models.ts');
const favorites = models.CATEGORIES.slice(0, 3).map(item => item.value);
async function harness() {
  let resolve, reject;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  const writes = [], navigations = [];
  const initial = {uid: 'me', displayName: 'Ana', onboardingCompleted: false, bio: 'Original'};
  const auth = {user: signal({uid: 'me'}), profile: signal(initial), requireUser() {return this.user();}, ready: Promise.resolve()};
  const core = {Injectable: () => value => value, Component: () => value => value, signal,
    inject: token => token === 'auth' ? auth : token === 'data' ? data : token === 'router' ? router : {},
    runInInjectionContext: (_, work) => work()};
  const {DataService} = await load('src/app/core/data.service.ts', {
    '@angular/core': core, '@angular/fire/firestore': {doc: (_, ...path) => path,
      setDoc: (ref, patch, options) => {writes.push({ref, patch, options}); return pending;}},
    './auth.service': {AuthService: 'auth'}, './models': models, './engagement': {},
  });
  const data = new DataService();
  const router = {navigateByUrl: async url => {
    assert.equal(auth.profile().onboardingCompleted, true);
    assert.deepEqual(auth.profile().favoriteCategories, favorites);
    navigations.push(url);
  }};
  const {OnboardingPage} = await load('src/app/pages/onboarding.page.ts', {
    '@angular/core': core, '@angular/forms': {}, '@angular/router': {Router: 'router'},
    '../core/auth.service': {AuthService: 'auth'}, '../core/data.service': {DataService: 'data'},
    '../core/models': models, '../core/data-error': {dataErrorMessage: () => 'Erro ao salvar'},
  });
  return {auth, data, page: new OnboardingPage(), initial, writes, navigations, resolve, reject};
}
test('onboarding publishes confirmed values before advancing and navigating, without reload', async () => {
  const h = await harness();
  h.page.next();
  for (const category of favorites) h.page.toggle(category);
  const saving = h.page.saveFavorites();
  assert.equal(h.page.step(), 2);
  assert.equal(h.auth.profile(), h.initial);
  h.auth.profile.update(profile => ({...profile, bio: 'Updated while saving'}));
  h.resolve();
  await saving;
  assert.equal(h.page.step(), 3);
  assert.deepEqual(h.writes[0].ref, ['users', 'me']);
  assert.deepEqual(h.auth.profile(), {...h.initial, bio: 'Updated while saving', ...h.writes[0].patch});
  h.page.next(); h.page.next();
  await h.page.finish();
  assert.deepEqual(h.navigations, ['/feed']);
});
test('finish waits for confirmation and exposes failure without changing profile or navigating', async () => {
  const h = await harness();
  h.page.favorites.set(favorites);
  const saving = h.page.finish();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.auth.profile(), h.initial);
  h.reject(new Error('unavailable'));
  await saving;
  assert.equal(h.auth.profile(), h.initial);
  assert.deepEqual(h.navigations, []);
  assert.ok(h.page.error());
  assert.equal(h.page.busy(), false);
});
test('confirmed onboarding write cannot overwrite a different signed-in account', async () => {
  const h = await harness();
  const saving = h.data.completeOnboarding(favorites);
  const other = {uid: 'other', onboardingCompleted: false};
  h.auth.user.set({uid: 'other'}); h.auth.profile.set(other);
  h.resolve(); await saving;
  assert.equal(h.auth.profile(), other);
});
