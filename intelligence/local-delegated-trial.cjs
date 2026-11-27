'use strict';
const {environment,ownerConsole}=require('./local-trial.cjs');
const server=require('./server-runtime.cjs'),budget=require('./ai-budget-policy.cjs');
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const agents=['auditoria','comercial','marketing'];
const labels={auditoria:'Miguel — Auditoria',comercial:'Inês — Comercial',marketing:'Clara — Marketing'};
function verifiedPanel(panel,parentId){
 const c=panel.controls,b=panel.budget;
 if(c?.enabled!==true||!c.modes||!Object.values(c.modes).every(x=>['manual','off'].includes(x))||
  !Array.isArray(panel.routines)||panel.routines.some(x=>x.enabled)||b?.monthlyLimitMicroeur!==1000000||
  b.ledgerReleased!==false||b.ledgerFrozen!==false||Number(b.unknown)!==0||
  Number(b.staleInflight)!==0||Number(b.pending)!==0||!Number.isSafeInteger(Number(b.settled))||Number(b.settled)<0)
  throw Error('Estado financeiro ou operacional do ensaio não seguro.');
 if(!Array.isArray(panel.missions))throw Error('Lista de missões indisponível.');
 const parents=panel.missions.filter(m=>m.mission_id===parentId&&m.agent==='director'&&m.status==='review_ready');
 const children=panel.missions.filter(m=>m.parent_id===parentId);
 if(parents.length!==1||children.length!==3||new Set(children.map(m=>m.mission_id)).size!==3||
  new Set(children.map(m=>m.agent)).size!==3||children.some(m=>!agents.includes(m.agent)||!uuid(m.mission_id)||typeof m.instruction!=='string'||!m.instruction||
    !['pending_review','review_ready'].includes(m.status)||!Number.isSafeInteger(m.revision)||m.status==='pending_review'&&(m.revision!==0||c.modes[m.agent]!=='manual')))
  throw Error('Delegações inesperadas ou por reconciliar.');
 if(panel.missions.some(m=>['working','approved','pending_review'].includes(m.status)&&!children.some(x=>x.mission_id===m.mission_id)))
  throw Error('Missões abertas fora do ensaio.');
 return children;
}
async function run(config,parentId,{compose=server.composeLocalTrial,processNext=server.processNext,connectOwner=ownerConsole,confirm=async()=>false,write=()=>{}}={}){
 if(!uuid(parentId))throw Error('Identificador da missão da direção inválido.');
 const env=environment(config),runtime=await compose({env}),owner=await connectOwner(config);
 if(await runtime.call('identity')!==owner.owner)throw Error('Titular do executor diferente do titular autenticado.');
 const results=[];
 for(const agent of agents){
  const panel=await owner.call('read'),children=verifiedPanel(panel,parentId),m=children.find(x=>x.agent===agent);
  if(m.status==='review_ready'){write(labels[agent]+': já concluída; não será repetida.');continue;}
  const reserve=budget.estimate(runtime.pricing());
  if(Number(panel.budget.settled)+reserve>1000000)throw Error('Orçamento insuficiente para a reserva do próximo pedido.');
  if(await runtime.call('trial_identity')!==true)throw Error('Autorização Cloud retirada.');
  write(labels[agent]+'\nMissão existente: '+m.mission_id+'\n'+m.instruction+'\nReserva máxima: '+(reserve/1000000).toFixed(6)+' EUR.');
  if(!await confirm(m))return {status:'stopped_by_owner',results};
  const approved=await owner.call('approve',{id:m.mission_id,revision:m.revision});
  if(approved.mission_id!==m.mission_id||approved.status!=='approved'||approved.revision!==m.revision+1)throw Error('Aprovação por confirmar; não repetir.');
  const result=await processNext(runtime,{owner:owner.owner,missionId:m.mission_id,revision:approved.revision});
  if(result.status!=='review_ready')return {status:'stopped_for_reconciliation',results,missionId:m.mission_id,stage:result.stage,automaticRetry:false};
  const snapshot=await owner.call('read');
  const saved=snapshot.missions?.find(x=>x.mission_id===m.mission_id),doc=snapshot.documents?.find(x=>x.mission_id===m.mission_id);
  if(saved?.status!=='review_ready'||!doc||typeof doc.content!=='string'||!Number.isSafeInteger(result.chargedMicroeur)||result.chargedMicroeur<0)throw Error('Conclusão por confirmar; não repetir.');
  const receipt={agent,missionId:m.mission_id,chargedMicroeur:result.chargedMicroeur,document:doc.content};
  results.push(receipt);write(JSON.stringify(receipt,null,2));
 }
 return {status:'review_ready',results};
}
module.exports={run,verifiedPanel};
