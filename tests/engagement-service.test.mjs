import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compiled = {};
for (const name of ['engagement','data.service']) compiled[name] = ts.transpileModule(await readFile(new URL(`../src/app/core/${name}.ts`, import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
function fixture(initial={}) {
 const records = new Map(Object.entries({'users/me':{uid:'me',createdAt:1,badges:[],...initial}}));
 const constraints = name => (...args)=>({[name]:args});
 const snap = path => ({id:path.split('/').at(-1), exists:()=>records.has(path),data:()=>records.get(path)});
 const sdk = {
  Firestore:'db',collection:(_db,...parts)=>parts.join('/'),doc:(_db,...parts)=>parts.join('/'),
  where:constraints('where'),orderBy:constraints('orderBy'),limit:constraints('limit'),documentId:()=> '__name__',
  query:(path,...parts)=>({path,parts}),
  getDocs:async q=>{const docs=[...records.keys()].filter(k=>k.startsWith(q.path+'/')).map(snap);return {docs,empty:!docs.length,size:docs.length};},
  setDoc:async(path,data)=>records.set(path,data),
  runTransaction:async(_db,work)=>work({get:async path=>snap(path),set:(path,data)=>records.set(path,data),update:(path,data)=>records.set(path,{...records.get(path),...data})}),
 };
 const modules={'@angular/core':{Injectable:()=>x=>x,inject:token=>token==='auth'?{requireUser:()=>({uid:'me'})}:{},runInInjectionContext:(_i,f)=>f()},'@angular/fire/firestore':sdk,'./auth.service':{AuthService:'auth',validUid:s=>!!s&&!s.includes('/')},'./models':{}};
 const engagement={};new Function('exports',compiled.engagement)(engagement);modules['./engagement']=engagement;
 const result={};new Function('require','exports',compiled['data.service'])(name=>modules[name],result);
 return {service:new result.DataService(),records};
}
test('sync unions permanent badges and uses durable days after a queue item disappears',async()=>{
 const {service,records}=fixture({badges:['full-queue']});
 const today=new Date();const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
 await service.recordActivity(yesterday.getTime());await service.recordActivity(today.getTime());
 const state=await service.syncEngagement([],[]);
 assert.equal(state.streakCount,2);assert.deepEqual(state.badges,['full-queue']);
 assert.equal(records.get('users/me').streakCount,2);
});
test('profile visit writes one receipt and never changes the visited user',async()=>{
 const {service,records}=fixture();records.set('users/friend',{uid:'friend'});
 await service.recordProfileVisit('friend');await service.recordProfileVisit('friend');await service.recordProfileVisit('me');
 assert.deepEqual(records.get('users/friend'),{uid:'friend'});
 assert.equal(records.get('users/friend/visits/me').visitorId,'me');
 assert.equal(records.has('users/me/visits/me'),false);
});
test('new achievements are reported once persisted and preserved on lower totals',async()=>{
 const {service}=fixture();const entry={category:'livro',createdAt:Date.now(),updatedAt:Date.now()};
 const first=await service.syncEngagement([entry],[]);assert.deepEqual(first.newBadges,['first-entry']);
 const second=await service.syncEngagement([],[]);assert.deepEqual(second.badges,['first-entry']);assert.deepEqual(second.newBadges,[]);
});
test('a broken sequence reports recovery while retaining achievements',async()=>{
 const {service}=fixture({streakCount:7,lastActivityDate:'2020-01-01',badges:['first-entry']});
 const state=await service.syncEngagement([],[]);
 assert.equal(state.streakCount,0);assert.equal(state.broken,true);assert.deepEqual(state.badges,['first-entry']);
});
test('pending badges are keyed by account and cleared on acknowledgement',async()=>{
 const {service}=fixture();
 service.pendingBadges.set('other',['cinephile']);service.pendingBadges.set('me',['full-queue']);
 const state=await service.syncEngagement([],[]);assert.deepEqual(state.newBadges,['full-queue']);
 service.acknowledgeBadges();assert.equal(service.pendingBadges.has('me'),false);assert.deepEqual(service.pendingBadges.get('other'),['cinephile']);
});
