const DB_NAME='artessencia_atelier';
const DB_VERSION=1;
const STORES=['settings','clients','suppliers','materials','products','orders','orderItems','payments','purchases','expenses','investments','cashMovements','productionBatches','stockMovements','collections','auditLog'];
let dbPromise;
export function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;for(const s of STORES){if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});}};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  }); return dbPromise;
}
function tx(store,mode='readonly'){return openDB().then(db=>db.transaction(store,mode).objectStore(store));}
export async function all(store){const s=await tx(store);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});}
export async function get(store,id){const s=await tx(store);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});}
export async function put(store,obj){const s=await tx(store,'readwrite');return new Promise((res,rej)=>{const r=s.put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)});}
export async function del(store,id){const s=await tx(store,'readwrite');return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)});}
export async function clear(store){const s=await tx(store,'readwrite');return new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)});}
export async function count(store){const s=await tx(store);return new Promise((res,rej)=>{const r=s.count();r.onsuccess=()=>res(r.result||0);r.onerror=()=>rej(r.error)});}
export async function exportAll(){const out={meta:{app:'ArtEssencia Atelier',exportedAt:new Date().toISOString(),version:1},data:{}};for(const s of STORES)out.data[s]=await all(s);return out;}
export async function importAll(payload){if(!payload?.data)throw new Error('Backup inválido');for(const s of STORES){await clear(s);for(const row of payload.data[s]||[])await put(s,row);}return true;}
export const stores=STORES;
