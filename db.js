const DB_NAME='artessencia_atelier_pro';
const DB_VERSION=3;
export const stores=[
  'settings','clients','suppliers','materials','products','productMaterials','molds',
  'orders','orderItems','payments','purchases','expenses','investments','cashMovements',
  'productionBatches','stockMovements','collections','kitItems','catalogs',
  'homepage','campaigns','deliverySettings','auditLog','recurringExpenses','transfers',
  'themes','occasions','colors','personalizations','creatorPricing','unavailableDates','notifications','quoteHistory'
];
let dbPromise;
export function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;for(const s of stores)if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return dbPromise;
}
async function store(name,mode='readonly'){const db=await openDB();return db.transaction(name,mode).objectStore(name)}
// Known misclassified product records are hidden from the clients view without
// deleting local data, allowing a reversible and non-destructive recovery.
const QUARANTINED_CLIENT_IDS=new Set(["a6c6d526-005e-4d0f-8fa6-382844dad173","568ddbd9-143a-4b78-895c-cecea06c00e8","7f4efa67-39c9-4cfc-b85e-826bee4b13b4","ac08e4e4-30d6-4838-8479-ba40529a4d5c","fe980aa7-d8bb-4d17-b96f-3f75fad2d479","44bd7990-6812-4c4d-9aec-46f77e490631","4b89f5e1-ae1b-4aae-9faf-56e00a8a02f2"]);
export async function all(name){const s=await store(name);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>{const rows=r.result||[];res(name==='clients'?rows.filter(x=>!QUARANTINED_CLIENT_IDS.has(String(x?.id||''))):rows)};r.onerror=()=>rej(r.error)})}
export async function get(name,id){const s=await store(name);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function put(name,obj,opts={}){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.put(obj);r.onsuccess=()=>{if(!opts?.silent&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ae:local-change',{detail:{store:name,row:obj}}));res(obj)};r.onerror=()=>rej(r.error)})}
export async function commitProductionConsumption(batch,materialRows,movementRows){
  const database=await openDB();
  const tx=database.transaction(['materials','stockMovements','productionBatches'],'readwrite');
  const entries=[
    ...materialRows.map(row=>({store:'materials',row})),
    ...movementRows.map(row=>({store:'stockMovements',row})),
    {store:'productionBatches',row:batch}
  ];
  const done=new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(tx.error||new Error('Gravação da produção cancelada'));
    tx.onerror=()=>reject(tx.error||new Error('Falha ao guardar a produção'));
  });
  try{for(const entry of entries)tx.objectStore(entry.store).put(entry.row)}
  catch(error){tx.abort();await done.catch(()=>{});throw error}
  await done;
  if(typeof window!=='undefined'){
    for(const entry of entries)window.dispatchEvent(new CustomEvent('ae:local-change',{detail:entry}));
  }
  return true;
}
export async function del(name,id){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)})}
export async function clear(name){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)})}
export async function exportAll(){const data={};for(const s of stores)data[s]=await all(s);return {meta:{app:'ArtEssencia Atelier Pro',version:'2.0.0',exportedAt:new Date().toISOString()},data}}
export async function importAll(payload){if(!payload?.data)throw new Error('Backup inválido');for(const s of stores){await clear(s);for(const row of payload.data[s]||[])await put(s,row,{silent:true})}}
export async function getSetting(key,fallback=null){return (await get('settings',key))?.value ?? fallback}
export async function setSetting(key,value){return put('settings',{id:key,value,updatedAt:new Date().toISOString()})}
