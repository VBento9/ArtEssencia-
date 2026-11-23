'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditProducts,comparePublicFeed,publicationReadWithin}=require('../catalog-publication-overview-v1.js');
function product(overrides={}){return {
 code:'AE1',name:'Vela fictícia',category:'Vela',catalogGroupV191:'velas-recipiente',
 shopDescription:'Descrição fictícia',shopImageUrl:'https://example.invalid/photo.jpg',
 price:15,shopVisible:false,...overrides
}}
test('resumo não confunde sinalização local com publicação real',()=>{
 const items=[product({shopVisible:true})];
 const result=auditProducts(items,()=>({kind:'reviewed'}));
 assert.equal(result.summary.ready,1);
 assert.equal(result.summary.markedPublic,1);
 assert.equal(result.summary.unknownPublicIntent,0);
 assert.equal(result.records[0].publicIntent,true);
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

test('a marcação publicada inexistente não cria contagem falsa para Catálogo',()=>{
 const a=auditProducts([product({published:true,shopVisible:false})],()=>({kind:'reviewed'}));
 assert.equal(a.summary.markedPublic,0);
});
test('marcação pública desconhecida não é interpretada como falso',()=>{
 const p=product();delete p.shopVisible;
 const a=auditProducts([p],()=>({kind:'reviewed'}));
 assert.equal(a.summary.unknownPublicIntent,1);
});
test('identificação por origem é obrigatória para correspondência confirmada',()=>{
 const r=comparePublicFeed([product({id:'owner-123',shopVisible:true})],[{code:'AE1',backoffice_product_id:'different'}]);
 assert.equal(r.present,0);assert.equal(r.uncertain,1);assert.equal(r.missingMarked,0);
 assert.equal(r.originNotInDevice,1);
});
test('artigos do feed sem origem são quantificados separadamente',()=>{
 const r=comparePublicFeed([product({shopVisible:false})],[{code:'AE1',backoffice_product_id:null}]);
 assert.equal(r.withoutOrigin,1);assert.equal(r.uncertain,1);
});
test('feed vazio não gera falsas faltas de publicação',()=>{
 const r=comparePublicFeed([product({shopVisible:true})],[]);
 assert.equal(r.status,'empty');assert.equal(r.rows.length,0);
});
test('compara por código sem tomar nome como identidade',()=>{
 const r=comparePublicFeed([product({shopVisible:true}),product({code:'AE2',shopVisible:false,name:'Vela fictícia'})],[{code:'AE1',name:'Nome diferente'}]);
 assert.equal(r.status,'ok');assert.equal(r.present,0);assert.equal(r.uncertain,1);assert.equal(r.missingMarked,0);
});
test('diferenças entre sinalização local e feed são detetadas',()=>{
 const r=comparePublicFeed([product({id:'origin-a',shopVisible:true}),product({id:'origin-b',code:'AE2',shopVisible:false})],[{code:'AE2',backoffice_product_id:'origin-b'}]);
 assert.equal(r.missingMarked,1);assert.equal(r.unexpectedPresent,1);assert.equal(r.uncertain,0);
});
test('códigos repetidos nunca são reconciliados automaticamente',()=>{
 const r=comparePublicFeed([product({shopVisible:true}),product({published:true,name:'Outra peça'})],[{code:'AE1'}]);
 assert.equal(r.uncertain,2);assert.equal(r.missingMarked,0);
});
test('identificador da origem permite comparação com código diferente',()=>{
 const r=comparePublicFeed([product({code:'NOVO',id:'abc-123',shopVisible:true})],[{code:'ANTIGO',backoffice_product_id:'abc-123'}]);
 assert.equal(r.present,1);
});
test('painel consulta apenas as RPC de leitura e não modifica dados',()=>{
 const fs=require('node:fs'),src=fs.readFileSync('catalog-publication-overview-v1.js','utf8');
 for(const proc of ['store_public_catalog_v1','store_public_content_v3','store_public_config_v1'])assert.ok(src.includes("call('"+proc+"')"));
 assert.doesNotMatch(src,/\.\s*(?:insert|update|upsert|delete)\s*\(/);
});

test('o diagnóstico inicia depois do script editorial, sem corrida de carregamento',()=>{
 const fs=require('node:fs'),src=fs.readFileSync('catalog-classification-bulk-v192.js','utf8');
 assert.match(src,/review\.addEventListener\('load',loadOverview/);
 assert.match(src,/review\.addEventListener\('error',loadOverview/);
 assert.match(src,/review\.src='\/catalog-review-workflow-v1995\.js'/);
});

test('artigos do feed sem ligação são expostos só como diagnóstico',()=>{
 const p=product({_rid:'local-a',code:'A001',shopVisible:true});
 const r=comparePublicFeed([p],[{code:'A001',backoffice_product_id:'local-a',name:'Produto normal'},
  {code:'X001',name:'Vela teste 1',backoffice_product_id:'id-inexistente'}]);
 assert.equal(r.originNotInDevice,1);
 assert.equal(r.unlinkedRemote.length,1);
 assert.deepEqual(r.unlinkedRemote[0],{
  code:'X001',name:'Vela teste 1',reason:'Origem não encontrada no dispositivo'
 });
});
test('registos do feed sem identificador próprio são sinalizados',()=>{
 const r=comparePublicFeed([product({_rid:'abc'})],[{code:'A001',name:'Sem ligação',backoffice_product_id:null}]);
 assert.equal(r.unlinkedRemote.length,1);
 assert.equal(r.unlinkedRemote[0].reason,'Sem identificador de origem');
});
test('consulta requer sessão Cloud e não tem operações de escrita',()=>{
 const fs=require('node:fs'),src=fs.readFileSync('catalog-publication-overview-v1.js','utf8');
 assert.match(src,/ensureCloudSession\(\)/);
 assert.match(src,/if\(!user\?\.id\)throw Error/);
 assert.doesNotMatch(src,/\.\s*(?:insert|update|upsert|delete)\s*\(/);
});

test('Centro de Publicação integrado na lista compacta, não por cima do editor',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync('catalog-publication-overview-v1.js','utf8');
 assert.match(src,/list\.prepend\(section\)/);
 assert.doesNotMatch(src,/nav\.insertAdjacentElement\('afterend',section\)/);
 assert.match(src,/new MutationObserver\(/);
});

test('consulta Cloud não confia em utilizador memorizado e valida bloqueio e identidade',()=>{
 const fs=require('node:fs'),src=fs.readFileSync('catalog-publication-overview-v1.js','utf8');
 assert.match(src,/function publicationAccessAllowed\(\)/);
 assert.match(src,/publicationReadWithin\(\(\)=>ensureCloudSession\(\)/);
 assert.match(src,/publicationReadWithin\(\(\)=>client\.auth\.getUser\(\)/);
 assert.doesNotMatch(src,/const user=\(typeof cloudUser/);
 assert.match(src,/Consulta interrompida: Backoffice bloqueado/);
 assert.match(src,/hasPendingProductEditsV19102\(\)/);
});

test('leitura Cloud com prazo limite e limpeza do estado',async()=>{
 assert.equal(await publicationReadWithin(async()=>42,'teste',100),42);
 await assert.rejects(publicationReadWithin(()=>new Promise(()=>{}),'Consulta fictícia',25),/Consulta fictícia excedeu o limite de espera/);
});
test('offline e simultaneidade são tratados sem introduzir operações de escrita',()=>{
 const fs=require('node:fs'),src=fs.readFileSync('catalog-publication-overview-v1.js','utf8');
 assert.match(src,/navigator\.onLine===false/);
 assert.match(src,/publicFeedInFlight/);
 assert.match(src,/publicationReadWithin\(\(\)=>Promise\.all/);
 assert.doesNotMatch(src,/\.\s*(?:insert|update|upsert|delete)\s*\(/);
});
