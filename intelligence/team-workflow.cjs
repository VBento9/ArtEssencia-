/* Team workflow state machine; pure simulation, no persistent queue. */
function createTeamWorkflow(){
 'use strict';
 const agents=['director','stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'];
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
 const txt=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v);
 const safeSummary=v=>txt(v,1600)&&!/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:sk-|sb_secret_)[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/i.test(v);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const active=(s,a)=>s?.enabled===true&&['manual','auto','semi'].includes(s.agents?.[a]);
 function authorize(state,ctx){
  if(ctx?.verified!==true||ctx.owner!==state?.owner||!id(ctx.owner)||!agents.includes(ctx.agent)||!id(state.id)||!Number.isSafeInteger(state.revision)||state.revision<0||!Array.isArray(state.children)||!Array.isArray(state.events)||!Number.isSafeInteger(ctx.expectedRevision)||ctx.expectedRevision!==state.revision)throw Error('Sessão ou revisão inválida.');
 }
 function next(state,event,changes={}){
  if(state.events.length>=64)throw Error('Limite de eventos atingido.');
  return {...copy(state),...changes,revision:state.revision+1,events:[...state.events,{seq:state.revision+1,...event}]};
 }
 function create(input,ctx,delegation){
  if(ctx?.verified!==true||ctx.humanApproval!==true||ctx.agent!=='director'||!id(ctx.owner)||!id(input?.id)||!active(ctx.settings,'director'))throw Error('Missão não autorizada.');
  const p=delegation.plan({root:{id:input.id,agent:'director'},proposals:input.proposals,settings:ctx.settings});
  if(p.children.length>8)throw Error('Limite de departamentos.');
  return {id:input.id,owner:ctx.owner,revision:0,status:'pending_review',children:p.children.map(c=>({...c,calls:0,result:null})),events:[]};
 }
 function approve(state,ctx){
  authorize(state,ctx);
  if(ctx.agent!=='director'||ctx.humanApproval!==true||state.status!=='pending_review'||!active(ctx.settings,'director')||state.children.some(c=>!active(ctx.settings,c.agent)))throw Error('Aprovação indisponível.');
  return next(state,{type:'approved',actor:'director'},{status:'active',children:state.children.map(c=>({...c,status:'approved'}))});
 }
 function claim(state,childId,ctx,delegation){
  authorize(state,ctx);
  const c=state.children.find(x=>x.id===childId);
  if(state.status!=='active'||!c||c.agent!==ctx.agent||!delegation.permit(c,ctx.settings,c.calls))throw Error('Trabalho indisponível.');
  return next(state,{type:'claimed',actor:c.agent,childId},{children:state.children.map(x=>x.id===childId?{...x,status:'working',calls:x.calls+1}:x)});
 }
 function submit(state,childId,result,ctx){
  authorize(state,ctx);
  const c=state.children.find(x=>x.id===childId);
  if(state.status!=='active'||c?.agent!==ctx.agent||c.status!=='working'||!active(ctx.settings,c.agent)||!active(ctx.settings,'director')||!safeSummary(result?.summary)||!['review','blocked'].includes(result?.status)||!Array.isArray(result.evidenceIds)||result.evidenceIds.length>12||!result.evidenceIds.every(id)||new Set(result.evidenceIds).size!==result.evidenceIds.length)throw Error('Resultado não elegível.');
  const record={summary:result.summary,status:result.status,evidenceIds:[...result.evidenceIds]};
  return next(state,{type:'submitted',actor:c.agent,childId},{children:state.children.map(x=>x.id===childId?{...x,status:'submitted',result:record}:x)});
 }
 function requestHelp(state,childId,message,ctx){
  authorize(state,ctx);
  const c=state.children.find(x=>x.id===childId);
  if(state.status!=='active'||!c||c.agent!==ctx.agent||c.status!=='working'||!active(ctx.settings,c.agent)||!active(ctx.settings,'director')||!safeSummary(message)||state.events.some(e=>e.type==='help_requested'&&e.childId===childId))throw Error('Pedido de colaboração indisponível.');
  return next(state,{type:'help_requested',actor:c.agent,childId,recipient:'director',summary:message});
 }
 function close(state,ctx){
  authorize(state,ctx);
  if(ctx.agent!=='director'||!active(ctx.settings,'director')||state.status!=='active'||!state.children.every(c=>c.status==='submitted'))throw Error('Existem trabalhos pendentes.');
  return next(state,{type:'consolidated',actor:'director'},{status:'review_ready'});
 }
 function cancel(state,ctx){
  authorize(state,ctx);
  if(ctx.agent!=='director'||ctx.humanApproval!==true||!['pending_review','active','review_ready'].includes(state.status))throw Error('Cancelamento não autorizado.');
  return next(state,{type:'cancelled',actor:'director'},{status:'cancelled',children:state.children.map(c=>c.status==='submitted'?c:{...c,status:'cancelled'})});
 }
 function inbox(state,ctx){
  authorize(state,ctx);
  if(!active(ctx.settings,ctx.agent)||state.status==='cancelled')throw Error('Caixa de trabalho indisponível.');
  if(ctx.agent==='director')return {status:state.status,revision:state.revision,children:state.children.map(c=>({id:c.id,agent:c.agent,status:c.status,result:c.result})),requests:state.events.filter(e=>e.type==='help_requested').map(copy)};
  return {status:state.status,revision:state.revision,children:state.children.filter(c=>c.agent===ctx.agent).map(copy)};
 }
 return {create,approve,claim,submit,requestHelp,close,cancel,inbox};
}
module.exports=createTeamWorkflow();
