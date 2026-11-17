'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,768,1024,1280]){
   const context=await browser.newContext({viewport:{width,height:920},serviceWorkers:'block'});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',d=>d.accept());
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof saveOrder==='function'&&typeof renderPicker==='function'&&typeof clearSaleProductFiltersV19165==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();
    finishAppUnlockV19135();
    scheduleCloudPushV1860=()=>{};scheduleRelationalSync=()=>{};
    syncOrderBusinessStateV1757=async()=>false;
    nextManualOrderId=async()=> 'AS-2026-6500';
    cloudClient=null;cloudUser=null;
    db.orders=[];db.clients=[];db.cash=[];db.productionRuns=[];db.stock=[];db.packaging=[];
    db.products=Array.from({length:52},(_,i)=>({
      code:'VELA-'+String(i).padStart(3,'0'),name:'Vela de teste '+String(i),
      category:'Velas',price:12,cost:3,active:true,tagsV1753:[i%2?'Presente':'Decoração']
    }));
    cart=[];
    document.getElementById('saleClient').value='Cliente de teste';
    document.getElementById('saleContact').value='912345678';
    document.getElementById('saleDate').value='2026-11-25';
    document.getElementById('salePaid').value='0';
    go('sale');
    renderPicker();
   });
   assert.equal(await page.locator('#saleBox').isVisible(),false,'embalagem oculta');
   assert.equal(await page.locator('#saleBoxes').isVisible(),false,'n.º caixas oculto');
   assert.equal(await page.locator('#productPicker button.sale-product-btn-v1754').count(),24,'primeiros 24 produtos');
   await page.locator('#salePickerMoreV19165 button').click();
   assert.equal(await page.locator('#productPicker button.sale-product-btn-v1754').count(),48);
   await page.locator('#saleProductSearchV1754').fill('Vela de teste 51');
   assert.equal(await page.locator('#productPicker button.sale-product-btn-v1754').count(),1);
   await page.locator('#sale .sale-clear-product-filters-v19165').click();
   assert.equal(await page.locator('#productPicker button.sale-product-btn-v1754').count(),24);
   await page.locator('#productPicker button.sale-product-btn-v1754').first().click();
   assert.equal(await page.evaluate(()=>cart.length),1);
   const rect=await page.locator('#sale .sale-product-btn-v1754').first().evaluate(el=>({
     title:parseFloat(getComputedStyle(el.querySelector('strong')).fontSize),
     price:parseFloat(getComputedStyle(el.querySelector('.price')).fontSize),
     w:el.getBoundingClientRect().width,
   }));
   assert.ok(rect.title>=13&&rect.price>=14,JSON.stringify(rect));
   const dimensions=await page.evaluate(()=>{
     const el=document.querySelector('#sale');
     const parent=el.parentElement;
     return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,saleWidth:el.scrollWidth,saleClientGridWidth:el.querySelector('.sale-customer-grid-v1727').clientWidth,body:parent.clientWidth};
   });
   if(width<=1024)assert.ok(dimensions.pageWidth<=width+3,JSON.stringify(dimensions));
   if(width===1024||width===768){
    const layout=await page.evaluate(()=>{
     const a=document.querySelector('.sale-products-browser-v1754').getBoundingClientRect();
     const b=document.querySelector('.sale-cart-side-v1754').getBoundingClientRect();
     return {aX:a.x,bX:b.x,aW:a.width,bW:b.width,cartBelow:b.top>=a.bottom-5};
    });
    assert.equal(layout.cartBelow,true,JSON.stringify(layout));
   }
   await page.evaluate(()=>saveOrder());
   await page.waitForFunction(()=>db.orders.some(o=>o.id==='AS-2026-6500'));
   const saved=await page.evaluate(()=>{
    const o=db.orders.find(o=>o.id==='AS-2026-6500');
    const storage=JSON.parse(localStorage.getItem(KEY)).orders.find(x=>x.id===o.id);
    return {box:o.box,boxes:o.boxes,boxCost:o.boxCostSnapshot,total:o.total,items:o.items.length,stored:!!storage};
   });
   assert.deepEqual(saved,{box:'',boxes:0,boxCost:0,total:12,items:1,stored:true});
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS: Venda 390/768/1024/1280px, sem embalagem dupla, filtros, carrinho e gravação local sem Cloud.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
