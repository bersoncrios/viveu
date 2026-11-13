// Browser-only responsive QA. Requires a disposable Chrome with CDP on localhost:9337.
// Private app screens use in-memory fixtures; no Firebase writes or login are performed.
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = 'http://127.0.0.1:4211';
const output = path.resolve('test-results/responsive');
await mkdir(output, {recursive: true});
const tabs = await (await fetch('http://127.0.0.1:9337/json/list')).json();
const tab = tabs.find(item => item.type === 'page');
if (!tab) throw new Error('Start a disposable Chrome with a blank tab first.');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
let sequence = 0;
const pending = new Map();
socket.onmessage = event => {
  const data = JSON.parse(event.data);
  const request = pending.get(data.id);
  if (request) {pending.delete(data.id); data.error ? request.reject(new Error(data.error.message)) : request.resolve(data.result);}
};
async function send(method, params = {}) {
  const id = ++sequence;
  const result = new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
  socket.send(JSON.stringify({id, method, params}));
  let timer;
  const timeout = new Promise((_, reject) => {timer = setTimeout(() => {pending.delete(id); reject(new Error('CDP timeout: ' + method));}, 20000);});
  try {return await Promise.race([result, timeout]);} finally {clearTimeout(timer);}
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + (result.exceptionDetails.exception?.description || ''));
  return result.result.value;
}
async function waitFor(expression) {
  const until = Date.now() + 20000;
  while (Date.now() < until) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Page did not become ready: ' + expression);
}
const checks = [];
async function measure(name, width, height = 844) {
  await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 768});
  await evaluate('window.scrollTo(0,0)');
  await new Promise(resolve => setTimeout(resolve, 180));
  const result = await evaluate(`(() => {
    const viewport = document.documentElement.clientWidth;
    return {viewport, scrollWidth: document.documentElement.scrollWidth,
      title: document.querySelector('h1')?.innerText,
      shell: !!document.querySelector('.sidebar'),
      clipped: [...document.querySelectorAll('h1,h2,p,input,select,textarea,.button,.mobile-nav')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width && getComputedStyle(el).visibility !== 'hidden' && (rect.left < -1 || rect.right > viewport + 1);
      }).map(el => ({tag:el.tagName, text:el.innerText?.slice(0,60), class:el.className}))};
  })()`);
  const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  await writeFile(path.join(output, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));
  checks.push({page: name, width, ...result});
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [name, route] of [['home', '/'], ['login', '/login?returnUrl=%2Fdiary']]) {
    await send('Page.navigate', {url: base + route});
    await waitFor(`!!document.querySelector('${name === 'home' ? '.home-hero' : '.signin-card'}')`);
    for (const width of [320, 360, 390, 768, 1024, 1440]) await measure(name, width);
    if (await evaluate('!!document.querySelector(".sidebar,.mobile-header,.mobile-nav")')) throw new Error('App navigation leaked into ' + name);
    if (name === 'home') {
      await evaluate("document.querySelector('.hero-actions .button').click()");
      await waitFor("!!document.querySelector('.signin-card')");
      await evaluate("document.querySelector('.signin-back').click()");
      await waitFor("!!document.querySelector('.home-hero')");
      await evaluate("document.querySelector('.skip-link').focus()");
      await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
      await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
      if (!await evaluate("document.activeElement.id === 'main'")) throw new Error('Skip link did not move keyboard focus to main');
    }
  }
  // Enter a new, empty form before replacing DataService methods with read-only fixtures.
  await evaluate(`(async () => {
    const app = ng.getComponent(document.querySelector('app-root'));
    await app.auth.ready;
    app.auth.user.set({uid:'responsive-fixture', displayName:'Uma pessoa com um nome público bastante comprido'});
    app.auth.profile.set({uid:'responsive-fixture',displayName:'Uma pessoa com um nome público bastante comprido',bio:'',photoURL:''});
    await app.router.navigateByUrl('/entry/new');
  })()`);
  await waitFor("!!document.querySelector('app-entry-page')");
  await evaluate(`(() => {
    const page = ng.getComponent(document.querySelector('app-entry-page'));
    const db = page.data;
    const profile = {uid:'responsive-fixture',displayName:'Uma pessoa com um nome público bastante comprido',bio:'Histórias, descobertas e boas conversas. '.repeat(4),photoURL:''};
    const note = {id:'note-one',text:'Uma impressão com palavras e lembranças. '.repeat(15),createdAt:Date.now(),containsSpoilers:false};
    const item = {id:'fixture-entry',authorId:profile.uid,author:profile,title:'Uma obra com um título bastante longo que merece ser lembrada',category:'livro',rating:4,status:'in_progress',reason:'Uma recomendação de uma amiga e uma curiosidade antiga.',resumePoint:'Capítulo 8, página 142',notes:[note],reflection:'O que ficou comigo nesta experiência? '.repeat(20),quote:'Uma frase para guardar.',feelings:['inspirado','curioso','emocionado'],createdAt:Date.now(),updatedAt:Date.now()};
    db.entriesPage = async () => ({items:[item],cursor:null,hasMore:false});
    db.feedPage = db.entriesPage;
    db.activeJourneys = async () => [item];
    db.following = async () => [{uid:'friend-fixture'}];
    db.getProfile = async uid => ({...profile,uid});
    db.queue = async () => [1,2,3].map(i=>({id:'queue-'+i,title:item.title,category:'livro',reason:item.reason,position:i,createdAt:Date.now()}));
    db.getEntry = async () => item;
    for (const method of ['saveEntry','addQueue','moveQueue','removeQueue','deleteEntry','follow','unfollow']) db[method] = async () => {throw new Error('Browser QA forbids writes');};
    page.title = item.title;page.reason=item.reason;page.notes=[note];page.reflection=item.reflection;ng.applyChanges(page);
  })()`);
  for (const width of [320, 360, 390, 768, 1024, 1440]) await measure('entry-fixture', width);
  for (const [name, route, selector] of [
    ['feed-fixture','/feed','app-feed-page'], ['diary-fixture','/diary','app-diary-page'],
    ['queue-fixture','/queue','app-queue-page'], ['profile-fixture','/u/responsive-fixture','app-profile-page'],
  ]) {
    await evaluate(`ng.getComponent(document.querySelector('app-root')).router.navigateByUrl(${JSON.stringify(route)})`);
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
    await new Promise(resolve => setTimeout(resolve, 150));
    for (const width of [320, 360, 390, 768, 1024, 1440]) await measure(name, width);
  }
  // Hold the component's initialization after its route guard, then stub the new singleton.
  // This avoids even a configuration read against the connected Firebase project.
  await evaluate(`(async () => {
    const app = ng.getComponent(document.querySelector('app-root'));
    const originalReady = app.auth.ready; await originalReady;
    let first = true; const waiting = [];
    app.auth.ready = {then(resolve) {if (first) {first = false; resolve();} else waiting.push(resolve);}};
    await app.router.navigateByUrl('/together?queue=queue-1');
    const page = ng.getComponent(document.querySelector('app-together-page'));
    if (!page) throw new Error('Shared route did not activate');
    const own = {uid:'responsive-fixture',displayName:'Uma pessoa com um nome público bastante comprido',photoURL:'',role:'owner',state:'active',progress:2,status:'in_progress',entryId:'fixture-entry',entryPublished:false,rating:null,reflection:'',joinedAt:Date.now(),invitedAt:Date.now(),updatedAt:Date.now()};
    const friend = {...own,uid:'friend-fixture',displayName:'Uma amiga com outro nome público comprido',role:'member',progress:8,status:'completed',rating:5,reflection:'Reflexão final de exemplo que deve começar oculta.'};
    const group = {id:'group-fixture',ownerId:own.uid,ownerName:own.displayName,title:'Um livro para descobrir com pessoas queridas',category:'livro',description:'Cada pessoa no seu tempo, com espaço para descobertas e boas conversas.',pace:'milestones',unit:'capitulo',memberIds:[own.uid,friend.uid],invitedIds:['pending-fixture'],audienceIds:[own.uid,friend.uid,'pending-fixture'],milestones:[{id:'first-milestone',title:'Nossa primeira conversa sobre os capítulos 1 a 5',position:5,meetingAt:Date.now()+86400000,question:'Você teria feito a mesma escolha que a personagem?'}],archived:false,createdAt:Date.now(),updatedAt:Date.now()};
    const invitedGroup = {...group,id:'group-invitation',ownerId:friend.uid,ownerName:friend.displayName,memberIds:[friend.uid],invitedIds:[own.uid],audienceIds:[own.uid,friend.uid]};
    const posts = [{id:'own-note',authorId:own.uid,authorName:own.displayName,text:'Uma descoberta que quero guardar com o grupo. '.repeat(15),kind:'note',progress:2,containsSpoilers:false,publishedPublicly:false,createdAt:Date.now()},{id:'ahead-note',authorId:friend.uid,authorName:friend.displayName,text:'SEGREDO DE TESTE ALÉM DO PROGRESSO',kind:'session',progress:8,containsSpoilers:false,publishedPublicly:false,createdAt:Date.now()}];
    const service = page.shared;
    service.ensureAvailable = async () => {};
    service.list = async () => ({items:[group,invitedGroup],cursor:null,hasMore:false});
    service.get = async id => id === invitedGroup.id ? invitedGroup : group;
    service.membership = async id => id === invitedGroup.id ? {...own,role:'member',state:'invited'} : own;
    service.members = async id => {if (id === invitedGroup.id) throw new Error('Invited UI cannot read members'); return [own,friend,{...friend,uid:'pending-fixture',displayName:'Uma companhia que ainda não aceitou',state:'invited',status:'in_progress',rating:null}];};
    service.posts = async id => {if (id === invitedGroup.id) throw new Error('Invited UI cannot read posts'); return {items:posts,cursor:null,hasMore:false};};
    for (const method of ['create','invite','respond','updateProgress','leave','archive','addMilestone','addPost','finish']) service[method] = async () => {throw new Error('Browser QA forbids shared writes');};
    app.auth.ready = originalReady; waiting.forEach(resolve => resolve());
  })()`);
  await waitFor("!!document.querySelector('.shared-create')");
  for (const width of [320, 360, 390, 768, 1024, 1440]) await measure('together-create-fixture', width);
  await evaluate("ng.getComponent(document.querySelector('app-root')).router.navigateByUrl('/together/group-fixture')");
  await waitFor("!!document.querySelector('.shared-wall')");
  await waitFor("!!document.querySelector('.shared-post-list article')");
  await evaluate(`(() => {
    document.querySelector('.shared-disclosure').open = true;
    const page = ng.getComponent(document.querySelector('app-together-detail-page'));
    page.people.set([{uid:'another-fixture',displayName:'Uma companhia com um nome público bastante comprido',bio:'Uma bio que também precisa caber bem nas telas menores.'}]);
    page.peopleSearched.set(true);
  })()`);
  if (await evaluate("document.body.innerText.includes('SEGREDO DE TESTE')")) throw new Error('Ahead-of-progress text leaked into the mural DOM');
  if (await evaluate("document.body.innerText.includes('Reflexão final de exemplo')")) throw new Error('Final reflection was not hidden');
  if (await evaluate("document.querySelector('input[name=postPublic]').checked || document.querySelector('input[name=finishPublic]').checked")) throw new Error('Public sharing was enabled by default');
  for (const width of [320, 360, 390, 768, 1024, 1440]) await measure('together-detail-fixture', width);
  await evaluate("ng.getComponent(document.querySelector('app-root')).router.navigateByUrl('/together/group-invitation')");
  await waitFor("!!document.querySelector('.shared-invitation')");
  if (await evaluate("!!document.querySelector('.shared-wall,.shared-member-list,.shared-finish-form')")) throw new Error('Invitation rendered member-only content');
  for (const width of [320, 360, 390, 768, 1024, 1440]) await measure('together-invitation-fixture', width);
  await writeFile(path.join(output, 'report.json'), JSON.stringify(checks, null, 2));
  const failures = checks.filter(check => check.scrollWidth > check.viewport + 1 || check.clipped.length);
  console.log(JSON.stringify({screens: checks.length, failures, output}, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {socket.close();}
