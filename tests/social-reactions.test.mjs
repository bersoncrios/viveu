import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
function signal(value){const read=()=>value;read.set=next=>{value=next};return read;}
function compile(source){return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;}
async function reactionHarness({uid='me',author='friend',rows=[],toggle=async()=>{}}={}){
 const source=await readFile(new URL('../src/app/pages/reaction-bar.ts',import.meta.url),'utf8'),exports={};
 const auth={user:signal({uid})};const data={getEntryReactions:async()=>rows,toggleReaction:toggle};
 const modules={'@angular/core':{Component:()=>v=>v,effect:fn=>fn(),inject:t=>t==='auth'?auth:data,input:Object.assign(()=>signal(''),{required:()=>signal('') }),signal},'../core/auth.service':{AuthService:'auth'},'../core/data.service':{DataService:'data'},'../core/models':{}};
 new Function('require','exports',compile(source))(name=>{assert.ok(name in modules,name);return modules[name]},exports);
 const bar=new exports.ReactionBar();bar.entryId.set('entry');bar.authorId.set(author);await bar.load('entry',uid);return {bar,data,auth};
}
test('reaction counts and current choice load for signed-in viewers',async()=>{const {bar}=await reactionHarness({rows:[{uid:'me',emoji:'🔥'},{uid:'other',emoji:'🔥'},{uid:'other2',emoji:'❤️'}]});assert.equal(bar.counts()['🔥'],2);assert.equal(bar.counts()['❤️'],1);assert.equal(bar.mine(),'🔥');assert.equal(bar.canReact(),true);});
test('owners cannot react to their own entry',async()=>{const {bar}=await reactionHarness({author:'me'});assert.equal(bar.canReact(),false);});
test('successful reaction toggles and reloads canonical counts',async()=>{let writes=0;const {bar}=await reactionHarness({toggle:async()=>{writes++},rows:[]});await bar.toggle('😮');assert.equal(writes,1);assert.equal(bar.busy(),false);});
