// Isolated responsive regression: no external network, no Cloud writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [360,390,430,768,1120]){
   const context=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'});
   const page=await context.newPage();
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof go==='function'&&!!document.getElementById('saleClient'));
   await page.evaluate(()=>{document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();go('sale')});
   const result=await page.evaluate(()=>{
    const q=s=>document.querySelector(s),box=q('.sale-client-new-v19157'),input=q('.sale-client-new-v19157 input'),client=q('.sale-client-autocomplete-v1756'),grid=q('.sale-customer-grid-v1727');
    if(!box||!input||!client||!grid)throw Error('Missing client fields');
    const rect=e=>e.getBoundingClientRect();
    return {checkboxWidth:rect(input).width,checkboxHeight:rect(input).height,labelHeight:rect(box).height,clientHeight:rect(client).height,clientWidth:rect(client).width,gridWidth:rect(grid).width,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.ok(result.checkboxWidth<=22&&result.checkboxWidth>=16,JSON.stringify(result));
   assert.ok(result.checkboxHeight<=22&&result.checkboxHeight>=16,JSON.stringify(result));
   assert.ok(result.labelHeight<90,JSON.stringify(result));
   assert.ok(result.clientHeight<210,JSON.stringify(result));
   assert.ok(result.scrollWidth<=width+2,JSON.stringify(result));
   console.log('PASS responsive client checkbox '+width+'px',JSON.stringify(result));
   await context.close();
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
