import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/app/core/data-error.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText;
const exports = {};
const diagnostics = [];
new Function('exports', 'console', compiled)(exports, {error: (...args) => diagnostics.push(args)});
const {dataErrorMessage} = exports;

test('a failed query keeps the SDK diagnostic while giving a safe UI message', () => {
  const error = {code: 'failed-precondition', message: 'Create index: https://console.firebase.google.com/internal-index'};
  const message = dataErrorMessage(error, 'Não foi possível carregar os registros.');
  assert.match(message, /registros.*temporariamente indisponível/);
  assert.doesNotMatch(message, /console\.firebase|internal-index/);
  assert.equal(diagnostics.at(-1)[1], error);
});

test('permission, expired session and connection failures offer distinct recovery', () => {
  assert.match(dataErrorMessage({code: 'firestore/permission-denied'}, 'Falhou.'), /acesso aos dados foi negado/);
  assert.match(dataErrorMessage({code: 'unauthenticated'}, 'Falhou.'), /sessão expirou/);
  assert.match(dataErrorMessage({code: 'unavailable'}, 'Falhou.'), /conexão/);
  assert.match(dataErrorMessage({code: 'resource-exhausted'}, 'Falhou.'), /sobrecarregado/);
});

test('a refresh failure after writing preserves the saved confirmation', () => {
  const fallback = 'A alteração foi salva. Não foi possível atualizar a lista.';
  assert.ok(dataErrorMessage({code: 'unavailable'}, fallback).startsWith(fallback));
  for (const error of [null, undefined, new Error('internal detail')]) {
    assert.equal(dataErrorMessage(error, fallback), fallback);
  }
});
