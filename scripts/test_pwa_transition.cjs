// Real Chromium service-worker transition from the version served by production.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{
 let latest=false,future=false;const old=new Map();
 const server=http.createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(path.includes('..')){res.writeHead(400).end();return}
  try{
   let body;
   if(latest)body=path==='version.json'&&future?JSON.stringify({app:'99.0.0',channel:'artessencia-backoffice-stable'}):fs.readFileSync(path);
   else{if(!old.has(path))old.set(path,cp.execFileSync('git',['show','fb4beb7d2fc08db2e082da6dfecb05e38c3e8ad2:'+path],{maxBuffer:5*1024*1024,stdio:['ignore','pipe','ignore']}));body=old.get(path)}
   const type=path.endsWith('.html')?'text/html':path.endsWith('.js')?'application/javascript':path.endsWith('.json')?'application/json':path.endsWith('.css')?'text/css':path.endsWith('.webmanifest')?'application/manifest+json':'image/png';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Service-Worker-Allowed':'/'}).end(body);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(r=>server.listen(8766,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8766'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8766');
  await page.waitForFunction(()=>typeof APP_VERSION==='string'&&APP_VERSION==='1.9.38');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.waitForSelector('#authGateV1880',{state:'visible'});
  // The legacy release shows its update banner behind login. Model a signed-in editor
  // in this isolated fixture; never dismiss authentication on the real service.
  await page.evaluate(()=>document.getElementById('authGateV1880').remove());
  await page.evaluate(async()=>{
   localStorage.setItem('release-preserve','local-value');sessionStorage.setItem('release-preserve','session-value');
   await new Promise((resolve,reject)=>{const r=indexedDB.open('release-preserve',1);r.onupgradeneeded=()=>r.result.createObjectStore('values');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('values','readwrite');t.objectStore('values').put('idb-value','key');t.oncomplete=()=>{db.close();resolve()}}});
   document.getElementById('stockName').value='UNSAVED MATERIAL';
  });
  latest=true;
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();window.dispatchEvent(new Event('online'))});
  await page.waitForSelector('#ae-update-available',{timeout:30000});
  assert.equal(await page.evaluate(()=>APP_VERSION),'1.9.38');
  assert.equal(await page.locator('#stockName').inputValue(),'UNSAVED MATERIAL');
  // The worker may initiate a second navigation; assert the resulting version explicitly.
  await page.locator('#ae-update-available button').click({noWaitAfter:true});
  await page.waitForFunction(()=>typeof APP_VERSION==='string'&&APP_VERSION==='1.9.39');
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('release-preserve'),sessionStorage.getItem('release-preserve')]),['local-value','session-value']);
  assert.equal(await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('release-preserve');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('values').objectStore('values').get('key');q.onsuccess=()=>{db.close();resolve(q.result)}}})),'idb-value');
  assert.equal(await page.evaluate(()=>document.getElementById('stockImageFileV1771').hasAttribute('capture')),false);
  // A future update must remain clickable even above the real login overlay.
  await page.waitForSelector('#authGateV1880',{state:'visible'});
  future=true;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForSelector('#ae-update-available');
  assert.equal(await page.locator('#ae-update-available button').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el}),true);
  console.log('PASS: real Chromium worker 1.9.38 → 1.9.39; unsaved form retained until explicit refresh; localStorage/sessionStorage/IndexedDB preserved; new Stock picker loaded without reinstall.');
  await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
