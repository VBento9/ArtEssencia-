/* Agent execution tools: server dependencies injected; no live store. */
function createToolExecutor(options){
 'use strict';
 const {authorize,taskStore,draftStore,digest,releaseEnabled=false}=options||{};
 if(typeof authorize!=='function'||typeof digest!=='function')throw Error('Executor indisponível.');
 const categories={director:'Gestão',stock:'Gestão',producao:'Produção',financeiro:'Gestão',comercial:'Comercial',marketing:'Marketing',inovacao:'Criação',catalogo:'Gestão',auditoria:'Segurança'};
 const kinds={director:['daily_priority_plan'],stock:['inventory_audit','inventory_count_plan','stock_organization_plan','stock_rename_plan','stock_merge_batch_plan'],producao:['production_plan','inventory_audit'],financeiro:['finance_review'],comercial:['commercial_review'],marketing:['marketing_plan'],inovacao:['innovation_review'],catalogo:['catalog_review'],auditoria:['technical_review','inventory_audit']};
 const drafts={director:['relatorio'],stock:['relatorio','lista_compras'],producao:['relatorio','ficha_tecnica'],financeiro:['relatorio'],comercial:['proposta_comercial'],marketing:['publicacao','campanha'],inovacao:['conceito'],catalogo:['descricao_produto'],auditoria:['relatorio']};
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
 const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s);
 const day=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 const safe=v=>!/(?:\b(?:sk-|sb_secret_)[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(v);
 function validate(q){
  if(!releaseEnabled||!id(q?.owner)||!id(q.missionId)||!own(kinds,q.agent)||!kinds[q.agent].includes(q.kind)||!['create_task','save_draft'].includes(q.tool)||!id(q.actionId))throw Error('Ferramenta não permitida.');
 }
 async function check(q){
  const a=await authorize({owner:q.owner,agent:q.agent,missionId:q.missionId,kind:q.kind,tool:q.tool,actionId:q.actionId});
  if(a?.verified!==true||a.owner!==q.owner||a.agent!==q.agent||a.missionId!==q.missionId||a.kind!==q.kind||a.tool!==q.tool||a.actionId!==q.actionId||a.enabled!==true||a.missionActive!==true||a.toolGranted!==true)throw Error('Autorização indisponível.');
  return a;
 }
 function task(q,a){
  const p=q.args;
  if(!text(p?.title,160)||!safe(p.title)||!text(p.semanticKey,180)||!safe(p.semanticKey)||!['alta','normal','baixa'].includes(p.priority)||!(p.dueDate===null||day(p.dueDate))||!Number.isInteger(p.estimateMin)||p.estimateMin<0||p.estimateMin>600||typeof p.details!=='string'||p.details.length>600||!safe(p.details))throw Error('Tarefa inválida.');
  // Stable across missions; completed or archived records are never reopened by replay.
  const key=digest(JSON.stringify([q.owner,q.agent,p.semanticKey]));
  if(!/^[a-f0-9]{64}$/.test(key))throw Error('Identificador indisponível.');
  const now=a.serverTime;
  if(typeof now!=='string'||!Number.isFinite(Date.parse(now)))throw Error('Relógio indisponível.');
  const record={id:'ae-intel-'+key,kind:'task',title:p.title.trim(),category:categories[q.agent],priority:p.priority,due_date:p.dueDate,planned_date:null,estimate_min:p.estimateMin,edition_id:null,depends_on_id:null,details:p.details,status:'pendente',source:'intelligence',intelligence_agent:q.agent,intelligence_mission_id:q.missionId,intelligence_semantic_key:p.semanticKey,createdAt:now,updatedAt:now};
  return {user_id:q.owner,entity:'operational_tasks_v1',record_id:record.id,data:record,client_updated_at:now,deleted_at:null,device_id:'intelligence-server'};
 }
 function draft(q,a){
  const p=q.args;
  if(!drafts[q.agent].includes(p?.type)||!text(p.title,160)||!text(p.content,16000)||!safe(p.title)||!safe(p.content)||!Array.isArray(p.evidenceIds)||p.evidenceIds.length>20||!p.evidenceIds.every(id)||new Set(p.evidenceIds).size!==p.evidenceIds.length)throw Error('Documento inválido.');
  const key=digest(JSON.stringify([q.owner,q.missionId,q.actionId,p.type]));
  if(!/^[a-f0-9]{64}$/.test(key))throw Error('Identificador indisponível.');
  return {id:'ae-draft-'+key,owner:q.owner,agent:q.agent,missionId:q.missionId,type:p.type,title:p.title,content:p.content,evidenceIds:[...p.evidenceIds],status:'draft_review',createdAt:a.serverTime};
 }
 async function run(q){
  validate(q);const a=await check(q);
  const record=q.tool==='create_task'?task(q,a):draft(q,a);
  const store=q.tool==='create_task'?taskStore:draftStore;
  if(typeof store?.insertOnce!=='function')throw Error('Armazenamento indisponível.');
  // Atomic authorization recheck and insert-only operation are mandatory in trusted server store.
  const grant={owner:q.owner,agent:q.agent,missionId:q.missionId,kind:q.kind,tool:q.tool,actionId:q.actionId};
  await check(q);
  const result=await store.insertOnce(record,grant);
  const expected=record.record_id||record.id;
  if(result?.id!==expected||!['created','existing','archived'].includes(result.status))throw Error('Resultado não confirmado. Não repetir automaticamente.');
  return {status:result.status,id:expected,tool:q.tool,externalEffect:false};
 }
 return {run};
}
module.exports=createToolExecutor;
