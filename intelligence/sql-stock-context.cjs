/* Private stock context adapter; no live transport. */
function createStockContext(options){
 'use strict';
 const {query,owner,releaseEnabled=false}=options||{};
 if(typeof query!=='function'||typeof owner!=='string')throw Error('Contexto indisponível.');
 const allowed=q=>q?.owner===owner&&((['stock','producao','auditoria'].includes(q.agent)&&q.kind==='inventory_audit')||(q.agent==='stock'&&q.kind==='stock_organization_plan'));
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 return async function context(q){
  if(!releaseEnabled||!allowed(q)||!uuid(q.missionId)||!uuid(q.leaseId))throw Error('Contexto fora do âmbito.');
  const result=await query('SELECT artessencia_intelligence_private.team_stock_context($1,$2) AS r',[q.missionId,q.leaseId]);
  const r=result?.rows?.[0]?.r;
  if(result?.rows?.length!==1||r?.verified!==true||r.owner!==owner||r.agent!==q.agent||r.kind!==q.kind||r.missionId!==q.missionId||r.leaseId!==q.leaseId||!Number.isSafeInteger(r.sourceRevision)||r.sourceRevision<0||!Array.isArray(r.payload?.stock)||!Array.isArray(r.evidenceIds))throw Error('Contexto não confirmado.');
  const fields=q.kind==='inventory_audit'?['stock','products','productRecipes']:['stock'];
  if(Object.keys(r.payload).length!==fields.length||!fields.every(k=>Object.prototype.hasOwnProperty.call(r.payload,k)))throw Error('Projeção inesperada.');
  return r;
 };
}
module.exports=createStockContext;
