/* Intelligence — reversão compensatória, exclusivamente simulação. */
function createReversalPlanner(){
 'use strict';
 const source='intelligence_count_v1',reversal='intelligence_count_reversal_v1';
 const validId=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12;
 const units=new Set(['g','ml','cm','un']);
 const norm=v=>typeof v==='string'?v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' '):'';
 const copy=v=>JSON.parse(JSON.stringify(v));
 const stable=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(stable).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
 function plan(state,{missionId,reversalId,revision}={}){
  if(!validId(missionId)||!validId(reversalId)||missionId.toLowerCase()===reversalId.toLowerCase()||!Number.isSafeInteger(revision)||revision<0||state?.revision!==revision||!Array.isArray(state?.data?.stock)||!Array.isArray(state?.data?.stockMoves))throw Error('Contexto ou revisão inválida.');
  const {stock,stockMoves}=state.data;
  if(!stock.every(x=>x&&typeof x.name==='string'&&norm(x.name))||!stockMoves.every(x=>x&&typeof x.item==='string'&&norm(x.item)))throw Error('Histórico ou stock inválido.');
  const id=missionId.toLowerCase(),rid=reversalId.toLowerCase(),eq=(a,b)=>typeof a==='string'&&a.toLowerCase()===b;
  const originals=stockMoves.map((m,i)=>({m,i})).filter(({m})=>m.source===source&&eq(m.intelligenceMissionId,id));
  const blockers=[],lines=[];
  if(!originals.length||originals.length>500)blockers.push('missao_original_inexistente_ou_invalida');
  if(stockMoves.some(m=>eq(m.intelligenceMissionId,rid)))blockers.push('identificador_ja_utilizado');
  if(stockMoves.some(m=>eq(m.reversesIntelligenceMissionId,id)))blockers.push('missao_ja_revertida');
  const keys=new Set();
  for(const {m,i} of originals){
   const key=norm(m.item);
   if(!key||keys.has(key)){blockers.push('materiais_originais_ambiguos');continue;}keys.add(key);
   if(m.type!=='adjust'||!units.has(m.unit)||!num(m.beforeQty)||!num(m.afterQty)||m.beforeQty===m.afterQty||m.qty!==m.afterQty||!Number.isFinite(m.delta)||Math.abs(m.delta-(m.afterQty-m.beforeQty))>1e-8||m.unit==='un'&&(!Number.isInteger(m.beforeQty)||!Number.isInteger(m.afterQty))){blockers.push('movimento_original_invalido');continue;}
   const matches=stock.filter(s=>norm(s.name)===key);
   if(matches.length!==1||matches[0].name!==m.item||matches[0].unit!==m.unit||!num(matches[0].qty)||matches[0].qty!==m.afterQty){blockers.push('saldo_ou_referencia_alterada');continue;}
   if(stockMoves.slice(i+1).some(x=>norm(x.item)===key)){blockers.push('movimento_posterior');continue;}
   lines.push({name:m.item,unit:m.unit,before:m.afterQty,after:m.beforeQty,delta:m.beforeQty-m.afterQty});
  }
  return {mode:'preview_only',status:blockers.length?'blocked':'review',missionId:id,reversalId:rid,revision,requiresApproval:true,blockers:[...new Set(blockers)],lines:blockers.length?[]:lines};
 }
 function simulate(state,proposal,stamp){
  if(proposal?.status!=='review'||typeof stamp!=='string'||!Number.isFinite(Date.parse(stamp)))throw Error('Reversão não elegível.');
  const expected=plan(state,proposal);
  if(stable(expected)!==stable(proposal))throw Error('Plano alterado ou desatualizado.');
  const next=copy(state);
  for(const line of expected.lines){
   const item=next.data.stock.find(s=>s.name===line.name);item.qty=line.after;
   next.data.stockMoves.push({date:stamp,item:line.name,unit:line.unit,type:'adjust',qty:line.after,beforeQty:line.before,afterQty:line.after,delta:line.delta,note:'Reversão simulada — Intelligence',source:reversal,intelligenceMissionId:expected.reversalId,reversesIntelligenceMissionId:expected.missionId});
  }
  next.revision++;
  return {mode:'simulation_only',state:next};
 }
 return {plan,simulate};
}
module.exports=createReversalPlanner();
