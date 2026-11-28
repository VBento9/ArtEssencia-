/* Professional memory policy. Data is evidence, never system instructions. */
function createMemoryPolicy(){
 'use strict';
 const agents=['director','stock','producao','financeiro','comercial','marketing','inovacao','catalogo','auditoria'];
 const kinds=['objective','decision','rule','lesson','mission_summary'];
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
 const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=1000&&!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(x);
 const privatePattern=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+351\s*)?\b9\d{8}\b|\b(?:sk-|sb_secret_)[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/i;
 function valid(r){
  return r&&id(r.id)&&id(r.owner)&&agents.includes(r.agent)&&kinds.includes(r.kind)&&text(r.summary)&&!privatePattern.test(r.summary)&&id(r.evidenceId)&&['owner_verified','server_verified'].includes(r.provenance)&&date(r.createdAt)&&date(r.expiresAt)&&Date.parse(r.expiresAt)>Date.parse(r.createdAt)&&['active','revoked'].includes(r.status);
 }
 function propose(input,ctx){
  if(ctx?.verified!==true||ctx?.owner!==input?.owner||!agents.includes(ctx.agent)||ctx.agent!==input.agent||ctx.enabled!==true||!id(input.id)||!kinds.includes(input.kind)||!text(input.summary)||privatePattern.test(input.summary)||!id(input.evidenceId))throw Error('Memória não elegível.');
  return {id:input.id,owner:ctx.owner,agent:ctx.agent,kind:input.kind,summary:input.summary,evidenceId:input.evidenceId,status:'pending_review'};
 }
 function confirm(proposal,ctx){
  if(proposal?.status!=='pending_review'||ctx?.verified!==true||ctx.owner!==proposal.owner||ctx.agent!==proposal.agent||ctx.humanApproval!==true||ctx.evidenceVerified!==true||!date(ctx.now)||!date(ctx.expiresAt)||Date.parse(ctx.expiresAt)-Date.parse(ctx.now)>365*86400000)throw Error('Confirmação não autorizada.');
  const r={id:proposal.id,owner:proposal.owner,agent:proposal.agent,kind:proposal.kind,summary:proposal.summary,evidenceId:proposal.evidenceId,provenance:'owner_verified',createdAt:ctx.now,expiresAt:ctx.expiresAt,status:'active'};
  if(!valid(r))throw Error('Memória inválida.');
  return r;
 }
 function context(records,ctx){
  if(!Array.isArray(records)||ctx?.verified!==true||ctx.enabled!==true||!id(ctx.owner)||!agents.includes(ctx.agent)||!date(ctx.now))throw Error('Contexto indisponível.');
  const now=Date.parse(ctx.now),seen=new Set(),out=[];
  const eligible=records.filter(r=>valid(r)&&r.owner===ctx.owner&&r.agent===ctx.agent&&r.status==='active'&&Date.parse(r.createdAt)<=now&&Date.parse(r.expiresAt)>now).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
  let size=0;
  for(const r of eligible){if(seen.has(r.id))throw Error('Memória duplicada.');seen.add(r.id);if(out.length>=12)continue;const entry={kind:r.kind,summary:r.summary,evidenceId:r.evidenceId,createdAt:r.createdAt};const len=JSON.stringify(entry).length;if(size+len>6000)continue;out.push(entry);size+=len;}
  return {mode:'evidence_only',agent:ctx.agent,entries:out};
 }
 function revoke(r,ctx){
  if(!valid(r)||ctx?.verified!==true||ctx.humanApproval!==true||ctx.owner!==r.owner||ctx.agent!==r.agent)throw Error('Revogação não autorizada.');
  return {...r,status:'revoked'};
 }
 return {propose,confirm,context,revoke};
}
module.exports=createMemoryPolicy();
