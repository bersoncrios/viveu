import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const m = {};
new Function('exports', ts.transpileModule(await readFile(new URL('../src/app/core/engagement.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(m);
const day = n => new Date(2026, 10, n, 12).getTime();
test('streak deduplicates days, tolerates today pending and resets after gap', () => {
 assert.equal(m.calculateStreak([day(10),day(11),day(11),day(12)], new Date(day(13))),3);
 assert.equal(m.calculateStreak([day(10),day(11)], new Date(day(13))),0);
 assert.equal(m.calculateStreak([day(13),day(14)], new Date(day(13))),1);
});
test('streak crosses month/year boundaries using calendar days', () => {
 assert.equal(m.calculateStreak([new Date(2025,11,31,12).getTime(),new Date(2026,0,1,12).getTime()],new Date(2026,0,1,13)),2);
});
test('badges have exact thresholds and legacy entries count as complete', () => {
 const entries = Array.from({length:10},(_,i)=>({category: i < 5 ? 'filme' : i < 9 ? 'livro' : 'jogo'}));
 assert.deepEqual(m.badgesFor(entries,Array(5).fill({}),true,true),['first-entry','avid-reader','cinephile','first-together','public-profile','full-queue','explorer']);
 assert.deepEqual(m.badgesFor([{category:'livro',status:'in_progress'}],[]),[]);
});
test('history ranges clamp month ends and include seven local dates', () => {
 const ranges=m.historyRanges(new Date(2026,2,31));
 const month=ranges[2];
 assert.equal(m.localDay(month.start),'2026-02-25');
 assert.equal(m.localDay(month.end),'2026-03-04');
});
test('activity excludes unfinished entries except saved notes and includes queue', () => {
 assert.deepEqual(m.activityDates([{status:'in_progress',createdAt:1,updatedAt:2,notes:[{createdAt:3}]}],[{createdAt:4}]),[3,4]);
});
