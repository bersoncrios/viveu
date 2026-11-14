import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path, modules = {}) {const exports = {}; const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8'); new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => modules[name],exports); return exports;}
const models = load('src/app/core/models.ts');
const {monthlySummary, previousMonth, validWrappedMonth, suggestQueue} = load('src/app/core/monthly-summary.ts', {'./models':models});
const date = (day, month = 9) => new Date(2026,month,day,12).getTime();
const entry = (id, extra = {}) => ({id,title:id,category:'livro',status:'completed',rating:4,quote:'',createdAt:date(1),updatedAt:date(1),...extra});
test('previous month crosses year and current/future summaries are unavailable', () => {assert.deepEqual(previousMonth(new Date(2026,0,10)),{year:2025,month:12});assert.equal(validWrappedMonth(2026,10,new Date(2026,10,1)),true);assert.equal(validWrappedMonth(2026,11,new Date(2026,10,1)),false);assert.equal(validWrappedMonth(2026,13),false);});
test('monthly summary uses completion date, skips ongoing work and averages only ratings', () => {const summary = monthlySummary([entry('earlier',{createdAt:date(1,8),completedAt:date(2)}),entry('next',{completedAt:date(1,10)}),entry('ongoing',{status:'in_progress',rating:null}),entry('best',{rating:5,createdAt:date(3)})],2026,10);assert.equal(summary.total,2);assert.equal(summary.average,4.5);assert.equal(summary.top.title,'best');assert.deepEqual(summary.categories,[{category:'livro',count:2}]);});
test('wrapped streak deduplicates local days and counts ledger days within month', () => {const summary = monthlySummary([entry('one',{createdAt:date(1),updatedAt:date(1)})],2026,10,[date(2),date(3),date(5),date(30,8)]);assert.equal(summary.maximum,3);});
test('wrapped quotation chooses latest saved non-spoiler quote', () => {const summary = monthlySummary([entry('old',{quote:'Older'}),entry('new',{quote:'Recent',updatedAt:date(3)}),entry('spoiler',{quote:'Ending',containsSpoilers:true,updatedAt:date(4)})],2026,10);assert.equal(summary.quote.title,'new');});
test('queue suggestion picks favorite recent category, preserves priority and falls back', () => {const queue=[{id:'first',category:'filme',position:0,createdAt:date(1)},{id:'book2',category:'livro',position:2,createdAt:date(1)},{id:'book1',category:'livro',position:1,createdAt:date(1)}];assert.equal(suggestQueue([entry('one')],queue,date(10)).id,'book1');assert.equal(suggestQueue([],queue,date(10)).id,'first');assert.equal(suggestQueue([],[],date(10)),null);});
