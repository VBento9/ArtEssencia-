'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const helpers=html.slice(html.indexOf('function visualCatalogLegacyV1935()'),html.indexOf('function syncVisualCatalogsV1935()'));
const row=(id,title=id)=>({id,title,productIds:['P-TEST'],format:'A4',updatedAt:'2026-10-27T12:00:00Z'});
function device(legacy=[],data={}){
 const storage=new Map([['legacy',JSON.stringify(legacy)]]);let quota=false,saves=0;
 const c={db:JSON.parse(JSON.stringify(data)),KEY:'db',VISUAL_CATALOG_KEY_V192:'legacy',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(quota)throw Error('quota');storage.set(k,v)}},save:()=>{saves++;return true},relClone:x=>JSON.parse(JSON.stringify(x)),normalizeImportedDb:x=>x,ensureQuotePaymentModel(){},ensureCostModel(){},ensureRecordIds(){},ensureClientsFromOrders(){},APP_VERSION:'1.9.35',simpleHash:s=>s.length};
 vm.createContext(c);vm.runInContext(helpers,c);
 vm.runInContext(html.slice(html.indexOf('const CLOUD_OPERATIONAL_KEYS_V139='),html.indexOf('async function validateCloudRevisionBeforePushV1860')),c);
 vm.runInContext(html.slice(html.indexOf('function mergeOperationalCloudSnapshotV139('),html.indexOf('async function pushOperationalCloudStateV139(')),c);
 vm.runInContext(html.split('\n').find(x=>x.startsWith('function backupPayload()')),c);
 return {c,storage,quota:v=>quota=v,saves:()=>saves};
}
const a=device([row('old')],{products:[],orders:[],stock:[]});
assert.equal(a.c.visualCatalogsDataV192().length,1);assert.equal(a.saves(),0);assert.equal(a.c.db.visualCatalogsV1935,undefined);
assert.equal(a.c.backupPayload().data.visualCatalogsV1935.rows[0].id,'old');assert.equal(a.saves(),0);
a.c.visualCatalogsStoreV192([...a.c.visualCatalogsDataV192(),row('new')]);
assert.equal(a.saves(),1);assert.equal(a.storage.get('legacy'),JSON.stringify([row('old')]));
const b=device();b.c.mergeOperationalCloudSnapshotV139(a.c.operationalCloudSnapshotV139());assert.equal(b.c.visualCatalogsDataV192().length,2);
// Cloud delete and reload must not resurrect the untouched legacy copy.
b.c.visualCatalogsStoreV192(b.c.visualCatalogsDataV192().filter(x=>x.id!=='old'));
a.c.mergeOperationalCloudSnapshotV139(b.c.operationalCloudSnapshotV139());
assert.equal(a.c.visualCatalogsDataV192().length,1);
const reload=device([row('old')],a.c.db);assert.equal(reload.c.visualCatalogsDataV192().length,1);
// An older client omitting the new key must not clear a current device's drafts.
reload.c.mergeOperationalCloudSnapshotV139({stock:[]});assert.equal(reload.c.visualCatalogsDataV192().length,1);
// Distinct legacy edit with the same ID survives as a separate recoverable copy.
const conflict=device([row('new','Local edit')],a.c.db);
assert.equal(conflict.c.visualCatalogsDataV192().length,2);assert.match(conflict.c.visualCatalogsDataV192()[1].title,/cópia recuperada/);
conflict.c.visualCatalogsStoreV192(conflict.c.visualCatalogsDataV192());assert.equal(conflict.c.visualCatalogsDataV192().length,2);
// Failed local persistence cannot replace memory or schedule any push.
const q=device([row('q')]);q.quota(true);assert.throws(()=>q.c.visualCatalogsStoreV192([row('other')]),/quota/);assert.equal(q.saves(),0);assert.equal(q.c.db.visualCatalogsV1935,undefined);assert.equal(q.c.visualCatalogsDataV192()[0].id,'q');
// Malformed legacy/remote data must fail closed, not silently become empty.
q.storage.set('legacy','broken');assert.throws(()=>q.c.visualCatalogsDataV192());
const before=JSON.stringify(b.c.db);assert.throws(()=>b.c.mergeOperationalCloudSnapshotV139({stock:[1],visualCatalogsV1935:{rows:'bad'}}));assert.equal(JSON.stringify(b.c.db),before);
const restored=device([],a.c.backupPayload().data);assert.equal(restored.c.visualCatalogsDataV192().length,1);
// Existing revision conflict gate runs before any relational or operational write.
(async()=>{
 let meta={baseRevision:1},logs=[];
 const c={cloudClient:{},fetchCloudRowAuthoritative:async()=>({revision:2,device_id:'other'}),cloudMeta:()=>meta,setCloudMeta:x=>Object.assign(meta,x),getDeviceId:()=> 'this',cloudLogMsg:x=>logs.push(x),cloudConflict:null};vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('async function validateCloudRevisionBeforePushV1860'),html.indexOf('async function operationalCloudPushStateV1858')),c);
 assert.equal(await c.validateCloudRevisionBeforePushV1860({id:'test'}),false);assert.equal(meta.conflict,true);
 const push=html.slice(html.indexOf('async function cloudPushNow('),html.indexOf('function hasMeaningfulLocalData()'));
 assert.ok(push.indexOf('validateCloudRevisionBeforePushV1860')<push.indexOf('relationalSyncCore'));
 assert.match(html,/try\{visualCatalogsStoreV192\(next\)\}catch/);
 console.log('PASS: two-device snapshot, local migration without read writes, duplicate recovery, deletion/reload, backup/restore, missing legacy key, quota/malformed-data safety, revision conflict blocks writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
