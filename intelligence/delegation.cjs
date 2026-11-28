/* Director delegation proposals; no persistent execution or scheduling. */
function createDelegation(){
 'use strict';
 const agents=['director','stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'];
 const capabilities={stock:['inventory_count_plan','inventory_audit','stock_rename_plan','stock_organization_plan','stock_merge_batch_plan'],producao:['production_plan','inventory_audit'],financeiro:['finance_review'],comercial:['commercial_review'],marketing:['marketing_plan'],inovacao:['innovation_review'],catalogo:['catalog_review'],auditoria:['inventory_audit','technical_review']};
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
 const active=(settings,agent)=>settings?.enabled===true&&['manual','auto','semi'].includes(settings.agents?.[agent]);
 function plan({root,proposals,settings,existing=[]}={}){
  if(!id(root?.id)||root.agent!=='director'||!active(settings,'director')||!Array.isArray(proposals)||!proposals.length||proposals.length>8||!Array.isArray(existing)||existing.some(x=>!id(x?.id)||!agents.includes(x.agent)))throw Error('Delegação inválida.');
  const seen=new Set(existing.map(x=>x.id));seen.add(root.id);
  const unique=new Set(existing.filter(x=>x.parentId===root.id).map(x=>x.agent+'|'+x.kind));
  const children=[];
  for(const p of proposals){
   if(!id(p?.id)||seen.has(p.id)||!agents.includes(p.agent)||p.agent==='director'||!active(settings,p.agent)||!(capabilities[p.agent]||[]).includes(p.kind)||typeof p.instruction!=='string'||!p.instruction.trim()||p.instruction.length>4000)throw Error('Proposta não permitida.');
   const key=p.agent+'|'+p.kind;if(unique.has(key))throw Error('Delegação repetida.');
   seen.add(p.id);unique.add(key);
   children.push({id:p.id,parentId:root.id,agent:p.agent,kind:p.kind,instruction:p.instruction,depth:1,status:'pending_review',maxReasoningCalls:2,requiresApproval:true});
  }
  return {mode:'proposal_only',parentId:root.id,children};
 }
 function permit(child,settings,callsUsed){
  return child?.depth===1&&id(child.id)&&id(child.parentId)&&child.id!==child.parentId&&child.requiresApproval===true&&child.status==='approved'&&child.maxReasoningCalls===2&&Number.isSafeInteger(callsUsed)&&callsUsed>=0&&callsUsed<2&&active(settings,'director')&&active(settings,child.agent)&&(capabilities[child.agent]||[]).includes(child.kind);
 }
 return {plan,permit};
}
module.exports=createDelegation();
