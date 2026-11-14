import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function load(path, modules = {}, browser = {}) {const exports = {};const source = readFileSync(new URL('../' + path, import.meta.url),'utf8');new Function('require','exports','document','navigator','File',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText)(name => {assert.ok(modules[name],name);return modules[name];},exports,browser.document,browser.navigator,browser.File);return exports;}
function signal(value) {const read=()=>value;read.set=next=>{value=next;};return read;}
const models=load('src/app/core/models.ts');
const summary=load('src/app/core/monthly-summary.ts',{'./models':models});
const errors=load('src/app/core/data-error.ts');
async function wrapped({share, canShare = true}={}) {
  const drawn=[], downloads=[], canvases=[];
  const context={fillRect(){},fillText(text){drawn.push(text);},measureText(text){return {width:text.length*15};},drawImage(){}};
  const document={createElement(tag){if(tag==='canvas'){const canvas={width:0,height:0,rectangles:[],getContext(){return {...context,fillRect:(...args)=>canvas.rectangles.push(args)};},toBlob:callback=>callback(new Blob(['png'],{type:'image/png'}))};canvases.push(canvas);return canvas;}return {click(){downloads.push(this.download);}};}};
  const route={paramMap:{pipe:()=>({subscribe(){}})}};
  const auth={profile:()=>({displayName:'Ana'})};
  const dependencies={auth,data:{},route};
  const {WrappedPage}=load('src/app/pages/wrapped.page.ts',{'@angular/common':{DecimalPipe:class{}},'@angular/core':{Component:()=>value=>value,DestroyRef:'destroy',inject:token=>dependencies[token],signal},'@angular/core/rxjs-interop':{takeUntilDestroyed:()=>null},'@angular/router':{ActivatedRoute:'route',RouterLink:class{}},'../core/auth.service':{AuthService:'auth'},'../core/data.service':{DataService:'data'},'../core/models':models,'../core/monthly-summary':summary,'../core/data-error':errors,'../shared/skeleton-card':{SkeletonCard:class{}}},{document,navigator:{canShare:()=>canShare,share},File:class{constructor(_bytes,name){this.name=name;}}});
  return {page:new WrappedPage(),drawn,downloads,canvases};
}
test('wrapped downloads a real PNG when file sharing is unavailable',async()=>{const {page,drawn,downloads}=await wrapped({canShare:false});page.summary.set({total:1,average:5,maximum:2,categories:[{category:'livro',count:1}],top:{title:'Uma história'},quote:{quote:'Uma frase'}});page.label.set('outubro de 2026');await page.share();assert.equal(downloads.length,1);assert.ok(downloads[0].endsWith('.png'));assert.ok(drawn.includes('“Uma frase”'));assert.equal(page.sharing(),false);assert.match(page.notice(),/Imagem pronta/);});
test('cancelling native sharing preserves preview without reporting an error',async()=>{const {page,downloads}=await wrapped({share:async()=>{throw Object.assign(new Error('Cancelado'),{name:'AbortError'});}});const preview={total:0,average:null,maximum:0,categories:[],top:null,quote:null};page.summary.set(preview);await page.share();assert.equal(page.summary(),preview);assert.equal(page.notice(),'');assert.equal(downloads.length,0);assert.equal(page.sharing(),false);});


test('wrapped PNG fills the entire source and output background for long content', async () => {
  const {page, canvases} = await wrapped({canShare:false});
  page.summary.set({total:1,average:5,maximum:2,categories:models.CATEGORIES.map(item => ({category:item.value,count:1})),top:{title:'T'.repeat(160)},quote:{quote:'Q'.repeat(500)}});
  await page.share(true);
  assert.equal(canvases.length, 2);
  const [source, output] = canvases;
  assert.ok(output.height > 1350, 'fixture must cover the original background boundary');
  assert.ok(source.rectangles.some(rect => rect[0] === 0 && rect[1] === 0 && rect[2] === source.width && rect[3] === source.height));
  assert.ok(output.rectangles.some(rect => rect[0] === 0 && rect[1] === 0 && rect[2] === output.width && rect[3] === output.height));
});
