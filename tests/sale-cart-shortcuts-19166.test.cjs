'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync('index.html','utf8'),c=fs.readFileSync('sale-cart-shortcuts-v19166.css','utf8'),sw=fs.readFileSync('sw.js','utf8'),ver=JSON.parse(fs.readFileSync('version.json','utf8'));
test('atalhos e navegação de secções',()=>{
 for(const x of ['sale-step-link-v19166','saleCartShortcutV19166','saleCartShortcutTextV19166','sale-cart-nav-v19166','saleNavigateV19166'])assert.ok(h.includes(x),x);
});
test('resumo depende do carrinho, e não persiste encomendas',()=>{
 const start=h.indexOf('function saleUpdateCartShortcutV19166(){'),end=h.indexOf('function clearSale(){',start);
 assert.ok(start>0&&end>start);
 const s=h.slice(start,end);
 for(const x of ['cart.reduce(','saleFinalTotalV1813()','bar.hidden=qty===0','scrollIntoView'])assert.ok(s.includes(x),x);
 for(const x of ['localStorage.setItem','db.orders.push','cloudClient','saveOrder(','cart.splice(','cart=[]'])assert.ok(!s.includes(x),x);
 assert.ok(h.includes('renderSalePromoV1813();saleUpdateCartShortcutV19166()}'));
});
test('estilo responsivo apenas para Vendas',()=>{
 assert.ok(c.includes('#sale .sale-cart-shortcut-v19166'));
 assert.ok(c.includes('@media(max-width:1199px)'));
 assert.ok(h.includes('href="./sale-cart-shortcuts-v19166.css"'));
});
test('versão PWA 1.9.166 alinhada',()=>{
 assert.equal(ver.app,'1.9.166');
 assert.ok(sw.includes('artessencia-backoffice-1.9.166'));
 assert.ok(sw.includes('"/sale-cart-shortcuts-v19166.css"'));
 assert.ok(h.includes("const APP_VERSION='1.9.166'"));
});
