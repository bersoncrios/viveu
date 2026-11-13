import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {Subject, filter} from 'rxjs';

async function load(path, modules) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
  }}).outputText;
  const exports = {};
  new Function('require', 'exports', 'document', compiled)(name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  }, exports, {querySelector: () => ({focus() {}})});
  return exports;
}
function signal(value) {
  const read = () => value;
  read.set = next => {value = next;};
  return read;
}
const component = () => value => value;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

async function shell(url = '/') {
  const events = new Subject();
  class NavigationEnd {constructor(urlAfterRedirects) {this.urlAfterRedirects = urlAfterRedirects;}}
  const dependencies = {auth: {}, router: {url, events}};
  const exports = await load('src/app/app.component.ts', {
    '@angular/core': {Component: component, signal, inject: token => dependencies[token]},
    '@angular/router': {Router: 'router', NavigationEnd},
    'rxjs': {filter},
    '@angular/core/rxjs-interop': {takeUntilDestroyed: () => stream => stream},
    './core/auth.service': {AuthService: 'auth'},
  });
  return {...exports, app: new exports.AppComponent(), events, NavigationEnd};
}

async function loginHarness({returnUrl, login = async () => {}, navigate} = {}) {
  const destinations = []; let attempts = 0;
  const dependencies = {
    auth: {user: () => null, login: async () => {attempts++; await login();}},
    route: {snapshot: {queryParamMap: {get: key => key === 'returnUrl' ? returnUrl ?? null : null}}},
    router: {navigateByUrl: async destination => {destinations.push(destination); return navigate ? navigate(destination) : true;}},
  };
  const {LoginPage} = await load('src/app/pages/login.page.ts', {
    '@angular/core': {Component: component, signal, inject: token => dependencies[token]},
    '@angular/router': {ActivatedRoute: 'route', Router: 'router'},
    '../core/auth.service': {AuthService: 'auth', errorMessage: error => `Falha: ${error.message}`},
    './journey-preview': {},
  });
  return {page: new LoginPage(), destinations, attempts: () => attempts};
}

test('only the home and login use the public full-width shell including query and fragment URLs', async () => {
  const {isPublicRoute} = await shell();
  for (const url of ['', '/', '/?campaign=home#intro', '/#como-funciona', '/login', '/login/', '/login?returnUrl=%2Fdiary#google']) {
    assert.equal(isPublicRoute(url), true, url);
  }
  for (const url of ['/feed', '/diary?category=livro', '/queue', '/entry/new', '/u/ana', '/perfil/ana?public=1', '/login-other', '/unknown']) {
    assert.equal(isPublicRoute(url), false, url);
  }
});

test('the shell tracks completed navigation and uses the redirected destination', async () => {
  const {app, events, NavigationEnd} = await shell('/login?returnUrl=%2Ffeed');
  assert.equal(app.isPublicPage(), true);
  events.next({urlAfterRedirects: '/feed'});
  assert.equal(app.isPublicPage(), true, 'intermediate router events cannot change the shell');
  for (const [url, expected] of [['/feed', false], ['/u/ana', false], ['/#como-funciona', true], ['/login?returnUrl=%2Fdiary', true], ['/diary', false]]) {
    events.next(new NavigationEnd(url));
    assert.equal(app.isPublicPage(), expected, url);
  }
  events.complete();
});

test('the root lazily loads the public home without a guard or a feed redirect', async () => {
  class HomePage {}
  const guard = () => true;
  const {routes} = await load('src/app/app.routes.ts', {
    './core/auth.guard': {authGuard: guard},
    './pages/home.page': {HomePage},
  });
  const root = routes.find(route => route.path === '');
  assert.equal(root.pathMatch, 'full');
  assert.equal(root.canActivate, undefined);
  assert.equal(root.redirectTo, undefined);
  assert.equal(await root.loadComponent(), HomePage);
  assert.deepEqual(routes.find(route => route.path === 'feed').canActivate, [guard]);
  assert.equal(routes.find(route => route.path === 'u/:uid').canActivate, undefined);
});

test('Google login preserves an internal requested destination including query and fragment', async () => {
  const returnUrl = '/entry/new?queue=item&start=1#notes';
  const {page, destinations, attempts} = await loginHarness({returnUrl});
  assert.equal(page.destination(), returnUrl);
  await page.login();
  assert.deepEqual(destinations, [returnUrl]);
  assert.equal(attempts(), 1);
  assert.equal(page.busy(), false);
  assert.equal(page.error(), '');
});

test('external, relative and login destinations fall back to the feed', async () => {
  for (const returnUrl of [undefined, '', 'feed', 'https://example.com/path', '//example.com/path', '/login', '/login?returnUrl=%2Fdiary', '/login/#google']) {
    const {page} = await loginHarness({returnUrl});
    assert.equal(page.destination(), '/feed', String(returnUrl));
  }
});

test('a pending Google login prevents double submission until navigation finishes', async () => {
  const authentication = deferred(), navigation = deferred();
  const {page, attempts, destinations} = await loginHarness({login: () => authentication.promise, navigate: () => navigation.promise});
  const first = page.login();
  assert.equal(page.busy(), true);
  await page.login();
  assert.equal(attempts(), 1);
  assert.deepEqual(destinations, []);
  authentication.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.busy(), true);
  assert.deepEqual(destinations, ['/feed']);
  await page.login();
  assert.equal(attempts(), 1);
  navigation.resolve(true); await first;
  assert.equal(page.busy(), false);
});

test('a failed Google login shows its error, avoids navigation and releases retry', async () => {
  let fail = true;
  const {page, attempts, destinations} = await loginHarness({login: async () => {if (fail) throw new Error('popup fechado');}});
  await page.login();
  assert.equal(page.busy(), false);
  assert.equal(page.error(), 'Falha: popup fechado');
  assert.deepEqual(destinations, []);
  fail = false;
  await page.login();
  assert.equal(attempts(), 2);
  assert.equal(page.error(), '');
  assert.equal(page.busy(), false);
  assert.deepEqual(destinations, ['/feed']);
});
