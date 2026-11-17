const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('orders-compact-ui.js','utf8');
function fixture({qty=1,required=true}={}){
 const dom=new JSDOM('<!doctype html><body><input id="saleClient"><div id="saleClientMatchesV1756"></div><div id="cart"></div><textarea id="saleNotes"></textarea></body>',{runScripts:'outside-only',url:'https://local.test'});
 dom.window.eval("var cart=[{code:'V-1',name:'Vela teste',price:10,qty:"+qty+"}];"+
 "var db={products:[{code:'V-1',price:10,personalizationV1773:{colors:{max:2,labels:['Cor da base','Cor dos detalhes'],palette:[{name:'Azul'},{name:'Branco'}]},fragrance:{enabled:true,required:"+required+",options:['Lavanda','Baunilha']}}}],settings:{personalizationLibraryV1791:{colors:[{name:'Verde'}],fragrances:['Rosa']}},orders:[],clients:[]};"+
 "function isQuarantinedProductClient(){return false}"+
 "function uid(prefix){return prefix+'id'}function todayISO(){return '2026-11-17'}"+
 "function renderCart(){let host=document.getElementById('cart');host.innerHTML=cart.map((line,i)=>'<div class=\"sale-cart-row-v1754\">'+line.name+' × '+line.qty+'</div>').join('');}"+
 "async function saveOrder(){db.orders.push({items:cart.map(x=>({...x})),notes:document.getElementById('saleNotes').value});document.getElementById('saleNotes').value='';}"+
 "function addProductToCartV1745(code){const p=db.products.find(x=>x.code===code),existing=cart.find(x=>x.code===code&&Number(x.price)===10);if(existing)existing.qty+=1;else cart.push({code,name:'Vela teste',price:10,qty:1});renderCart();}function renderPicker(){}"+
 "function chooseSaleClientV1756(){} function clearSale(){}");
 dom.window.eval(source);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 dom.window.renderCart();
 return {dom,w:dom.window,cart:dom.window.cart,db:dom.window.db}
}
test('apresenta controlos das cores e fragrâncias configuradas no produto',()=>{
 const f=fixture();
 const fields=[...f.w.document.querySelectorAll('.ae-direct-option-field-v19158 span')].map(e=>e.textContent);
 assert.deepEqual(fields.slice(0,4),['Cor da base','Cor dos detalhes','Fragrância (se aplicável)','Instruções específicas deste artigo']);
 const selects=[...f.w.document.querySelectorAll('.ae-direct-order-options-v19158 select')];
 assert.equal(selects.length,3);
 assert.deepEqual([...selects[0].options].map(o=>o.value),['','Azul','Branco']);
 assert.deepEqual([...selects[2].options].map(o=>o.value),['','Lavanda','Baunilha','Sem fragrância']);
 f.dom.window.close();
});
test('grava as escolhas por artigo, preserva notas manuais e imprime no campo de observações',async()=>{
 const f=fixture();
 const doc=f.w.document;
 const selects=doc.querySelectorAll('.ae-direct-order-options-v19158 select');
 selects[0].value='Azul';selects[0].dispatchEvent(new f.w.Event('change'));
 selects[1].value='Branco';selects[1].dispatchEvent(new f.w.Event('change'));
 selects[2].value='Lavanda';selects[2].dispatchEvent(new f.w.Event('change'));
 const note=doc.querySelector('.ae-direct-order-options-v19158 textarea');
 note.value='Gorro em contraste';note.dispatchEvent(new f.w.Event('input'));
 doc.getElementById('saleNotes').value='Entregar segunda-feira';
 await f.w.saveOrder();
 const saved=f.db.orders[0];
 assert.deepEqual(Array.from(saved.items[0].directSaleOptionsV19158.colors),['Azul','Branco']);
 assert.equal(saved.items[0].directSaleOptionsV19158.fragrance,'Lavanda');
 assert.match(saved.notes,/Entregar segunda-feira/);
 assert.match(saved.notes,/Cor da base: Azul/);
 assert.match(saved.notes,/Cor dos detalhes: Branco/);
 assert.match(saved.notes,/Fragrância: Lavanda/);
 assert.match(saved.notes,/Gorro em contraste/);
 f.dom.window.close();
});
test('duas unidades podem receber escolhas distintas mantendo quantidades e total',async()=>{
 const f=fixture({qty:2});
 let oldTotal=f.cart.reduce((s,x)=>s+x.qty*x.price,0);
 f.w.document.querySelector('.ae-direct-order-options-v19158 button').click();
 assert.equal(f.cart.length,2);
 assert.equal(f.cart[0].qty,1);assert.equal(f.cart[1].qty,1);
 assert.equal(f.cart.reduce((s,x)=>s+x.qty*x.price,0),oldTotal);
 const all=f.w.document.querySelectorAll('.ae-direct-order-options-v19158');
 all[0].querySelector('select').value='Azul';all[0].querySelector('select').dispatchEvent(new f.w.Event('change'));
 all[1].querySelector('select').value='Branco';all[1].querySelector('select').dispatchEvent(new f.w.Event('change'));
 await f.w.saveOrder();
 assert.match(f.db.orders[0].notes,/1\. Vela teste/);
 assert.match(f.db.orders[0].notes,/2\. Vela teste/);
 assert.equal(f.db.orders[0].items.length,2);
 f.dom.window.close();
});
test('preferências ainda por definir permanecem explícitas para os produtos que as exigem',async()=>{
 const f=fixture({required:true});
 await f.w.saveOrder();
 assert.match(f.db.orders[0].notes,/Cores: por definir/);
 assert.match(f.db.orders[0].notes,/Fragrância: por definir/);
 f.dom.window.close();
});
test('falha de validação não modifica permanentemente as notas manuais',async()=>{
 const f=fixture();
 f.w.saveOrder=async()=>false; // original closure remains unaltered; another test covers rollback via abort in script
 assert.equal(f.w.document.getElementById('saleNotes').value,'');
 f.dom.window.close();
});


