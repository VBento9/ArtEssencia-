/* Private SQL adapter, injected authenticated connection only. */
function createRunStore(options){
 'use strict';
 const {query,owner,loadGrants,releaseEnabled=false}=options||{};
 if(typeof query!=='function'||typeof loadGrants!=='function'||typeof owner!=='string')throw Error('Store indisponível.');
 const call=async(sql,params)=>{if(!releaseEnabled)throw Error('Store desligado.');const r=await query(sql,params);if(!Array.isArray(r?.rows)||r.rows.length!==1||!r.rows[0]?.r)throw Error('Resposta SQL inválida.');return r.rows[0].r;};
 function check(m){if(m?.owner!==owner||!m.id||!m.leaseId)throw Error('Missão fora do contexto.');}
 async function claim(q){
  if(q.owner!==owner)throw Error('Proprietário inválido.');
  const r=await call('SELECT artessencia_intelligence_private.team_claim_run($1,$2) AS r',[q.missionId,q.expectedRevision]);
  if(r.user_id!==owner||r.mission_id!==q.missionId)throw Error('Claim fora do contexto.');
  return {owner,id:r.mission_id,agent:r.agent,kind:r.kind,instruction:r.instruction,status:r.status,revision:Number(r.revision),controlRevision:Number(r.control_revision),leaseId:r.lease_id,requestId:r.request_id};
 }
 async function status(missionId){const r=await call('SELECT artessencia_intelligence_private.team_run_status($1) AS r',[missionId]);if(r.owner!==owner||r.missionId!==missionId)throw Error('Estado fora do contexto.');return r;}
 async function verifyLease(m){
  check(m);const r=await status(m.id);
  const active=r.active===true&&r.leaseId===m.leaseId&&r.requestId===m.requestId&&r.agent===m.agent&&r.kind===m.kind&&Number(r.controlRevision)===m.controlRevision;
  const actions=active?await loadGrants({owner,missionId:m.id,leaseId:m.leaseId,agent:m.agent,kind:m.kind}):[];
  if(!Array.isArray(actions))throw Error('Grants indisponíveis.');
  return {verified:true,owner,missionId:m.id,agent:r.agent,kind:r.kind,leaseId:r.leaseId,controlRevision:Number(r.controlRevision),active,settings:r.settings,actions};
 }
 async function finish(q){check(q.mission);if(q.status!=='review_ready')throw Error('Estado inválido.');return call('SELECT artessencia_intelligence_private.team_finish_run($1,$2,$3,$4) AS r',[q.mission.id,q.mission.leaseId,'review_ready',JSON.stringify({summary:q.summary,report:q.report,reasoning:q.reasoning,chargedMicroeur:q.chargedMicroeur,receipts:q.receipts})]);}
 async function interrupt(q){check(q.mission);return call('SELECT artessencia_intelligence_private.team_finish_run($1,$2,$3,$4) AS r',[q.mission.id,q.mission.leaseId,'blocked',JSON.stringify({stage:q.stage,chargedMicroeur:q.chargedMicroeur,receipts:q.receipts})]);}
 return {claim,status,verifyLease,finish,interrupt};
}
module.exports=createRunStore;
