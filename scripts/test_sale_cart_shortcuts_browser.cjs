'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,768,800,1024,1280]){
   const context=await browser.newContext({viewport:{width,height:width===800?1280:950},reducedMotion:'reduce',serviceWorkers:'block'});
   const page=await context.newPage(),errors=[];
   page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8765'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:8765');
   await page.waitForFunction(()=>typeof saleNavigateV19166==='function'&&typeof addProductToCartV1745==='function');
   await page.evaluate(()=>{
    document.getElementById('authGateV1880')?.remove();finishAppUnlockV19135();
    db.products=[{code:'F01',name:'Vela teste',price:12,category:'Velas',cost:3,active:true},{code:'F02',name:'Outra vela',price:8,category:'Velas',cost:2,active:true}];
    db.packaging=[];db.orders=[];db.stock=[];cart=[];go('sale');renderPicker();renderCart();
    window.__originalOrders=JSON.stringify(db.orders);
   });
   const bar=page.locator('#saleCartShortcutV19166');
   assert.equal(await bar.isVisible(),false);
   await page.evaluate(()=>addProductToCartV1745('F01'));
   assert.equal(await bar.isVisible(),width<=1199);
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/1 unidade/);
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/12,00/);
   await page.evaluate(()=>addProductToCartV1745('F02'));
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/2 unidades/);
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/20,00/);
   await page.evaluate(()=>setDirectOrderLineQtyV19158(0,3));
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/4 unidades/);
   assert.match(await page.locator('#saleCartShortcutTextV19166').innerText(),/44,00/);
   await page.evaluate(()=>{salePromoV1813={discount_total:3,_context:salePromoContextV1813()};renderSalePromoV1813()});
   assert.match(await page.locator('#saleCartShortcutTextV19166').textContent(),/41,00/);
   await page.evaluate(()=>clearSalePromoV1813());
   assert.match(await page.locator('#saleCartShortcutTextV19166').textContent(),/44,00/);
   if(width<=1199){
    await page.locator('.sale-cart-open-v19166').click();
    assert.ok(await page.locator('.sale-cart-side-v1754').evaluate(el=>el===document.activeElement));
    const section=await page.evaluate(()=>document.querySelector('#sale .sale-cart-side-v1754').getBoundingClientRect().top);
    assert.ok(section<950,'cart scroll');
    await page.locator('.sale-cart-nav-v19166').getByText('Voltar aos produtos').click();
    const products=await page.evaluate(()=>document.querySelector('#sale .sale-products-browser-v1754').getBoundingClientRect().top);
    assert.ok(products<950,'products scroll');
    await page.getByRole('button',{name:'Rever cliente e entrega'}).click();
    assert.ok(await page.locator('.sale-customer-card-v1727').evaluate(el=>el===document.activeElement));
    await page.getByRole('button',{name:'Escolher produtos',exact:true}).click();
    assert.ok(await page.locator('.sale-products-browser-v1754').evaluate(el=>el===document.activeElement));
   }
   await page.evaluate(()=>{cart=[];renderCart()});
   assert.equal(await bar.isVisible(),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(db.orders)===window.__originalOrders),true);
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS resumo e navegação 390/768/800/1024/1280');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
