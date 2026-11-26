function createContextRouter(options){
 'use strict';
 const {owner,stockContext,loadVerified,releaseEnabled=false}=options||{};
 const scopes={director:{daily_priority_plan:['today','reports','existingTasks','limit']},producao:{production_plan:['today','orders','stock']},financeiro:{finance_review:['today','targetMarginPct','products','orders']},comercial:{commercial_review:['today','quotes','requests']},marketing:{marketing_plan:['today','campaigns','posts']},catalogo:{catalog_review:['products']},inovacao:{innovation_review:['ideas']},auditoria:{technical_review:['checks','syncVerified']}};
 const fields={orders:['id','status','alreadyProduced','complete','delivery','needs','total','paid','paymentVerified'],stock:['name','unit','qty'],products:['code','costComplete','totalCost','netSalePrice','catalogEligible','hasVerifiedImage','description','family','optionsComplete','priceVerified','published'],quotes:['id','status','followupDate','contactAllowed'],requests:['id','status','receivedDate'],campaigns:['id','status','startDate','endDate','assetsReady'],posts:['id','status','publishDate'],ideas:['id','status','feasibilityVerified','safetyTestsComplete','costVerified','distinctiveFeaturesVerified'],checks:['id','status','severity']};
 const scalar=v=>v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)||typeof v==='string'&&v.length<=1000;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 if(!owner||typeof stockContext!=='function'||typeof loadVerified!=='function')throw Error('Contexto indisponível.');
 function projectRow(row,keys){
  if(!obj(row))throw Error('Linha inválida.');
  const out={};
  for(const k of keys)if(Object.hasOwn(row,k)){
   if(!scalar(row[k]))throw Error('Campo não escalar.');
   out[k]=row[k];
  }
  return out;
 }
 return async function route(q){
  if(!releaseEnabled||q?.owner!==owner||!uuid(q.missionId)||!uuid(q.leaseId))throw Error('Contexto bloqueado.');
  if((['stock','producao','auditoria'].includes(q.agent)&&q.kind==='inventory_audit')||(q.agent==='stock'&&q.kind==='stock_organization_plan'))return stockContext(q);
  const keys=Object.hasOwn(scopes,q.agent)&&Object.hasOwn(scopes[q.agent],q.kind)?scopes[q.agent][q.kind]:null;
  if(!keys)throw Error('Competência sem contexto autorizado.');
  // Director reports and production requirements need dedicated verified adapters;
  // do not infer their nested schemas or accept arbitrary business data.
  if(q.agent==='director'||q.agent==='producao')throw Error('Adaptador canónico ainda indisponível.');
  const r=await loadVerified({owner,agent:q.agent,kind:q.kind,missionId:q.missionId,leaseId:q.leaseId});
  if(r?.verified!==true||r.owner!==owner||r.agent!==q.agent||r.kind!==q.kind||r.missionId!==q.missionId||r.leaseId!==q.leaseId||!Number.isSafeInteger(r.sourceRevision)||r.sourceRevision<0||!obj(r.payload)||!Array.isArray(r.evidenceIds)||r.evidenceIds.length>20||!r.evidenceIds.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x)))throw Error('Fonte não confirmada.');
  const payload={};
  for(const k of keys){
   if(!Object.hasOwn(r.payload,k))throw Error('Fonte incompleta.');
   const v=r.payload[k];
   if(fields[k]){
    if(!Array.isArray(v)||v.length>5000)throw Error('Lista inválida.');
    let allowed=fields[k];
    if(k==='products')allowed=q.agent==='financeiro'?['code','costComplete','totalCost','netSalePrice']:['code','catalogEligible','hasVerifiedImage','description','family','optionsComplete','priceVerified','published'];
    if(k==='orders')allowed=['id','status','total','paid','paymentVerified'];
    payload[k]=v.map(row=>projectRow(row,allowed));
   }else{if(!scalar(v))throw Error('Campo inválido.');payload[k]=v;}
  }
  if(JSON.stringify(payload).length>500000)throw Error('Contexto demasiado grande.');
  return {verified:true,owner,agent:q.agent,kind:q.kind,missionId:q.missionId,leaseId:q.leaseId,sourceRevision:r.sourceRevision,evidenceIds:[...r.evidenceIds],payload};
 };
}
module.exports=createContextRouter;
