import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadExport() {
  const source = await readFile(new URL('../src/app/core/diary-export.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    assert.equal(name, './models');
    return {JOURNEY_STATUSES: [{value: 'completed', label: 'Terminei'}], journeyStatus: entry => entry.status ?? 'completed'};
  }, exports);
  return exports;
}

const entries = [
  {id:'later', title:'Finale', category:'serie', rating:4, quote:'Uma fala', reflection:'Ficou comigo', status:'completed', createdAt:200, updatedAt:300, completedAt:300, notes:[{id:'s',text:'<script>alert(1)</script>',createdAt:250,containsSpoilers:true}]},
  {id:'early', title:'Livro & Cia', category:'livro', rating:5, quote:'"Olá"', createdAt:100, updatedAt:100},
];

test('HTML export is self contained, chronological, print friendly and includes spoiler notes', async () => {
  const {buildDiaryHtml} = await loadExport();
  const html = buildDiaryHtml(entries, 'Ana <Admin>', new Date('2026-11-13T12:00:00Z'));
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /@media print/);
  assert.match(html, /Ana &lt;Admin&gt;/);
  assert.ok(html.indexOf('Livro &amp; Cia') < html.indexOf('Finale'));
  assert.match(html, /Nota com spoiler/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('export includes entries without ratings and has an empty archive state', async () => {
  const {buildDiaryHtml} = await loadExport();
  const html = buildDiaryHtml([{...entries[0], rating:null, completedAt:null, updatedAt:300}], 'Diário');
  assert.match(html, /Finale/);
  assert.doesNotMatch(html, /null \/ 5/);
  assert.match(buildDiaryHtml([], 'Diário'), /começa com a próxima história/i);
});

test('creation feedback stays under 600ms and honors reduced motion', async () => {
  const source = await readFile(new URL('../src/app/pages/entry.page.ts', import.meta.url), 'utf8');
  const card = await readFile(new URL('../src/app/pages/entry-card.ts', import.meta.url), 'utf8');
  const quick = await readFile(new URL('../src/app/pages/quick-entry.ts', import.meta.url), 'utf8');
  assert.match(source, /entry-created-feedback/);
  assert.match(source, /!this\.entryId/);
  assert.match(source, /NEW_ENTRY_SESSION_KEY/);
  assert.match(card, /sessionStorage\.removeItem\(NEW_ENTRY_SESSION_KEY\)/);
  assert.match(card, /entry-category-pulse/);
  assert.match(quick, /sessionStorage\.setItem\(NEW_ENTRY_SESSION_KEY,savedId\)/);
  assert.match(card, /560ms/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(card, /prefers-reduced-motion:reduce/);
});
