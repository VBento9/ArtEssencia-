'use strict';
// Browser test with fake values and disabled external network. No production writes.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const base=process.cwd();
const fakeOrder=()=>({
 id:'BX-TESTE-APENAS',_rid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 source:'box_quote',originBoxRequestId:'11111111-1111-4111-8111-111111111111',
 sourceBoxTechnicalVersion:3,client:'Cliente fictício',contact:'912345678',email:'teste@example.invalid',
 created:'2026-11-21',delivery:'2026-12-02',status:'Pedido',payment:'A definir',
 paid:0,paymentHistory:[],notes:'Cores: bege e verde\nFragrâncias: maçã e especiarias\nDedicatória: Parabéns',
 box:'Caixa Kraft',boxes:1,boxCostSnapshot:15.50,
 boxCustomerPreferences:{colors:'bege e verde',scents:'maçã e especiarias',dedication:'Parabéns',occasion:'Natal',packaging:'kraft',notes:'sem laço'},
 items:[
  {code:'C01',type:'box_component',name:'Vela fictícia',qty:2,price:0,cost:0},
  {code:'C02',type:'box_component',name:'Sabonete fictício',qty:1,price:0,cost:0},
  {code:'',type:'quote_adjustment',name:'Valor total aprovado da Box',qty:1,price:25,cost:0}
 ]
});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{width:1366,height:900},{width:800,height:1100},{width:412,height:915}]){
   const page=await browser.newPage({viewport});
   await page.route('**/*',async route=>{
    const url=route.request().url();
    if(!url.startsWith('http://127.0.0.1:8765/'))return route.abort();
    const local=new URL(url),name=decodeURIComponent(local.pathname)==='/'?'/index.html':decodeURIComponent(local.pathname);
    const target=path.resolve(base,'.'+name);
    if(!target.startsWith(base+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.abort();
    const mime=target.endsWith('.html')?'text/html':target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':target.endsWith('.svg')?'image/svg+xml':target.endsWith('.json')?'application/json':'application/octet-stream';
    return route.fulfill({status:200,body:fs.readFileSync(target),contentType:mime});
   });
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof showOrder==='function'&&typeof printOrderCompleteV12634==='function'&&typeof renderOrders==='function',{timeout:20000});
   await page.evaluate(order=>{
    document.querySelector('#authGateV1880')?.remove();
    document.querySelectorAll('.lock-screen,.auth-gate').forEach(x=>x.remove());
    document.querySelectorAll('dialog[open]').forEach(x=>x.close());
    db.orders=[order];
    db.productionRuns=[];
    db.products=[];
    if(typeof go==='function')go('orders');
    renderOrders();
    showOrder(order.id);
   },fakeOrder());
   const state=await page.evaluate(()=>{
    const o=db.orders[0],result=calcOrder(o);
    return {
     id:o.id,qty:result.qty,total:result.total,cost:result.cost,
     rows:document.querySelectorAll('#orderDetail .cart-row').length,
     detail:document.querySelector('#orderDetail')?.textContent||'',
     note:document.querySelector('#detailNotes')?.value||'',
     hasBoxSelector:!!document.querySelector('#detailBox'),
     hasAdd:!!document.querySelector('[data-existing-order-add-v19160]'),
     personalized:productionOrderPersonalizationV12653(o)
    };
   });
   assert.equal(state.qty,3);
   assert.equal(state.total,25);
   assert.equal(state.cost,15.50);
   assert.equal(state.rows,2,'Quote adjustment must not appear in product rows');
   assert.ok(state.detail.includes('Box personalizada · proposta aceite'));
   assert.ok(state.detail.includes('25,00'));
   assert.ok(state.note.includes('Fragrâncias: maçã e especiarias'));
   assert.equal(state.hasBoxSelector,false,'Fixed packaging cannot be changed here');
   assert.equal(state.hasAdd,false,'Accepted quote cannot add items');
   assert.ok(state.personalized.join().includes('Fragrâncias: maçã e especiarias'));
   const guard=await page.evaluate(()=>{
    const before=JSON.stringify(db.orders[0].items);
    editOrderQty('BX-TESTE-APENAS',0,9);
    removeOrderItem('BX-TESTE-APENAS',0);
    return {unchanged:JSON.stringify(db.orders[0].items)===before};
   });
   assert.equal(guard.unchanged,true,'Accepted composition must be protected');
   const popupPromise=page.waitForEvent('popup');
   await page.evaluate(()=>printOrderCompleteV12634('BX-TESTE-APENAS'));
   const popup=await popupPromise;
   await popup.waitForLoadState('domcontentloaded');
   const print=await popup.evaluate(()=>{
    const cards=[...document.querySelectorAll('section.card')];
    const find=name=>cards.find(x=>x.querySelector('h3')?.textContent===name);
    return {
     text:document.body.textContent,
     products:find('Produtos da encomenda')?.querySelectorAll('tbody tr').length,
     units:find('Produtos da encomenda')?.querySelector('.totals strong')?.textContent,
     hasMultiline:find('Observações')?.querySelector('[style*="white-space:pre-line"]')!=null,
     materialProducts:find('Plano de materiais desta encomenda')?.querySelectorAll('.product').length
    };
   });
   assert.equal(print.products,2);
   assert.equal(print.units,'3','Only physical products count as units');
   assert.equal(print.materialProducts,2,'Quote adjustment cannot create material profile');
   assert.equal(print.hasMultiline,true);
   assert.ok(print.text.includes('Fragrâncias: maçã e especiarias'));
   assert.ok(print.text.includes('Proposta de Box aceite'));
   assert.ok(!print.text.includes('Valor total aprovado da Box'));
   console.log('PASS: Box UI/print on '+viewport.width+'px');
   await popup.close();await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
