/* Deterministic business planning, proposal only. */
function createBusinessAgents(){
 'use strict';
 const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
 const id=x=>typeof x==='string'&&x.length>0&&x.length<=70&&x.trim()===x&&!/[\u0000-\u001f\u007f]/.test(x);
 const text=x=>typeof x==='string'&&x.trim().length>0;
 const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 function rows(value,key){if(!Array.isArray(value)||value.length>10000||value.some(x=>!id(x?.[key]))||new Set(value.map(x=>x[key])).size!==value.length)throw Error('Fonte inválida ou duplicada.');return value;}
 function task(agent,kind,ref,title,priority,dueDate=null,details={}){return {key:JSON.stringify([agent,kind,ref]),agent,kind,title,priority,dueDate,details,requiresApproval:true};}
 const report=tasks=>({mode:'proposal_only',tasks});
 function commercial(input){
  const {today,quotes,requests}=input||{};if(!day(today))throw Error('Data inválida.');
  const tasks=[],proposals=[];
  const append=(q,kind,instruction)=>{
   if(typeof q.sourceDigest!=='string'||!/^[0-9a-f]{64}$/.test(q.sourceDigest)||typeof q.reference!=='string'||!/^[A-Za-z0-9_-]{1,70}$/.test(q.reference)||proposals.length>=40)return;
   proposals.push({kind,recordId:q.id,reference:q.reference,recordStatus:q.recordStatus,sourceDigest:q.sourceDigest,
    instruction,requiresApproval:true});
  };
  for(const q of rows(quotes,'id')){
   if(q.status!=='open')continue;
   const instruction=q.recordStatus==='Aceite'?'Verificar condições e sinal antes de considerar a conversão em encomenda.':
     q.recordStatus==='Rascunho'?'Rever produtos, quantidades, validade e condições no editor de orçamento.':
     'Rever validade e preparar seguimento interno; não contactar sem autorização.';
   if(['Aceite','Rascunho','Enviado'].includes(q.recordStatus))append(q,'quote',instruction);
   if(!day(q.followupDate)||q.contactAllowed!==true){tasks.push(task('comercial','review_quote',q.id,'Validar seguimento do orçamento — '+q.id,2));continue;}
   if(q.followupDate<=today)tasks.push(task('comercial','followup_quote',q.id,'Preparar seguimento do orçamento — '+q.id,2,q.followupDate));
  }
  for(const q of rows(requests,'id'))if(q.status==='unanswered'){
   tasks.push(task('comercial','review_request',q.id,'Responder a pedido de informação — '+q.id,1,day(q.receivedDate)?q.receivedDate:null));
   if(q.recordStatus==='new')append(q,'request','Rever o pedido original e preparar orçamento no editor existente, sem enviar ou assumir quantidades.');
  }
  return {...report(tasks),commercialProposals:proposals};
 }
 function marketing(input){
  const {today,campaigns,posts}=input||{};if(!day(today))throw Error('Data inválida.');
  const tasks=[];
  for(const c of rows(campaigns,'id')){
   if(c.status!=='planned'&&c.status!=='active')continue;
   if(!day(c.startDate)||!day(c.endDate)||c.startDate>c.endDate){tasks.push(task('marketing','review_campaign',c.id,'Validar calendário da campanha — '+c.id,2));continue;}
   if(c.endDate<today)continue;
   if(c.assetsReady!==true)tasks.push(task('marketing','prepare_campaign',c.id,'Preparar conteúdos da campanha — '+c.id,c.startDate<=today?1:2,c.startDate));
  }
  for(const p of rows(posts,'id'))if(p.status==='planned'&&day(p.publishDate)&&p.publishDate<=today)tasks.push(task('marketing','prepare_post',p.id,'Rever publicação planeada — '+p.id,2,p.publishDate));
  return report(tasks);
 }
 function catalog(input){
  const tasks=[];
  for(const p of rows(input?.products,'code')){
   if(p.catalogEligible!==true)continue;
   const missing=[];
   if(p.hasVerifiedImage!==true)missing.push('fotografia');
   if(!text(p.description))missing.push('descrição');
   if(!text(p.family))missing.push('família');
   if(p.optionsComplete!==true)missing.push('opções');
   if(p.priceVerified!==true)missing.push('preço');
   if(missing.length)tasks.push(task('catalogo','complete_product',p.code,'Completar ficha de catálogo — '+p.code,p.published===true?1:2,null,{missing}));
  }
  const comparison=input?.crosscheck;
  if(!comparison)return report(tasks);
  if(comparison.storeOrders==='enabled')tasks.push(task('catalogo','review_store_status','store','Verificar abertura inesperada das encomendas online',1));
  if(!comparison.coverage?.products)tasks.push(task('catalogo','verify_public_feed','feed','Validar serviço público do Catálogo e Loja',1));
  return {...report(tasks),publicComparison:comparison};
 }
 function innovation(input){
  const tasks=[];
  for(const c of rows(input?.ideas,'id')){
   if(c.status!=='planned'&&c.status!=='testing')continue;
   if(c.feasibilityVerified!==true||c.safetyTestsComplete!==true||c.costVerified!==true){
    const missing=[c.feasibilityVerified!==true?'viabilidade':null,c.safetyTestsComplete!==true?'ensaios de segurança':null,c.costVerified!==true?'custo':null].filter(Boolean);
    tasks.push(task('inovacao','validate_concept',c.id,'Validar conceito e protótipo — '+c.id,2,null,{missing}));continue;
   }
   if(c.distinctiveFeaturesVerified!==true)tasks.push(task('inovacao','review_differentiation',c.id,'Rever diferenciação do conceito — '+c.id,3));
  }
  return report(tasks);
 }
 function audit(input){
  const tasks=[];
  for(const s of rows(input?.checks,'id')){
   if(!['pass','fail','unknown'].includes(s.status)||!['critical','normal'].includes(s.severity))throw Error('Resultado de auditoria inválido.');
   if(s.status!=='pass')tasks.push(task('auditoria','review_check',s.id,'Investigar verificação — '+s.id,s.severity==='critical'?1:2,null,{status:s.status}));
  }
  const existing=input?.existingWork;
  if(existing&&(!Number.isSafeInteger(existing.syncPending)||existing.syncPending<0||!Number.isSafeInteger(existing.publicPending)||existing.publicPending<0))throw Error('Planeamento de auditoria inválido.');
  if(input?.syncVerified!==true&&!existing?.syncPending)tasks.push(task('auditoria','review_sync','cloud','Validar sincronização Cloud',1));
  if(input?.publicServiceVerified===null&&!existing?.publicPending)tasks.push(task('auditoria','review_public_service','public','Validar serviço público do Catálogo e Loja',1));
  return {...report(tasks),...(input?.auditEvidence?{auditEvidence:input.auditEvidence,existingWork:existing,checks:input.checks}:{})};
 }
 return {commercial,marketing,catalog,innovation,audit};
}
if(typeof module==='object'&&module.exports)module.exports=createBusinessAgents();else globalThis.ArtEssenciaBusinessAgents=createBusinessAgents();
