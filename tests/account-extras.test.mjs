import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/pages/account-extras.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
function signal(value){const read=()=>value;read.set=v=>value=v;return read;}
function componentHarness({uid='me',owner='me',profile={},fail=false}={}){
 const calls=[];const auth={user:()=>({uid:owner})};const data={getProfile:async()=>({uid,displayName:'Ana',...profile}),allEntries:async()=>[{id:'one',title:'Livro'}],getNotificationPreferences:async()=>({enabled:false,matchInQueue:false,reactions:false,streakReminder:false}),setNowWatching:async value=>{calls.push(['watch',value]);if(fail)throw Error();},setNotificationPreferences:async value=>calls.push(['prefs',value])};
 const modules={'@angular/core':{Component:()=>x=>x,Input:()=>()=>{},inject:t=>t==='auth'?auth:data,signal},'@angular/common':{DatePipe:class{}},'@angular/forms':{FormsModule:class{}},'../core/auth.service':{AuthService:'auth'},'../core/data.service':{DataService:'data'},'../core/diary-export':{buildDiaryHtml:(entries,name)=>JSON.stringify([entries,name]),downloadDiaryHtml:(html,name)=>calls.push(['export',html,name])},'../core/models':{CATEGORIES:[{value:'livro',icon:'📚',singular:'Livro'}]}};
 const exports={};new Function('require','exports',code)(name=>modules[name],exports);const page=new exports.AccountExtras();page.uid=uid;return {page,calls};
}
test('status expira após sete dias e não aparece para visitantes',async()=>{const old=Date.now()-8*86400000;const {page}=componentHarness({owner:'other',profile:{nowWatching:{title:'Livro',category:'livro',since:old,expiresAt:old+7*86400000}}});await page.load();assert.equal(page.watching(),null);assert.equal(page.isOwner(),false);});
test('owner saves, clears now watching, and saves private notification preferences',async()=>{const {page,calls}=componentHarness();await page.load();page.startEdit();page.title='Livro';page.category='livro';await page.saveWatching();assert.equal(page.watching().title,'Livro');assert.equal(calls[0][0],'watch');await page.clearWatching();assert.equal(page.watching(),null);page.prefs.enabled=true;await page.savePreferences();assert.equal(calls[2][0],'prefs');assert.equal(calls[2][1].enabled,true);});
test('failed now-watching save keeps edit mode and exposes an error',async()=>{const {page}=componentHarness({fail:true});page.startEdit();page.title='Livro';page.category='livro';await page.saveWatching();assert.equal(page.editing(),true);assert.ok(page.error());});
test('owner can download an HTML diary built from their complete entry history',async()=>{const {page,calls}=componentHarness();await page.load();await page.exportDiary();assert.equal(calls[0][0],'export');assert.match(calls[0][1],/Ana/);assert.match(calls[0][2],/\.html$/);assert.equal(page.exporting(),false);});
