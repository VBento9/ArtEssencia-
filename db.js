const DB_NAME='artessencia_atelier_pro';
const DB_VERSION=2;
export const stores=[
  'settings','clients','suppliers','materials','products','productMaterials','molds',
  'orders','orderItems','payments','purchases','expenses','investments','cashMovements',
  'productionBatches','stockMovements','collections','kitItems','catalogs',
  'homepage','campaigns','deliverySettings','auditLog','recurringExpenses','transfers'
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
export async function all(name){const s=await store(name);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
export async function get(name,id){const s=await store(name);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function put(name,obj){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.put(obj);r.onsuccess=()=>res(obj);r.onerror=()=>rej(r.error)})}
export async function del(name,id){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)})}
export async function clear(name){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)})}
export async function exportAll(){const data={};for(const s of stores)data[s]=await all(s);return {meta:{app:'ArtEssencia Atelier Pro',version:'2.0.0',exportedAt:new Date().toISOString()},data}}
export async function importAll(payload){if(!payload?.data)throw new Error('Backup inválido');for(const s of stores){await clear(s);for(const row of payload.data[s]||[])await put(s,row)}}
export async function getSetting(key,fallback=null){return (await get('settings',key))?.value ?? fallback}
export async function setSetting(key,value){return put('settings',{id:key,value,updatedAt:new Date().toISOString()})}
