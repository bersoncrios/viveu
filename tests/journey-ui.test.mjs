import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path, modules = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true},
  }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    assert.ok(modules[name], `Unexpected import: ${name}`);
    return modules[name];
  }, exports);
  return exports;
}
const models = await load('src/app/core/models.ts');
function signal(initial) {
  let value = initial;
  const read = () => value;
  read.set = next => {value = next;};
  read.update = update => {value = update(value);};
  return read;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

async function panelFor({ready = Promise.resolve(), activeJourneys}) {
  const diagnostics = [];
  const dependencies = {auth: {ready}, data: {activeJourneys}};
  const {ActiveJourneys} = await load('src/app/pages/active-journeys.ts', {
    '@angular/core': {Component: () => value => value, signal, inject: token => dependencies[token]},
    '@angular/router': {RouterLink: class {}},
    '../core/auth.service': {AuthService: 'auth'},
    '../core/data.service': {DataService: 'data'},
    '../core/data-error': {dataErrorMessage: (error, fallback) => {diagnostics.push(error); return fallback;}},
    '../core/models': models,
  });
  return {panel: new ActiveJourneys(), diagnostics};
}

test('active journeys wait for restored authentication, expose loading and prevent duplicate loads', async () => {
  const session = deferred(); const request = deferred(); let calls = 0;
  const {panel} = await panelFor({ready: session.promise, activeJourneys: () => {calls++; return request.promise;}});
  assert.equal(panel.loading(), true);
  assert.equal(calls, 0);
  await panel.load();
  assert.equal(calls, 0);
  session.resolve(); await flush();
  assert.equal(calls, 1);
  assert.equal(panel.loading(), true);
  await panel.load();
  assert.equal(calls, 1);
  const entries = [{id: 'ongoing', title: 'Um livro', status: 'in_progress', resumePoint: 'Capítulo 8'}];
  request.resolve(entries); await flush();
  assert.equal(panel.loading(), false);
  assert.equal(panel.error(), '');
  assert.deepEqual(panel.items(), entries);
  assert.equal(panel.statusLabel('paused'), 'Pausado');
});

test('the active journeys panel recovers from a load error on retry', async () => {
  const failure = {code: 'unavailable'}; let calls = 0;
  const entries = [{id: 'paused', title: 'Uma série', status: 'paused'}];
  const {panel, diagnostics} = await panelFor({activeJourneys: async () => {
    if (++calls === 1) throw failure;
    return entries;
  }});
  await flush();
  assert.equal(panel.loading(), false);
  assert.match(panel.error(), /Não foi possível carregar suas jornadas/);
  assert.deepEqual(panel.items(), []);
  assert.deepEqual(diagnostics, [failure]);
  await panel.load();
  assert.equal(calls, 2);
  assert.equal(panel.error(), '');
  assert.deepEqual(panel.items(), entries);
});

test('refresh failure keeps previously loaded journeys and a later retry can show an empty result', async () => {
  let response = [{id: 'ongoing', status: 'in_progress', title: 'Um jogo'}];
  const {panel} = await panelFor({activeJourneys: async () => {
    if (response instanceof Error) throw response;
    return response;
  }});
  await flush();
  response = new Error('offline');
  await panel.load();
  assert.equal(panel.items()[0].id, 'ongoing');
  assert.notEqual(panel.error(), '');
  response = [];
  await panel.load();
  assert.deepEqual(panel.items(), []);
  assert.equal(panel.error(), '');
});
