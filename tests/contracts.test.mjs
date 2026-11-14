import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configurationForBranch } from '../scripts/vercel-build.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async path => JSON.parse(await read(path));
const moduleFromText = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('default builds and previews cannot select production implicitly', async () => {
  const workspace = await json('angular.json');
  const {build, serve} = workspace.projects.viveu.architect;
  assert.equal(build.defaultConfiguration, 'hml');
  assert.equal(serve.defaultConfiguration, 'development');
  for (const name of ['hml', 'development']) {
    assert.equal(build.configurations[name].fileReplacements?.length ?? 0, 0);
  }
  assert.deepEqual(build.configurations.production.fileReplacements, [{
    replace: 'src/environments/environment.ts', with: 'src/environments/environment.prod.ts'
  }]);
  const pkg = await json('package.json');
  assert.equal(pkg.scripts.build, 'node scripts/angular-env.mjs build hml');
  assert.equal(pkg.scripts['build:prod'], 'node scripts/angular-env.mjs build prod');
});

test('Firebase configurations belong entirely to their specified project', async () => {
  for (const [file, production, target] of [
    ['environment.ts', false, 'hml'],
    ['environment.prod.ts', true, 'prod']
  ]) {
    const source = await read(`src/environments/${file}`);
    assert.ok(source.includes(`from './firebase.${target}.local'`));
    assert.doesNotMatch(source, /AIza|firebaseapp\.com|firebasestorage\.app/);
    const firebase = {projectId: `fixture-${target}`};
    const {environment} = await moduleFromText(source.replace(/^import .*;$/m, `const firebase = ${JSON.stringify(firebase)};`));
    assert.equal(environment.production, production);
    assert.deepEqual(environment.firebase, firebase);
  }
  const config = await read('src/app/app.config.ts');
  assert.match(config, /from ['"]\.\.\/environments\/environment['"]/);
  assert.doesNotMatch(config, /vaultlog-(?:hml|65c3d)|environment\.prod/);
});

test('only exact approved production branch names build PROD', () => {
  for (const branch of ['main', 'master']) assert.equal(configurationForBranch(branch), 'production');
  for (const branch of [undefined, '', 'develop', 'hml', 'feature/main', 'Main', 'production', 'refs/heads/main', 'main-preview']) {
    assert.equal(configurationForBranch(branch), 'hml', `unsafe default for ${branch}`);
  }
});

test('public route stays anonymous while every private page is guarded and lazy', async () => {
  const source = (await read('src/app/app.routes.ts')).replace(/^import .*;\s*$/gm, '').replace('export const routes: Routes =', 'const routes =');
  const guard = () => {};
  const routes = new Function('authGuard', `${source}; return routes;`)(guard);
  assert.equal(routes.find(route => route.path === 'u/:uid').canActivate, undefined);
  assert.equal(routes.find(route => route.path === 'perfil/:uid').redirectTo, 'u/:uid');
  for (const path of ['feed', 'diary', 'entry/new', 'entry/:id/edit', 'queue', 'together', 'together/:id']) {
    const route = routes.find(route => route.path === path);
    assert.ok(route, path);
    assert.deepEqual(route.canActivate, [guard], path);
    assert.equal(typeof route.loadComponent, 'function', path);
  }
});

test('auth guard waits for restored session and preserves requested URL', async () => {
  const source = (await read('src/app/core/auth.guard.ts')).replace(/^import .*;\s*$/gm, '').replace('export const authGuard: CanActivateFn =', 'const authGuard =');
  let ready;
  let user = null;
  let profile = null;
  const auth = {ready: new Promise(resolve => {ready = resolve;}), user: () => user, profile: () => profile};
  const router = {createUrlTree: (commands, options) => ({commands, options})};
  const guard = new Function('inject', 'AuthService', 'Router', `${source}; return authGuard;`)(token => token === 'auth' ? auth : router, 'auth', 'router');
  let settled = false;
  const pending = guard({}, {url: '/entry/new?queue=abc'}).then(result => {settled = true; return result;});
  await Promise.resolve();
  assert.equal(settled, false);
  ready();
  assert.deepEqual(await pending, {commands: ['/login'], options: {queryParams: {returnUrl: '/entry/new?queue=abc'}}});
  user = {uid: 'restored-user'};
  assert.equal(await guard({}, {url: '/queue'}), true);
  profile = {onboardingCompleted: false};
  assert.deepEqual(await guard({}, {url: '/queue'}), {commands: ['/onboarding'], options: undefined});
  assert.equal(await guard({}, {url: '/onboarding'}), true);
  profile = {onboardingCompleted: true};
  assert.equal(await guard({}, {url: '/queue'}), true);
});

test('Firestore indexes support author history and active journeys with deterministic cursors', async () => {
  const index = await json('firestore.indexes.json');
  assert.ok(index.indexes.some(item => item.collectionGroup === 'entries' && item.queryScope === 'COLLECTION' && JSON.stringify(item.fields) === JSON.stringify([
    {fieldPath: 'authorId', order: 'ASCENDING'},
    {fieldPath: 'createdAt', order: 'DESCENDING'},
    {fieldPath: '__name__', order: 'DESCENDING'}
  ])));
  assert.ok(index.indexes.some(item => item.collectionGroup === 'sharedJourneys' && item.queryScope === 'COLLECTION' && JSON.stringify(item.fields) === JSON.stringify([
    {fieldPath: 'audienceIds', arrayConfig: 'CONTAINS'},
    {fieldPath: 'updatedAt', order: 'DESCENDING'},
    {fieldPath: '__name__', order: 'DESCENDING'}
  ])));
  assert.ok(index.indexes.some(item => item.collectionGroup === 'entries' && item.queryScope === 'COLLECTION' && JSON.stringify(item.fields) === JSON.stringify([
    {fieldPath: 'authorId', order: 'ASCENDING'},
    {fieldPath: 'status', order: 'ASCENDING'},
    {fieldPath: 'updatedAt', order: 'DESCENDING'},
    {fieldPath: '__name__', order: 'DESCENDING'}
  ])));
  assert.deepEqual(index.fieldOverrides, []);
  const vercel = await json('vercel.json');
  assert.equal(vercel.outputDirectory, 'dist/viveu/browser');
  assert.ok(vercel.rewrites.some(rule => rule.destination === '/index.html'));
});
