import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path, modules = {}) {const exports = {};const source = readFileSync(new URL('../' + path, import.meta.url),'utf8');new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name => modules[name],exports);return exports;}
const {daysSinceActivity, oldestQueueItem, monthlyFriendRanking} = load('src/app/core/retention-ranking.ts');
const at = (day, month = 9) => new Date(2026, month, day, 12).getTime();
const entry = (id, authorId, createdAt, category = 'livro', extra = {}) => ({id,authorId,author:{displayName:authorId},title:id,category,rating:4,quote:'',createdAt,updatedAt:createdAt,...extra});

test('inactivity counts local calendar days and rejects missing or future dates', () => {
  assert.equal(daysSinceActivity('2026-10-10', at(13)), 3);
  assert.equal(daysSinceActivity('2026-10-12', at(13)), 1);
  assert.equal(daysSinceActivity('invalid', at(13)), null);
  assert.equal(daysSinceActivity(at(14), at(13)), null);
});

test('oldest queue entry is independent from visual order', () => {
  const queue = [{id:'new',createdAt:at(4),position:0},{id:'old',createdAt:at(1),position:3}];
  assert.equal(oldestQueueItem(queue).id, 'old');
  assert.equal(oldestQueueItem([]), null);
});

test('monthly ranks include self and followed users, calculate streak/categories, and ignore other months', () => {
  const entries = [entry('a','friend',at(1)),entry('b','friend',at(2),'filme'),entry('c','me',at(3),'jogo'),entry('old','friend',at(1,8))];
  const people = [{uid:'me',name:'Ana'},{uid:'friend',name:'Bia'},{uid:'quiet',name:'Caio'}];
  const result = monthlyFriendRanking(entries, people, 'me', 2026, 10);
  assert.deepEqual(result.registrations.slice(0,2).map(row => [row.uid,row.value]), [['friend',2],['me',1]]);
  assert.equal(result.streak.find(row => row.uid === 'friend').value, 2);
  assert.equal(result.categories.find(row => row.uid === 'friend').value, 2);
  assert.equal(result.registrations.find(row => row.uid === 'me').isCurrentUser, true);
  assert.equal(result.registrations.find(row => row.uid === 'quiet').value, 0);
});

test('rankings cap each metric at five people and break ties with the current user first', () => {
  const people = Array.from({length:7}, (_, index) => ({uid:`u${index}`,name:`Pessoa ${index}`}));
  const result = monthlyFriendRanking([], people, 'u6', 2026, 10);
  assert.equal(result.registrations.length, 5);
  assert.equal(result.registrations[0].uid, 'u6');
});
