'use strict';
// Serve only Intelligence scripts and a synthetic runtime, never the production app.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','intelligence');
const scripts=new Set(['stock-review-ui.js','review-guard.js','control-core.js','inventory-audit.js','stock-organizer.js','batch-review.js']);
const fixture=`<!doctype html><html lang="pt"><meta charset="utf-8"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><main id="stock"><div class="stock-hero">Stock</div></main>
<script>
let unlocked=true,cloudStartupDone=true,cloudBusy=false,cloudApplying=false,cloudHydrating=false,cloudPushRunning=false,cloudUser={id:'fixture-owner'};
let meta={verified:true,dirty:false,conflict:false,remoteRevision:7},owner=true,calls=0;
let db={stock:[{name:'Cera',qty:500,unit:'g',unitCost:0.02},{name:'Pavio',qty:8,unit:'un',unitCost:0.1}],products:[{code:'A'}],productRecipes:{A:[{item:'Cera',qty:20,unit:'g'}]}};
function cloudMeta(){return meta}
function initCloudClient(){return {auth:{getUser:async()=>({data:{user:cloudUser}})},rpc:async(name)=>{calls++;if(name!=='artessencia_is_owner_v1')throw Error('Unexpected RPC');return {data:owner}}}}
</script><script src="/intelligence/stock-review-ui.js"></script></html>`;
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fixture);}
  const name=req.url?.split('/').pop();
  if(req.url==='/intelligence/'+name&&scripts.has(name)){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});return res.end(fs.readFileSync(path.join(root,name)));}
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  const panel=page.locator('#aeIntelligenceStockPreview');await panel.waitFor();
  const toggle=panel.getByLabel('Ativar agente nesta sessão');
  assert.equal(await toggle.isChecked(),false);
  assert.equal(await panel.getByRole('button',{name:'Analisar inventário e fichas'}).isDisabled(),true);
  await toggle.check();
  await panel.getByRole('button',{name:'Analisar inventário e fichas'}).click();
  await panel.getByText(/2 materiais · 1 produtos/).waitFor();
  const input=panel.getByLabel('Lista de inventário físico');
  const prepare=panel.getByRole('button',{name:'Preparar revisão'});
  await input.fill('Cera; 1; kg\nPavio; 0; un\nNova; 2; ml');
  await prepare.click();
  await panel.getByText(/Novo material — por validar/).waitFor();
  assert.equal(await panel.getByLabel(/Nova ·/).isDisabled(),true);
  await panel.getByLabel(/Cera · Saldo contado/).check();
  await page.evaluate(()=>meta.remoteRevision++);
  await panel.getByRole('button',{name:'Aprovar seleção (sem gravar)'}).click();
  await panel.getByText(/Missão indisponível ou autorização alterada/).waitFor();
  await prepare.click();
  await panel.getByLabel(/Cera · Saldo contado/).check();
  await panel.getByRole('button',{name:'Aprovar seleção (sem gravar)'}).click();
  await panel.getByText(/1 ajustes aprovados para pré-visualização/).waitFor();
  assert.equal(await page.evaluate(()=>db.stock[0].qty),500);
  await page.evaluate(()=>{unlocked=false;document.getElementById('lockScreen').classList.remove('hidden')});
  await panel.getByText('Agente desligado.',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),'');assert.equal(await toggle.isChecked(),false);
  await page.evaluate(()=>{unlocked=true;owner=false;document.getElementById('lockScreen').classList.add('hidden')});
  await toggle.check();await panel.getByRole('button',{name:'Analisar inventário e fichas'}).click();
  await panel.getByText(/Acesso reservado ao proprietário/).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: browser stock review, stale revision, no writes, lock cleanup and owner denial');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
