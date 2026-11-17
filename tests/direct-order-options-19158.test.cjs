const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const vm=require('node:vm');
function lineSummary(line,db){const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('function directOrderLineInstructionsV19158('),b=html.indexOf('function printOrderCompleteV12634(',a);assert.ok(a>=0&&b>a);const ctx={db};vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);return [...ctx.directOrderLineInstructionsV19158(line)]}
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
test('grava as escolhas por artigo e mantém as notas manuais independentes',async()=>{
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
 assert.equal(saved.notes,'Entregar segunda-feira');
 assert.deepEqual(lineSummary(saved.items[0],f.db),['Cor da base: Azul','Cor dos detalhes: Branco','Fragrância: Lavanda','Instruções: Gorro em contraste']);
 assert.deepEqual([...saved.items[0].directSaleOptionsV19158.colorLabels],['Cor da base','Cor dos detalhes']);
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
 assert.equal(f.db.orders[0].items.length,2);
 assert.deepEqual(lineSummary(f.db.orders[0].items[0],f.db),['Cor da base: Azul','Fragrância: por definir']);
 assert.deepEqual(lineSummary(f.db.orders[0].items[1],f.db),['Cor da base: Branco','Fragrância: por definir']);
 assert.equal(f.db.orders[0].notes,'');
 f.dom.window.close();
});
test('preferências ainda por definir permanecem explícitas para os produtos que as exigem',async()=>{
 const f=fixture({required:true});
 await f.w.saveOrder();
 assert.deepEqual(lineSummary(f.db.orders[0].items[0],f.db),['Cores: por definir','Fragrância: por definir']);
 assert.equal(f.db.orders[0].notes,'');
 f.dom.window.close();
});
test('as notas manuais são preservadas independentemente da personalização',async()=>{
 const f=fixture();
 f.w.document.getElementById('saleNotes').value='Entregar às 11h';
 await f.w.saveOrder();
 assert.equal(f.db.orders[0].notes,'Entregar às 11h');
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
 assert.equal(lineSummary(f.db.orders[0].items[0],f.db).includes('Cor da base: Azul'),true);
 assert.equal(lineSummary(f.db.orders[0].items[1],f.db).includes('Cor da base: Azul'),false);
 assert.equal(f.db.orders[0].notes,'');
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

test('aumento de quantidade de artigo personalizado cria unidade sem preferências',()=>{
 const f=fixture();
 const select=f.w.document.querySelector('.ae-direct-order-options-v19158 select');
 select.value='Azul';select.dispatchEvent(new f.w.Event('change'));
 f.w.setDirectOrderLineQtyV19158(0,3);
 assert.equal(f.cart.length,2);
 assert.equal(f.cart[0].qty,1);
 assert.equal(f.cart[1].qty,2);
 assert.deepEqual(Array.from(f.cart[1].directSaleOptionsV19158.colors),[]);
 assert.equal(f.cart.reduce((t,x)=>t+x.qty*x.price,0),30);
 f.dom.window.close();
});
test('linhas sem personalização na Cloud não inventam cores nem fragrâncias',()=>{
 const f=fixture();
 assert.deepEqual(lineSummary({code:'V-1',name:'Vela',qty:1},f.db),[]);
 f.dom.window.close();
});
test('versão PWA e impressão estruturada pertencem ao mesmo release',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const version=JSON.parse(fs.readFileSync('version.json','utf8')).app;
 const sw=fs.readFileSync('sw.js','utf8');
 assert.match(html,new RegExp('content="'+version.replaceAll('.','\\.')+'"'));
 assert.ok(html.includes("const APP_VERSION='"+version+"'"));
 assert.ok(sw.includes("artessencia-backoffice-"+version));
 assert.ok(html.includes("directOrderLineInstructionsV19158(i).map(h).join(' · ')"));
 assert.ok(html.includes("directOrderLineInstructionsV19158(i).map(escapeHtml).join(' · ')"));
});
