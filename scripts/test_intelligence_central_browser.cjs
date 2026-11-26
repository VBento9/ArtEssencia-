'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','intelligence');
const fixture='<!doctype html><html lang="pt"><meta charset="utf-8"><div id="authGateV1880" class="hidden"></div><div id="lockScreen" class="hidden"></div><main id="dashboard"><div class="dashboard-hero">Dashboard</div></main><script>let unlocked=true;</script><script src="/intelligence/central-ui.js"></script></html>';
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fixture);}
  const name=req.url?.split('/').pop();if(req.url==='/intelligence/'+name&&['central-ui.js','control-core.js'].includes(name)){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});return res.end(fs.readFileSync(path.join(root,name)));}
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  const panel=page.locator('#aeIntelligenceCentral');await panel.getByRole('button',{name:'Abrir central de agentes'}).click();
  const master=panel.getByLabel('Ativar simulação da equipa');await master.waitFor();assert.equal(await master.isChecked(),false);
  assert.equal(await panel.getByLabel('Modo de Stock',{exact:true}).isDisabled(),true);
  assert.equal(await panel.locator('select[aria-label^="Modo de "]').count(),9);
  await master.check();await panel.getByLabel('Modo de Stock',{exact:true}).selectOption('manual');
  await panel.getByLabel('Agente destinatário').selectOption('stock');
  await panel.getByLabel('Tipo de missão').selectOption('inventory_audit');
  await panel.getByLabel('Instruções da missão').fill('Inventário de teste.');
  await panel.getByRole('button',{name:'Preparar missão local'}).click();
  await panel.getByText('Preparada — não enviada, não executada',{exact:true}).waitFor();
  await panel.getByLabel('Modo de Stock',{exact:true}).selectOption('off');
  await panel.getByText('Cancelada',{exact:true}).waitFor();
  await page.evaluate(()=>{unlocked=false;document.getElementById('lockScreen').classList.remove('hidden')});
  await panel.getByRole('button',{name:'Abrir central de agentes'}).waitFor();
  assert.equal(await panel.getByText('Inventário de teste.',{exact:true}).count(),0);
  await page.evaluate(()=>{unlocked=true;document.getElementById('lockScreen').classList.add('hidden')});
  await panel.getByRole('button',{name:'Abrir central de agentes'}).click();
  await master.waitFor();assert.equal(await master.isChecked(),false);assert.deepEqual(errors,[]);
  console.log('PASS: central preview, nine agents, controls, local mission, revocation, lock cleanup');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
