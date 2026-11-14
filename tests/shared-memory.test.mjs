import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
function signal(value){const read=()=>value;read.set=next=>{value=next;};read.update=fn=>{value=fn(value);};return read;}
async function pageHarness({send=async()=>{},messages=[]}={}){
 const memory={id:'m1',participants:['me','friend'],workTitle:'Um livro',workCategory:'livro',messageCount:0,createdAt:1,updatedAt:1};
 const data={sharedMemory:async()=>memory,sharedMemoryMessages:async()=>messages,sendSharedMemoryMessage:send};
 const auth={ready:Promise.resolve(),user:()=>({uid:'me'})};
 const source=await readFile(new URL('../src/app/pages/shared-memory.page.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>({ '@angular/core':{Component:()=>x=>x,inject:token=>token==='auth'?auth:token==='data'?data:{snapshot:{paramMap:{get:()=> 'm1'}}},signal},'@angular/common':{DatePipe:class{}},'@angular/forms':{FormsModule:class{}},'@angular/router':{ActivatedRoute:'route',RouterLink:class{}},'../core/auth.service':{AuthService:'auth'},'../core/data.service':{DataService:'data'},'../core/models':{},'../core/data-error':{dataErrorMessage:(_e,f)=>f}}[name]),exports);
 const page=new exports.SharedMemoryPage();await new Promise(resolve=>setImmediate(resolve));return page;
}
test('memory page loads only its data-service-authorized participant conversation',async()=>{const page=await pageHarness({messages:[{id:'x',uid:'friend',text:'Spoiler',hasSpoiler:true,createdAt:2}]});assert.equal(page.memory().id,'m1');assert.equal(page.messages().length,1);assert.deepEqual(page.revealed(),[]);page.reveal('x');assert.deepEqual(page.revealed(),['x']);});
test('sending a message passes trimmed body and spoiler choice then clears only after confirmation',async()=>{const calls=[];const page=await pageHarness({send:async(...args)=>calls.push(args)});page.draft='  Gostei muito.  ';page.hasSpoiler=true;await page.send();assert.deepEqual(calls,[['m1',{text:'Gostei muito.',hasSpoiler:true}]]);assert.equal(page.draft,'');assert.equal(page.hasSpoiler,false);});
test('failed memory send preserves draft and shows retryable error',async()=>{const page=await pageHarness({send:async()=>{throw Error('offline');}});page.draft='Minha impressão';await page.send();assert.equal(page.draft,'Minha impressão');assert.equal(page.error(),'Não foi possível enviar a mensagem.');assert.equal(page.sending(),false);});
