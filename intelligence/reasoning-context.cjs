'use strict';
// Preserve original evidence and full deterministic results. Reduce model input only.
const LIMIT=24000;
const encode=JSON.stringify;
const grouped=(rows,key)=>Object.fromEntries([...rows.reduce((m,r)=>{const k=typeof r?.[key]==='string'?r[key]:'unknown';m.set(k,(m.get(k)||0)+1);return m;},new Map())].sort(([a],[b])=>a.localeCompare(b)));
function ranked(key,rows){
 const out=rows.slice();
 if(key==='tasks')out.sort((a,b)=>(a.priority??4)-(b.priority??4)||String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31')));
 if(key==='margins')out.sort((a,b)=>(a.marginPct??Infinity)-(b.marginPct??Infinity));
 if(key==='receivables')out.sort((a,b)=>(b.dueCents??0)-(a.dueCents??0));
 return out;
}
function build(input){
 const full=encode(input);
 if(full.length<=LIMIT)return {context:full,coverage:null};
 const original=input.report;
 if(!original||typeof original!=='object'||Array.isArray(original))throw Object.assign(Error('Contexto inválido.'),{contextCode:'context_limit'});
 for(const limit of [40,20,10,5,1,0]){
  const coverage={mode:'bounded_model_context',originalCharacters:full.length,collections:{},note:'Relatório determinístico completo preservado para revisão. Amostras priorizadas não representam todos os registos. Não inferir totais ou ausência a partir da amostra.'};
  function reduce(value,path){
   if(Array.isArray(value)){
    const key=path.split('.').at(-1),sample=ranked(key,value).slice(0,limit);
    const stats={total:value.length,included:sample.length,omitted:value.length-sample.length};
    if(key==='tasks'){stats.byKind=grouped(value,'kind');stats.byPriority=Object.fromEntries([1,2,3].map(n=>[n,value.filter(t=>t?.priority===n).length]));}
    if(key==='margins')stats.negativeMargin=value.filter(m=>typeof m?.profit==='number'&&m.profit<0).length;
    if(key==='receivables'&&value.every(r=>Number.isSafeInteger(r?.dueCents)&&r.dueCents>=0)){const total=value.reduce((s,r)=>s+r.dueCents,0);if(Number.isSafeInteger(total))stats.totalDueCents=total;}
    if(key==='issues')stats.byKind=grouped(value,'kind');
    if(stats.omitted||['tasks','margins','receivables','issues'].includes(key))coverage.collections[path]=stats;
    return sample.map((v,i)=>reduce(v,path+'['+i+']'));
   }
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,reduce(v,path+'.'+k)]));
   if(typeof value==='string'&&value.length>1000){coverage.collections[path]={originalCharacters:value.length,includedCharacters:1000};return value.slice(0,1000)+' [excerto]';}
   return value;
  }
  const report=reduce(original,'report'),context=encode({...input,report,reasoningCoverage:coverage});
  if(context.length<=LIMIT)return {context,coverage};
 }
 throw Object.assign(Error('Contexto não cabe sem perder evidência essencial.'),{contextCode:'context_limit'});
}
module.exports={build,LIMIT};
