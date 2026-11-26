/* Integrated mission runner; trusted stores and real provider not yet connected. */
function createMissionRunner(options){
 'use strict';
 const {store,contextSource,core,engines={},gateway,executor,releaseEnabled=false}=options||{};
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const validRevision=v=>Number.isSafeInteger(v)&&v>=0;
 const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
 const draftTypes={director:'relatorio',stock:'relatorio',producao:'relatorio',financeiro:'relatorio',comercial:'proposta_comercial',marketing:'publicacao',inovacao:'conceito',catalogo:'descricao_produto',auditoria:'relatorio'};
 if(!store||typeof contextSource!=='function'||!core||!gateway||!executor)throw Error('Motor indisponível.');
 const binding=(m,l)=>l?.verified===true&&l.owner===m.owner&&l.missionId===m.id&&l.agent===m.agent&&l.kind===m.kind&&l.leaseId===m.leaseId&&l.controlRevision===m.controlRevision&&l.active===true;
 async function current(m){
  const l=await store.verifyLease(m);
  if(!binding(m,l))throw Error('Autorização retirada.');
  return l;
 }
 async function run(command){
  if(!releaseEnabled||!uuid(command?.missionId)||!uuid(command?.owner)||!validRevision(command?.expectedRevision))throw Error('Execução indisponível.');
  // The trusted store must atomically claim an approved mission and mint a single
  // reasoning request ID, with no browser-supplied instructions or grants.
  const m=await store.claim({owner:command.owner,missionId:command.missionId,expectedRevision:command.expectedRevision});
  if(m?.owner!==command.owner||m.id!==command.missionId||m.status!=='working'||m.revision!==command.expectedRevision+1||!uuid(m.leaseId)||!uuid(m.requestId)||!validRevision(m.controlRevision)||!text(m.instruction,4000)||!core.agents.includes(m.agent))throw Error('Claim não confirmado.');
  let stage='context',receipts=[],chargedMicroeur=null;
  try{
   const l=await current(m);
   const s=await contextSource({owner:m.owner,agent:m.agent,kind:m.kind,missionId:m.id,leaseId:m.leaseId});
   if(s?.verified!==true||s.owner!==m.owner||s.agent!==m.agent||s.missionId!==m.id||s.leaseId!==m.leaseId||!validRevision(s.sourceRevision)||!s.payload||!Array.isArray(s.evidenceIds)||s.evidenceIds.length>20||!s.evidenceIds.every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x)))throw Error('Contexto não verificado.');
   const settings=core.config(l.settings);
   const mission=core.createMission(settings,{id:m.id,agent:m.agent,kind:m.kind,trigger:'manual'});
   const report=core.runMission(settings,mission,s.payload,engines.audit,engines.renamePlanner,engines.organizer,engines.operational,engines.business);
   if(report.status!=='review')throw Error('Análise bloqueada.');
   const context=JSON.stringify({sourceRevision:s.sourceRevision,evidenceIds:s.evidenceIds,report:report.result});
   if(!text(context,24000))throw Error('Contexto excede limite; dividir missão.');
   await current(m);
   stage='reasoning';
   const ai=await gateway.run({requestId:m.requestId,missionId:m.id,agent:m.agent,instruction:m.instruction,context});
   if(ai?.requestId!==m.requestId||!Number.isSafeInteger(ai.chargedMicroeur)||ai.chargedMicroeur<0)throw Error('Custo ou resposta não confirmado.');
   chargedMicroeur=ai.chargedMicroeur;
   if(ai.status!=='review'||ai.agent!==m.agent||!text(ai.text,16000))throw Error('Resposta indisponível para revisão.');
   stage='tools';
   const grant=await current(m);
   if(!Array.isArray(grant.actions)||grant.actions.length>8||new Set(grant.actions.map(x=>x.actionId)).size!==grant.actions.length)throw Error('Permissões de ferramentas inválidas.');
   const proposed=report.result?.mode==='proposal_only'&&Array.isArray(report.result.tasks)?report.result.tasks:[];
   // AI prose is never parsed as a tool instruction. Task grants refer only
   // to exact deterministic task keys; draft grants are type-specific.
   for(const g of grant.actions){
    if(!uuid(g?.actionId))throw Error('Ação inválida.');
    let args;
    if(g.tool==='create_task'){
     const matches=proposed.filter(t=>t.key===g.taskKey&&t.agent===m.agent&&t.requiresApproval===true);
     if(matches.length!==1)throw Error('Tarefa sem evidência ou fora do departamento.');
     const t=matches[0];
     if(![1,2,3].includes(t.priority))throw Error('Prioridade inválida.');
     args={title:t.title,semanticKey:t.key,priority:({1:'alta',2:'normal',3:'baixa'})[t.priority],dueDate:t.dueDate,estimateMin:0,details:'Proposta validada em missão Intelligence. Referência: '+t.key};
    }else if(g.tool==='save_draft'&&g.type===draftTypes[m.agent]){
     args={type:g.type,title:'Resultado da missão '+m.id,content:ai.text,evidenceIds:s.evidenceIds};
    }else throw Error('Ferramenta não autorizada.');
    await current(m);
    const receipt=await executor.run({owner:m.owner,missionId:m.id,agent:m.agent,kind:m.kind,tool:g.tool,actionId:g.actionId,args});
    if(!['created','existing','archived'].includes(receipt?.status)||!text(receipt.id,100)||receipt.tool!==g.tool)throw Error('Recibo indisponível.');
    receipts.push({actionId:g.actionId,id:receipt.id,status:receipt.status,tool:g.tool});
   }
   stage='finish';
   await current(m);
   const done=await store.finish({mission:m,status:'review_ready',summary:'Análise concluída para revisão. Recibos confirmados: '+receipts.length,report:report.result,reasoning:ai.text,chargedMicroeur,receipts});
   if(done?.status!=='review_ready'||done.missionId!==m.id||done.leaseId!==m.leaseId)throw Error('Conclusão não confirmada.');
   return {status:'review_ready',missionId:m.id,chargedMicroeur,receipts};
  }catch{
   // Keep the claim consumed. A transport error can hide a successful charge
   // or write. Never repeat a model request or tool automatically.
   let saved=false;
   try{const r=await store.interrupt({mission:m,stage,chargedMicroeur,receipts});saved=r?.missionId===m.id&&r.leaseId===m.leaseId&&r.status==='blocked';}catch{}
   return {status:saved?'blocked':'recovery_required',missionId:m.id,stage,chargedMicroeur,receipts,automaticRetry:false};
  }
 }
 return {run};
}
module.exports=createMissionRunner;
