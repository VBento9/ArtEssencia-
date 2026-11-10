const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('technical-fragrances-v1.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function fixture(){
 const window={},db={settings:{},stock:[{name:'Fragrância A',qty:80,unitCost:0.07}],stockMoves:[{id:'past'}],purchases:[{id:'purchase'}],orders:[{id:'order'}]};
 let saves=0;const toasts=[];
 new Function('window','db','save','toast','confirm','document','crypto','escapeHtml','URL','Blob','setTimeout',source)(
   window,db,()=>{saves++;return true},message=>toasts.push(message),()=>true,{},null,x=>x,URL,Blob,setTimeout);
 return {window,db,toasts,get saves(){return saves}};
}
test('Biblioteca Técnica integrada no Backoffice principal sem alterar motor de produção',()=>{
 assert.match(html,/<section id="technicalLibrary" class="screen">/);
 assert.match(html,/\['technicalLibrary','Biblioteca Técnica'\]/);
 assert.match(html,/window\.renderTechnicalLibraryV1/);
 assert.match(html,/return completeProductionAtomicV1926\(run,ords\)/);
 assert.match(html,/cloudClient\.rpc\('artessencia_complete_production_backoffice_v1'/);
 assert.match(sw,/\/technical-fragrances-v1\.js/);
 assert.match(sw,/\/technical-fragrances-v1\.css/);
});
test('importação idempotente das 15 fragrâncias sem qualquer modificação ao stock',()=>{
 const f=fixture(),before=JSON.stringify({stock:f.db.stock,moves:f.db.stockMoves,purchases:f.db.purchases,orders:f.db.orders});
 f.window.aeFragrancesV1.importReceipt();
 let x=f.db.settings.technicalFragrancesV1;
 assert.equal(x.length,15);
 assert.deepEqual(x.filter(r=>r.name.startsWith('Maçã & Canela')).map(r=>r.originalName),['MANZANA & CANELA','CINNAMON APPLE']);
 assert.equal(x.filter(r=>['Figo','Flor de Lótus'].includes(r.name)).length,2);
 assert.ok(x.every(r=>r.family==='Por classificar'&&!r.archived));
 f.window.aeFragrancesV1.importReceipt();x=f.db.settings.technicalFragrancesV1;
 assert.equal(x.length,15);
 assert.equal(f.saves,1);
 assert.equal(JSON.stringify({stock:f.db.stock,moves:f.db.stockMoves,purchases:f.db.purchases,orders:f.db.orders}),before);
});
test('não existe escrita em stock ou lançamentos de compras nas fichas técnicas',()=>{
 for(const name of ['db.stock=','db.stock.push','db.stockMoves.push','db.purchases.push','db.cash.push'])assert.equal(source.includes(name),false);
 assert.match(source,/db\.settings\[FIELD\]=next/);
});
