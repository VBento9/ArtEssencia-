/* Intelligence — aprovação de contagens apenas em pré-visualização. */
function createBatchReview(){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
 function parse(text){
  if(typeof text!=='string'||text.length>100000)throw Error('Lista inválida ou demasiado extensa.');
  const rows=text.split(/\r?\n/).filter(l=>l.trim()).map((l,i)=>{
   const p=l.split(';').map(v=>v.trim());
   if(p.length!==3||!p[0]||! /^\d+(?:[.,]\d+)?$/.test(p[1]))throw Error('Linha '+(i+1)+': usa nome; quantidade; unidade.');
   return {name:p[0],qty:p[1].replace(',','.'),unit:p[2].toLowerCase()};
  });
  if(!rows.length||rows.length>500)throw Error('Introduz entre 1 e 500 linhas.');
  return rows;
 }
 function create({id,text,stock,owner,revision,core,at}){
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||typeof owner!=='string'||!owner||!Number.isSafeInteger(revision)||revision<0||!Array.isArray(stock)||!core||typeof at!=='string')throw Error('Contexto inválido.');
  const rows=parse(text),baseline=copy(stock),plan=core.inventoryPlan(rows,baseline);
  return {id,owner,revision,baseline,rows,plan,status:'review',history:[{event:'prepared',at,lines:plan.length}]};
 }
 function decide(batch,{selected,stock,owner,revision,core,at,allowed}){
  if(allowed!==true||batch?.status!=='review'||owner!==batch.owner||revision!==batch.revision||typeof at!=='string')throw Error('Missão indisponível ou autorização alterada.');
  if(stable(copy(stock))!==stable(batch.baseline)||stable(core.inventoryPlan(batch.rows,stock))!==stable(batch.plan))throw Error('O inventário mudou. Prepara uma nova revisão.');
  if(!Array.isArray(selected)||!selected.length||selected.some(i=>!Number.isSafeInteger(i))||new Set(selected).size!==selected.length)throw Error('Seleção inválida.');
  const approved=selected.map(i=>{
   const row=batch.plan[i];
   if(!row||row.index!==i||row.status!=='balance_review'||!Number.isFinite(row.delta)||row.delta===0)throw Error('A seleção contém uma linha que exige revisão adicional ou não tem alterações.');
   return {index:i,name:row.name,unit:row.unit,before:row.current,after:row.counted,delta:row.delta};
  });
  return {...batch,status:'approved_preview',approved,history:[...batch.history,{event:'approved_preview',at,lines:approved.length}]};
 }
 function cancel(batch,at){
  if(!['review','approved_preview'].includes(batch?.status))throw Error('Missão indisponível.');
  return {id:batch.id,status:'cancelled',history:[...batch.history,{event:'cancelled',at}]};
 }
 function exportDecision(batch){
  if(batch?.status!=='approved_preview')throw Error('Apenas uma revisão aprovada pode ser exportada.');
  return copy({schema:1,mode:'preview_only',id:batch.id,revision:batch.revision,approved:batch.approved,history:batch.history,warning:'Não constitui movimento de stock. Nenhuma gravação efetuada.'});
 }
 return {parse,create,decide,cancel,exportDecision};
}
if(typeof module==='object'&&module.exports)module.exports=createBatchReview();else globalThis.ArtEssenciaBatchReview=createBatchReview();
