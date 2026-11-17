'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,850,1280]){
   const context=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'});
   const page=await context.newPage();
   page.on('dialog',d=>d.dismiss());
   await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:8765'?route.continue():route.abort());
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!document.getElementById('taskPlanning')&&!!document.getElementById('aeDeliveryFocusControlsV19165'),{timeout:20000});
   const result=await page.evaluate(()=>{
    if(typeof db==='undefined'||typeof renderDashboardDaily!=='function')throw Error('Dados principais não disponíveis');
    const today=(()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day})();
    const shift=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
    const originalOrders=db.orders;
    const base={client:'Encomenda fictícia',paid:0,items:[{name:'Produto de teste',qty:1,price:50,cost:10}],source:'direct'};
    db.orders=[
     {...base,id:'TEST-LATE',status:'Em produção',delivery:shift(-2)},
     {...base,id:'TEST-TODAY',status:'Pronta',delivery:today},
     {...base,id:'TEST-NEXT',status:'Confirmada',delivery:shift(2)},
     {...base,id:'TEST-DONE',status:'Entregue',delivery:shift(-1)},
     {...base,id:'TEST-VOID',status:'Cancelado',delivery:shift(-1)}
    ];
    renderDashboardDaily();
    const all=[...document.querySelectorAll('#dashboardTodayList [data-dashboard-order]')].map(x=>x.dataset.dashboardOrder);
    const filter=key=>{
     document.querySelector('#aeDeliveryFocusControlsV19165 button[aria-pressed="false"]')?.getAttribute('aria-pressed');
     const buttons=[...document.querySelectorAll('#aeDeliveryFocusControlsV19165 button')];
     const b=buttons.find(x=>x.textContent.startsWith(key));if(!b)throw Error('Filtro ausente: '+key);
     b.click();
     return [...document.querySelectorAll('#dashboardTodayList [data-dashboard-order]')].map(x=>x.dataset.dashboardOrder);
    };
    const late=filter('Atrasadas'),future=filter('Próximas'),todayRows=filter('Hoje');
    const tasks=document.getElementById('taskPlanning'),dash=document.getElementById('dashboard'),nav=document.querySelector('#nav [data-page="taskPlanning"]');
    const separate=!!tasks&&!dash.contains(tasks)&&!!nav&&!!document.getElementById('aeTaskManagerV2');
    db.orders=originalOrders;renderDashboardDaily();
    return{all,late,future,todayRows,separate};
   });
   assert.equal(result.separate,true,'módulo de tarefas independente do Dashboard');
   assert.deepEqual(result.all,['TEST-LATE','TEST-TODAY','TEST-NEXT']);
   assert.deepEqual(result.late,['TEST-LATE']);
   assert.deepEqual(result.future,['TEST-NEXT']);
   assert.deepEqual(result.todayRows,['TEST-TODAY']);
   await context.close();
  }
  console.log('PASS: módulo autónomo + filtros entregas em 390/850/1280 px, com dados fictícios');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
