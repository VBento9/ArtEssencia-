import * as db from './db.js';
const SESSION_KEY='ae_supabase_session';
function cleanUrl(u){return String(u||'').trim().replace(/\/$/,'')}
async function cfg(){return {url:cleanUrl(await db.getSetting('cloud.url','')),key:String(await db.getSetting('cloud.key','')).trim()}}
export async function configure(url,key){await db.setSetting('cloud.url',cleanUrl(url));await db.setSetting('cloud.key',String(key||'').trim())}
export function session(){try{return JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
export function logout(){sessionStorage.removeItem(SESSION_KEY)}
async function request(path,{method='GET',body,token,headers={}}={}){
 const c=await cfg(); if(!c.url||!c.key)throw new Error('Configura primeiro o URL e a chave publishable/anon do Supabase.');
 const r=await fetch(c.url+path,{method,headers:{apikey:c.key,Authorization:`Bearer ${token||c.key}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch{data=txt}
 if(!r.ok)throw new Error(data?.msg||data?.message||data?.error_description||data?.details||`HTTP ${r.status}`);return data;
}
export async function login(email,password){const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});const s={access_token:data.access_token,refresh_token:data.refresh_token,user:data.user,expires_at:Date.now()+Number(data.expires_in||3600)*1000};sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));return s}
export async function ensureSession(){let s=session();if(!s)throw new Error('Sessão Cloud não iniciada.');if(s.expires_at-Date.now()>60000)return s;const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}});s={access_token:data.access_token,refresh_token:data.refresh_token||s.refresh_token,user:data.user||s.user,expires_at:Date.now()+Number(data.expires_in||3600)*1000};sessionStorage.setItem(SESSION_KEY,JSON.stringify(s));return s}
async function deviceId(){
 let id=await db.getSetting('cloud.deviceId','');
 if(!id){id='DEV-'+Math.random().toString(36).slice(2,8)+'-'+Date.now().toString(36);await db.setSetting('cloud.deviceId',id)}
 return id
}
export async function schemaVersion(){return 'cloud-records-v1'}
export async function testConnection(){const s=await ensureSession();await request('/rest/v1/artessencia_cloud_records?select=id&limit=1',{token:s.access_token});return {email:s.user?.email||'',schema:await schemaVersion()}}
export async function saveProductPublicCharacteristics(code,characteristics={}){
 const sku=String(code||'').trim();if(!sku)return {updated:false};
 const s=await ensureSession();
 return request('/rest/v1/rpc/artessencia_save_product_public_characteristics_v1',{method:'POST',token:s.access_token,body:{p_code:sku,p_characteristics:characteristics&&typeof characteristics==='object'?characteristics:{}}});
}
const SYNC_STORES=['settings','clients','suppliers','materials','products','productMaterials','molds','orders','orderItems','payments','purchases','expenses','investments','cashMovements','productionBatches','stockMovements','collections','kitItems','catalogs','homepage','campaigns','deliverySettings','recurringExpenses','transfers','themes','occasions','colors','personalizations','creatorPricing','unavailableDates','notifications','quoteHistory'];
function syncableRow(store,row){if(store!=='settings')return true;return !String(row?.id||'').startsWith('cloud.')}
export async function pushRecord(store,row){
 if(!SYNC_STORES.includes(store)||!row?.id||!syncableRow(store,row))return {applied:false,skipped:true};
 const s=session();if(!s||!navigator.onLine)return {applied:false,skipped:true};
 const live=await ensureSession(),dev=await deviceId();
 const updated=row.updatedAt||row.updated_at||row.createdAt||new Date().toISOString();
 const result=await request('/rest/v1/rpc/artessencia_cloud_upsert_record_v1',{method:'POST',token:live.access_token,body:{p_entity:store,p_record_id:String(row.id),p_data:{...row,updatedAt:updated},p_client_updated_at:updated,p_device_id:dev}});
 if(result?.applied===true)return result;
 if(result?.applied===false&&result?.reason==='STALE')return result;
 throw new Error('Cloud: gravação de '+store+'/'+String(row.id)+' sem confirmação.');
}
export async function pushAll(){
 const s=await ensureSession(),dev=await deviceId();let n=0,skipped=0,failed=0;
 for(const store of SYNC_STORES){
  const rows=await db.all(store);
  for(const row of rows){
   if(!syncableRow(store,row)){skipped++;continue}
   const updated=row.updatedAt||row.updated_at||row.createdAt||new Date().toISOString();
   const result=await request('/rest/v1/rpc/artessencia_cloud_upsert_record_v1',{method:'POST',token:s.access_token,body:{p_entity:store,p_record_id:String(row.id),p_data:{...row,updatedAt:updated},p_client_updated_at:updated,p_device_id:dev}});
   if(result?.applied)n++;else if(result?.applied===false&&result?.reason==='STALE'){skipped++}else{failed++;skipped++}
  }
 }
 if(failed)throw new Error('Cloud: '+failed+' registo(s) sem confirmação de gravação. Os dados locais foram preservados.');
 await db.setSetting('cloud.lastPush',new Date().toISOString());return {applied:n,skipped}
}
export async function pullAll(){
 const s=await ensureSession();let rows=[],offset=0,page=[];
 do{
  page=await request('/rest/v1/artessencia_cloud_records?select=entity,record_id,data,client_updated_at,server_updated_at&deleted_at=is.null&order=server_updated_at.asc&limit=1000&offset='+offset,{token:s.access_token});
  rows.push(...(page||[]));offset+=1000
 }while((page||[]).length===1000);
 let applied=0,skipped=0;
 for(const r of rows){
  if(!SYNC_STORES.includes(r.entity)||!r.data?.id){skipped++;continue}
  const local=await db.get(r.entity,r.data.id);
  const lt=new Date(local?.updatedAt||local?.updated_at||local?.createdAt||0).getTime();
  const rt=new Date(r.client_updated_at||r.server_updated_at||0).getTime();
  if(!local||rt>=lt){await db.put(r.entity,{...r.data,updatedAt:r.client_updated_at||r.server_updated_at},{silent:true});applied++}else skipped++
 }
 await db.setSetting('cloud.lastPull',new Date().toISOString());return {applied,skipped,total:rows.length}
}
let reconcilePromise=null;
export async function reconcile(){
 if(reconcilePromise)return reconcilePromise;
 reconcilePromise=(async()=>{
  const s=session();if(!s)return {skipped:true,reason:'NO_SESSION'};
  // Preserve local changes first. Pulling before a confirmed push could overwrite
  // a locally saved catalog with an older server version.
  const pushed=await pushAll();
  const pulled=await pullAll();
  const at=new Date().toISOString();await db.setSetting('cloud.lastReconcile',at);
  return {pulled,pushed,at}
 })();
 try{return await reconcilePromise}finally{reconcilePromise=null}
}
export async function status(){const c=await cfg();const s=session();return {configured:!!(c.url&&c.key),loggedIn:!!s,email:s?.user?.email||'',lastPush:await db.getSetting('cloud.lastPush',''),lastPull:await db.getSetting('cloud.lastPull',''),lastReconcile:await db.getSetting('cloud.lastReconcile','')}}
