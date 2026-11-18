const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const from=html.indexOf('async function relationalSyncCore(showToast=false){');
const to=html.indexOf('async function relationalHydrateCore(',from);
assert.ok(from>0&&to>from,'É necessário testar a função real de sincronização relacional');
const source=html.slice(from,to);
const clone=o=>JSON.parse(JSON.stringify(o));

function fixture({pause=false}={}){
 const order={id:'ENCOMENDA-FICTICIA',_rid:'uuid-fixture',created:'2026-11-18',
  status:'Pedido',paid:4,delivery:'2026-12-01',source:'manual',
  items:[{code:'TESTE-1',name:'Peça fictícia',qty:2,price:10,cost:3}]};
 let pending=new Set(['rid:uuid-fixture']),changedAt=0;
 let resume=()=>{},started=()=>{};
 const gate=new Promise(resolve=>{resume=resolve}),wasStarted=new Promise(resolve=>{started=resolve});
 const cloudRows=[],shadow=[];
 const store=new Map(),meta={dirty:true,conflict:false,verified:false};
 const ctx={
  console,Date,Promise,Math,JSON,Map,Set,AbortController,
  db:{clients:[],products:[],orders:[order],quotes:[]},
  cloudUser:{id:'usuario-ficticio'},cloudBusy:false,cloudPushPending:false,cloudPushRunning:false,
  cloudStartupDone:false,cloudHydrating:false,cloudConflict:null,
  navigator:{onLine:true},KEY:'app-test',REL_DIRTY:'dirty-test',REL_MIGRATED:'migrated',
  REL_TABLES:{clients:'clients',products:'products',orders:'orders',quotes:'quotes'},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
  cloudClient:{from(table){return{async upsert(rows){
    if(table==='orders'){
      cloudRows.push(clone(rows));
      if(pause&&cloudRows.length===1){started();await gate}
    }
    return {error:null}
  }}}},
  productionBlockedV1926:()=>false,relPruneOrphanPendingOrdersV1741:()=>0,
  ensureCloudSession:async()=>({id:'usuario-ficticio'}),relUuid:o=>o._rid||'uuid-fixture',
  renderCloudUI:()=>{},relFetchAll:async()=>[],relClone:clone,
  changedRelationalRowsV19100:()=>[],clearConfirmedProductEditsV19102:()=>{},
  pendingProductEditsV19102:()=>({}),syncStoreCatalogV1421:async()=>true,
  syncProductPublicCharacteristicsV1820:async()=>true,
  relOrderPendingSet:()=>new Set(pending),
  relIsOrderPending:(o,keys)=>keys.has('rid:'+o._rid),
  relShadowRememberOrder:o=>shadow.push(clone(o)),
  relOrderFingerprint:o=>JSON.stringify(o),
  relClearOrderPending:o=>{pending.delete('rid:'+o._rid);pending.delete('id:'+o.id)},
  relMarkOrderPending:o=>pending.add('rid:'+o._rid),
  calcOrder:o=>{const total=o.items.reduce((s,l)=>s+l.qty*l.price,0);
    return {total,margin:0,cost:o.items.reduce((s,l)=>s+l.qty*l.cost,0)}},
  relClientRid:()=>null,relDate:x=>x||null,relDue:()=>null,quoteCalc:()=>({total:0}),
  cloudLocalChangedMsV1739:()=>changedAt,cloudLogMsg:()=>{},cloudErrText:e=>String(e),
  setCloudMeta:v=>Object.assign(meta,v),cloudMeta:()=>meta,
  toast:()=>{},hasRestorePendingV12645:()=>false,scheduleCloudPushV1860:()=>{},
 };
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 return {ctx,order,cloudRows,shadow,wasStarted,resume,dirty:()=>new Set(pending),
  editDuringSend:()=>{
    order.items[0].price=9;
    order.priceAdjustmentHistoryV19168=[{lineIndex:0,previousPrice:10,newPrice:9,reason:'Acordo'}];
    pending.add('rid:uuid-fixture');
    changedAt=Date.now()+100000;
  }};
}
test('envio habitual confirma o snapshot enviado e limpa a pendência',async()=>{
 const x=fixture();
 assert.equal(await x.ctx.relationalSyncCore(false),true);
 assert.equal(x.cloudRows.length,1);
 assert.equal(x.cloudRows[0][0].data.items[0].price,10);
 assert.equal(x.shadow[0].items[0].price,10);
 assert.equal(x.dirty().size,0);
});
test('edição de preço durante envio mantém pendência e reenvia a última versão',async()=>{
 const x=fixture({pause:true});
 const first=x.ctx.relationalSyncCore(false);
 await x.wasStarted;
 x.editDuringSend();
 x.resume();
 assert.equal(await first,true);
 assert.equal(x.cloudRows[0][0].data.items[0].price,10,'O primeiro envio contém preço antigo');
 assert.equal(x.shadow[0].items[0].price,10,'Shadow deve refletir apenas versão confirmada');
 assert.equal(x.dirty().has('rid:uuid-fixture'),true,'Edição nova não pode ser apagada');
 assert.equal(x.ctx.cloudPushPending,true);
 assert.equal(await x.ctx.relationalSyncCore(false),true);
 assert.equal(x.cloudRows[1][0].data.items[0].price,9);
 assert.equal(x.cloudRows[1][0].data.priceAdjustmentHistoryV19168.length,1);
 assert.equal(x.dirty().size,0);
});
