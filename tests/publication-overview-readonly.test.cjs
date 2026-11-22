'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditProducts}=require('../catalog-publication-overview-v1.js');
function product(overrides={}){return {
 code:'AE1',name:'Vela fictícia',category:'Vela',catalogGroupV191:'velas-recipiente',
 shopDescription:'Descrição fictícia',shopImageUrl:'https://example.invalid/photo.jpg',
 price:15,published:false,shopVisible:false,...overrides
}}
test('resumo não confunde sinalização local com publicação real',()=>{
 const items=[product({published:true,shopVisible:true})];
 const result=auditProducts(items,()=>({kind:'reviewed'}));
 assert.equal(result.summary.ready,1);
 assert.equal(result.summary.markedCatalog,1);
 assert.equal(result.summary.markedShop,1);
 assert.equal(result.records[0].catalogMarked,true);
});
test('revisão obsoleta impede estado pronto, mesmo com dados completos',()=>{
 const result=auditProducts([product()],()=>({kind:'ready'}));
 assert.equal(result.summary.ready,0);
 assert.equal(result.summary.needsAttention,1);
});
test('fotografia e descrição em falta aparecem sem alterar objetos',()=>{
 const p=product({shopImageUrl:'',shopDescription:''}),before=JSON.stringify(p);
 const result=auditProducts([p],()=>({kind:'pending'}));
 assert.equal(result.summary.missingPhoto,1);
 assert.deepEqual(result.records[0].issues,['Descrição pública','Fotografia principal']);
 assert.equal(JSON.stringify(p),before);
});
test('preços só são exigidos para Loja sinalizada e quando aplicável',()=>{
 const r=auditProducts([product({price:0,shopVisible:true}),product({code:'AE2',price:0,shopVisible:true,publicPriceMode:'quote'})],()=>({kind:'reviewed'}));
 assert.equal(r.records[0].issues.includes('Preço de venda'),true);
 assert.equal(r.records[1].issues.includes('Preço de venda'),false);
});
test('códigos duplicados e registos apagados não causam publicação automática',()=>{
 const r=auditProducts([product(),product({name:'Outra vela'}),product({code:'X',deleted:true})],()=>({kind:'reviewed'}));
 assert.equal(r.summary.total,2);
 assert.equal(r.records.every(x=>x.issues.includes('Código duplicado')),true);
});
test('sem auditoria editorial carregada mantém diagnóstico conservador',()=>{
 const r=auditProducts([product()]);
 assert.equal(r.summary.reviewUnknown,1);
 assert.equal(r.summary.ready,0);
});
