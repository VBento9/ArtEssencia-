const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function between(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)))}
const source=between('function stableStringify(v){','function dataFingerprint(')+"function relClone(x){return JSON.parse(JSON.stringify(x))}\n"+between('function pendingProductEditsV19102(){','function save(scope=')+
 between('async function receiveProductsV19107(){','async function cloudPushNow(');
function setup(products,remote=[]){
 const store=new Map(),server=new Map(remote.map(r=>[r.data.code,structuredClone(r)]));let writes=0,queries=0,hook=null,failStore=false;
 const c={console,Date,Math,JSON,Map,Set,Object,Array,String,Number,Promise,structuredClone,
  db:{products:structuredClone(products)},KEY:'db',PRODUCT_PENDING_V19102:'pending',REL_TABLES:{products:'products'},
  localStorage:{getItem:k=>store.get(k)??null,setItem(k,v){if(failStore)throw Error('quota');store.set(k,String(v))},removeItem:k=>store.delete(k)},
  stableStringify:function stable(x){if(x===undefined)return 'undefined';if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(stable).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}'},
  relClone:x=>structuredClone(x),cloudStartupDone:false,cloudHydrating:false,cloudBusy:false,cloudPushRunning:false,cloudConflict:null,cloudUser:{id:'u'},navigator:{onLine:true},
  localSaveFailedV1926:false,showLocalSaveRecoveryV1926:()=>{},productionBlockedV1926:()=>false,hasRestorePendingV12645:()=>false,ensureCloudSession:async()=>({id:'u'}),
  relUuid:p=>p._rid||'new-id',calculatedProductCost:()=>0,productArchivedV1803:()=>false,
  renderCloudUI:()=>{},renderAll:()=>{},cloudLogMsg:()=>{},toast:()=>{},cloudErrText:e=>e.message,
  syncStoreCatalogV1421:async()=>true,syncProductPublicCharacteristicsV1820:async()=>true,setCloudMeta:()=>{},
  cloudClient:{from(){
   let action='read',payload,filters={},codes;
   const q={select(){return q},eq(k,v){filters[k]=v;return q},filter(k,op,v){filters[k]=JSON.parse(v);return q},in(k,v){codes=v;return q},order(){return q},range(){return q},
    insert(p){action='insert';payload=p;return q},update(p){action='update';payload=p;return q},maybeSingle(){return q},
    async then(resolve,reject){try{queries++;const rows=[...server.values()].filter(r=>(!codes||codes.includes(r.data.code))&&(!filters.id||r.id===filters.id));
     if(action==='read')return resolve({data:filters.id?rows[0]||null:structuredClone(rows),error:null});
     if(hook){const f=hook;hook=null;await f(c,server)}
     const old=server.get(payload.data.code);
     if(action==='update'&&(!old||old.updated_at!==filters.updated_at))return resolve({data:null,error:null});
     if(action==='insert'&&old)return resolve({data:null,error:Error('duplicate')});
     writes++;const row={id:payload.id||old.id,data:structuredClone(payload.data),updated_at:payload.updated_at};server.set(row.data.code,row);resolve({data:structuredClone(row),error:null});
    }catch(e){reject(e)}}};return q;
  }}
 };
 vm.createContext(c);vm.runInContext(source,c);store.set('db',JSON.stringify(c.db));
 return {c,store,server,get writes(){return writes},get queries(){return queries},hook:f=>hook=f,failStorage:()=>failStore=true,
  queue(code,base){const q=JSON.parse(store.get('pending')||'{}');q[code]={base:structuredClone(base)};store.set('pending',JSON.stringify(q))},
  async sync(){return c.syncPendingProductsIndependentV19104()},pending(){return JSON.parse(store.get('pending')||'{}')}};
}
const p=(code='A',extra={})=>({_rid:code,code,name:'Base',price:1,...extra});
const row=x=>({id:x._rid,data:x,updated_at:'2026-11-01T00:00:00+00:00'});
test('single edit is confirmed; restart preserves queue; retry is idempotent',async()=>{
 const s=setup([p('A',{name:'Local'})],[row(p())]);s.queue('A',p());await s.sync();assert.equal(s.server.get('A').data.name,'Local');assert.deepEqual(s.pending(),{});await s.sync();assert.equal(s.writes,1);
 const reboot=setup([p('A',{name:'Offline'})],[row(p())]);reboot.queue('A',p());const restored=setup(JSON.parse(reboot.store.get('db')).products,[row(p())]);restored.store.set('pending',reboot.store.get('pending'));await restored.sync();assert.equal(restored.writes,1);
});
test('multiple consecutive edits and review confirmations use only queued rows',async()=>{
 const s=setup([p(),p('B'),p('C')],[row(p()),row(p('B')),row(p('C'))]);
 const before=JSON.stringify(s.c.db);s.c.db.products[0].technicalInfoVerified=true;s.c.trackLocalProductEditsV19102(before);
 const second=JSON.stringify(s.c.db);s.c.db.products[1].technicalInfoVerified=true;s.c.trackLocalProductEditsV19102(second);
 await s.sync();assert.equal(s.writes,2);assert.equal(s.server.get('C').data.technicalInfoVerified,undefined);
});
test('edits during request retain new local value and advance base only to confirmed version',async()=>{
 const s=setup([p('A',{name:'First'})],[row(p())]);s.queue('A',p());s.hook(c=>{c.db.products[0].name='Second'});
 await s.sync();assert.equal(s.c.db.products[0].name,'Second');assert.equal(s.pending().A.base.name,'First');await s.sync();assert.equal(s.server.get('A').data.name,'Second');assert.deepEqual(s.pending(),{});
});
test('offline queue resumes without loss',async()=>{
 const s=setup([p('A',{price:2})],[row(p())]);s.queue('A',p());s.c.navigator.onLine=false;await s.sync();assert.equal(s.writes,0);assert.ok(s.pending().A);s.c.navigator.onLine=true;await s.sync();assert.equal(s.writes,1);
});
test('non-overlapping fields and nested fields combine; arrays require choice',async()=>{
 const s=setup([p('A',{name:'Local',nested:{x:2,y:1}})],[row(p('A',{price:4,nested:{x:1,y:3}}))]);s.queue('A',p('A',{nested:{x:1,y:1}}));await s.sync();const saved=s.server.get('A').data;assert.equal(saved.name,'Local');assert.equal(saved.price,4);assert.equal(saved.nested.x,2);assert.equal(saved.nested.y,3);assert.ok([...s.store.keys()].some(k=>k.startsWith('ae_product_recovery')));
 const r=s.c.productMergeV19107({recipe:[1]},{recipe:[2]},{recipe:[3]});assert.equal(r.conflicts.length,1);
});
test('same-field conflict does not block another product; explicit choices affect only incompatible fields',async()=>{
 const s=setup([p('A',{name:'Local'}),p('B',{price:3})],[row(p('A',{name:'Cloud',price:8})),row(p('B'))]);s.queue('A',p());s.queue('B',p('B'));
 await s.sync();assert.equal(s.writes,1);assert.equal(s.server.get('B').data.price,3);assert.ok(s.pending().A);
 const state=s.c.productSyncStatesV19107().A;assert.equal(state.status,'conflict');const result=s.c.productMergeV19107(state.base,state.local,state.remote.data,{'["name"]':'local'});assert.equal(result.conflicts.length,0);assert.equal(result.merged.price,8);
 s.c.applyProductMergeV19107('A',state.base,state.local,state.remote,result.merged);await s.sync();assert.equal(s.server.get('A').data.name,'Local');assert.equal(s.server.get('A').data.price,8);
});
test('remote change during request fails CAS',async()=>{
 const s=setup([p('A',{name:'Local'})],[row(p())]);s.queue('A',p());s.hook((c,server)=>{server.get('A').data.price=5;server.get('A').updated_at='2026-11-02T00:00:00+00:00'});await s.sync();assert.equal(s.writes,0);assert.equal(s.c.db.products[0].name,'Local');assert.ok(s.pending().A);await s.sync();assert.equal(s.server.get('A').data.price,5);
});
test('duplicates and divergent identity cannot be overwritten',async()=>{
 const s=setup([p('A',{_rid:'wrong',name:'Local'})],[row(p())]);s.queue('A',p());await s.sync();assert.equal(s.writes,0);assert.equal(s.c.productSyncStatesV19107().A.status,'conflict');
});
test('missing base never chooses whole record automatically',()=>{
 const s=setup([]);const r=s.c.productMergeV19107(null,p('A',{name:'Local'}),p('A',{name:'Cloud'}));assert.equal(r.conflicts.length,1);
});
test('remote reception protects queued edits and rejects older responses',async()=>{
 const s=setup([p('A',{name:'Local'}),p('B')],[row(p('A',{name:'Cloud'})),row(p('B',{price:7}))]);s.queue('A',p());await s.c.receiveProductsV19107();assert.equal(s.c.db.products[0].name,'Local');assert.equal(s.c.db.products[1].price,7);
 const old={...row(p('B',{price:2})),updated_at:'2026-10-01T00:00:00+00:00'};assert.equal(s.c.applyRemoteProductV19107(old),false);assert.equal(s.c.db.products[1].price,7);
});
test('storage failure before reconciliation cannot send or mutate local product',async()=>{
 const s=setup([p('A',{name:'Local'})],[row(p('A',{price:9}))]);s.queue('A',p());s.failStorage();await s.sync();assert.equal(s.writes,0);assert.equal(s.c.db.products[0].price,1);assert.ok(s.pending().A);
});
test('field deletions differ from null and preserve independent edits',()=>{
 const s=setup([]);const r=s.c.productMergeV19107({x:1,y:1},{y:2},{x:1,y:1,z:null});assert.equal('x' in r.merged,false);assert.equal(r.merged.y,2);assert.equal(r.merged.z,null);
});
test('product-only save invokes no global sync and cannot claim clean with conflicts',async()=>{
 const s=setup([p('A',{name:'Local'})],[row(p('A',{name:'Remote'}))]);s.queue('A',p());
 let finalized=0,globalWrites=0;
 Object.assign(s.c,{cloudMeta:()=>({productOnlyV19107:true}),relOrderPendingSet:()=>new Set(),finalizeCloudCleanV1739:()=>finalized++,relationalSyncCore:async()=>{globalWrites++;return true}});
 vm.runInContext(between('async function cloudPushNow(', 'function hasMeaningfulLocalData()'),s.c);
 await s.c.cloudPushNow(false);assert.equal(finalized,0);assert.equal(globalWrites,0);assert.ok(s.pending().A);
 s.server.set('A',row(p()));await s.c.cloudPushNow(false);assert.equal(finalized,1);assert.equal(globalWrites,0);
});
test('timestamp CAS advances beyond remote revision even with a clock ahead',async()=>{
 const remote=row(p());remote.updated_at='2099-01-01T00:00:00.000999+00:00';
 const s=setup([p('A',{name:'Local'})],[remote]);s.queue('A',p());await s.sync();assert.ok(s.server.get('A').updated_at>'2099-01-01T00:00:00.000999');
});
test('pending edits during send schedule one continuation; unresolved conflict schedules none',async()=>{
 const s=setup([p('A',{name:'First'})],[row(p())]);s.queue('A',p());let scheduled=0;
 Object.assign(s.c,{cloudStartupDone:true,scheduleCloudPushV1860:()=>scheduled++});s.hook(c=>c.db.products[0].name='Second');await s.sync();assert.equal(scheduled,1);
 await s.sync();assert.equal(scheduled,1);
 s.c.db.products[0].name='Third';s.queue('A',p());s.server.get('A').data.name='Remote';await s.sync();assert.equal(scheduled,1);
});
test('receive new independent product while another record is pending',async()=>{
 const s=setup([p('A',{name:'Local'})],[row(p()),row(p('NEW'))]);s.queue('A',p());await s.c.receiveProductsV19107();assert.ok(s.c.db.products.find(p=>p.code==='NEW'));assert.equal(s.c.db.products[0].name,'Local');
});
