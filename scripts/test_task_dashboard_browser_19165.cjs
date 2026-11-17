'use strict';
/* Teste de navegação isolado: nunca escreve em produção ou na Cloud. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:8765';
const browserTest=async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1100]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e)));
   page.on('dialog',d=>d.accept());
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    return route.abort();
   });
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>typeof go==='function'&&typeof renderDashboard==='function'&&document.querySelector('#nav button[data-page="taskPlanning"]')&&document.getElementById('aeTaskManagerV2')&&document.getElementById('aeDeliveryFocusControlsV19165'),{timeout:30000});
   const result=await page.evaluate(()=>{
    // Neutraliza apenas chamadas de escrita/Cloud num navegador descartável.
    window.scheduleCloudPushV1860=()=>{};
    window.queueOrderBusinessSyncV1757=()=>{};
    document.getElementById('authGateV1880')?.remove();
    if(typeof finishAppUnlockV19135==='function')finishAppUnlockV19135();
    const now=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    const iso=now.year+'-'+now.month+'-'+now.day;
    const shifted=n=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
    const one=(id,status,delivery,paid=0)=>({id,status,created:iso,delivery,client:'Cliente '+id,items:[{code:'FIXTURE',name:'Vela de teste',qty:1,price:50,cost:10}],paid});
    const original=Array.isArray(db.orders)?db.orders.slice():[];
    try{
     db.orders=[
      one('LATE','Em produção',shifted(-1),10),
      one('TODAY','Pronta',shifted(0),50),
      one('UPCOMING','Confirmada',shifted(2),0),
      one('DONE','Entregue',shifted(-2),0),
      one('CANCELLED','Cancelado',shifted(1),0)
     ];
     go('dashboard');renderDashboard();
     const counts=()=>Array.from(document.querySelectorAll('#dashboardTodayList .ae-delivery-focus-row')).map(x=>x.querySelector('.ae-delivery-focus-person small')?.textContent);
     const all=counts();
     document.querySelectorAll('#aeDeliveryFocusControlsV19165 button').forEach(b=>{if(b.textContent.startsWith('Atrasadas'))b.click()});
     const late=counts();
     document.querySelectorAll('#aeDeliveryFocusControlsV19165 button').forEach(b=>{if(b.textContent.startsWith('Hoje'))b.click()});
     const today=counts();
     document.querySelectorAll('#aeDeliveryFocusControlsV19165 button').forEach(b=>{if(b.textContent.startsWith('Próximas'))b.click()});
     const upcoming=counts();
     go('taskPlanning');
     const isolated=document.getElementById('taskPlanning')?.classList.contains('active')&&document.getElementById('taskPlanning')?.contains(document.getElementById('aeTaskManagerV2'))&&!document.getElementById('dashboard')?.contains(document.getElementById('aeTaskManagerV2'));
     const nav=document.querySelector('#nav button[data-page="taskPlanning"]')?.classList.contains('active');
     go('dashboard');
     const back=document.getElementById('dashboard')?.classList.contains('active');
     return {all,late,today,upcoming,isolated,nav,back,unchanged:JSON.stringify(db.orders)===JSON.stringify([one('LATE','Em produção',shifted(-1),10),one('TODAY','Pronta',shifted(0),50),one('UPCOMING','Confirmada',shifted(2),0),one('DONE','Entregue',shifted(-2),0),one('CANCELLED','Cancelado',shifted(1),0)])};
    }finally{db.orders=original}
   });
   assert.deepEqual(result.all,['LATE','TODAY','UPCOMING']);
   assert.deepEqual(result.late,['LATE']);
   assert.deepEqual(result.today,['TODAY']);
   assert.deepEqual(result.upcoming,['UPCOMING']);
   assert.equal(result.isolated,true,'O gestor existe apenas no módulo independente');
   assert.equal(result.nav,true,'O menu identifica o módulo ativo');
   assert.equal(result.back,true,'É possível regressar ao Dashboard');
   assert.equal(result.unchanged,true,'A vista não modifica encomendas');
   if(errors.length)console.log('Avisos de serviços sem Cloud:',errors.slice(0,3));
   await context.close();
  }
  console.log('PASS: Dashboard compacto e módulo de tarefas em 390 e 1100 px, apenas com dados de teste.');
 }finally{await browser.close()}
};
browserTest().catch(e=>{console.error(e);process.exitCode=1});