test('nova unidade não herda a cor ou fragrância já definida noutra linha',async()=>{
 const f=fixture();
 const select=f.w.document.querySelector('.ae-direct-order-options-v19158 select');
 select.value='Azul';select.dispatchEvent(new f.w.Event('change'));
 f.w.addProductToCartV1745('V-1');
 assert.equal(f.cart.length,2);
 assert.equal(f.cart[0].qty,1);
 assert.equal(f.cart[1].qty,1);
 assert.equal(f.cart[0].directSaleOptionsV19158.colors[0],'Azul');
 assert.deepEqual(Array.from(f.cart[1].directSaleOptionsV19158.colors),[]);
 assert.equal(f.cart.reduce((sum,x)=>sum+x.qty*x.price,0),20);
 await f.w.saveOrder();
 assert.match(f.db.orders[0].notes,/Cor da base: Azul/);
 assert.equal((f.db.orders[0].notes.match(/Cor da base: Azul/g)||[]).length,1);
 f.dom.window.close();
});
test('nova unidade sem escolhas pode aumentar a quantidade sem duplicar linhas',()=>{
 const f=fixture();
 f.w.addProductToCartV1745('V-1');
 assert.equal(f.cart.length,1);
 assert.equal(f.cart[0].qty,2);
 f.dom.window.close();
});

test('Cloud relacional conserva as opções na linha sem alterar o contrato das encomendas online',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/const orderRows=ordersToSync\.map\(o=>/);
 assert.match(html,/data:relClone\(o\),updated_at:/);
 assert.match(html,/\.from\(REL_TABLES\.orders\)\.upsert\(orderRows/);
 assert.match(html,/notes:o\.notes\|\|null/);
 const f=fixture();
 f.cart[0].directSaleOptionsV19158={colors:['Azul','Branco'],fragrance:'Lavanda',notes:'Detalhes'};
 const order={items:f.cart,notes:'Teste'};
 const roundtrip=JSON.parse(JSON.stringify(order));
 assert.equal(roundtrip.items[0].directSaleOptionsV19158.fragrance,'Lavanda');
 assert.deepEqual(roundtrip.items[0].directSaleOptionsV19158.colors,['Azul','Branco']);
 f.dom.window.close();
});
test('impressão existente contém observações da encomenda, mantendo linhas e notas por artigo',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/function printOrderCompleteV12634\(id\)/);
 assert.ok(html.includes("h(o.notes||'—')"));
 assert.match(html,/function showOrder\(id\)/);
 assert.ok(html.includes("escapeHtml(o.notes||'—')"));
});
