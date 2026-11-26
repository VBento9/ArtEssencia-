'use strict';
const w=require('../intelligence/team-workflow.cjs'),d=require('../intelligence/delegation.cjs');
function checks(w,d){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=f=>{let x=false;try{f()}catch{x=true}check(x,'expected rejection')};
 const settings={enabled:true,agents:{director:'auto',stock:'auto',financeiro:'manual'}},ctx={verified:true,humanApproval:true,owner:'owner-a',agent:'director',expectedRevision:0,settings};
 const input={id:'root',proposals:[{id:'a',agent:'stock',kind:'inventory_audit',instruction:'Rever materiais'},{id:'b',agent:'financeiro',kind:'finance_review',instruction:'Rever custos'}]};
 const c=(s,agent='director',extra={})=>({...ctx,agent,expectedRevision:s.revision,...extra});
 const s=w.create(input,ctx,d);check(s.status==='pending_review'&&s.children.length===2,'create');reject(()=>w.claim(s,'a',c(s,'stock'),d));reject(()=>w.approve(s,c(s,'director',{humanApproval:false})));
 const a=w.approve(s,c(s));check(a.status==='active'&&a.revision===1,'approve');reject(()=>w.claim(a,'a',c(a,'financeiro'),d));reject(()=>w.claim(a,'a',c(a,'stock',{expectedRevision:0}),d));
 const b=w.claim(a,'a',c(a,'stock'),d);check(b.children[0].calls===1,'claim');reject(()=>w.claim(b,'a',c(b,'stock'),d));
 const h=w.requestHelp(b,'a','Preciso de revisão de custos.',c(b,'stock'));check(w.inbox(h,c(h)).requests.length===1,'help');reject(()=>w.requestHelp(h,'a','Repetição',c(h,'stock')));
 check(w.inbox(h,c(h,'stock')).children.length===1,'scope');reject(()=>w.inbox(h,c(h,'stock',{owner:'owner-b'})));
 const result={status:'review',summary:'Duas referências a confirmar.',evidenceIds:['audit-1']};
 reject(()=>w.submit(h,'a',{...result,summary:'cliente@example.com'},c(h,'stock')));
 const e=w.submit(h,'a',result,c(h,'stock'));check(e.children[0].status==='submitted','submit');reject(()=>w.close(e,c(e)));
 const f=w.claim(e,'b',c(e,'financeiro'),d);const g=w.submit(f,'b',{status:'blocked',summary:'Custo por validar.',evidenceIds:[]},c(f,'financeiro'));
 const j=w.close(g,c(g));check(j.status==='review_ready'&&j.children[1].result.status==='blocked','consolidate');check(s.events.length===0&&s.children[0].status==='pending_review','immutable');
 const k=w.cancel(j,c(j));check(k.status==='cancelled','cancel');reject(()=>w.inbox(k,c(k)));
 reject(()=>w.claim(a,'a',c(a,'stock',{settings:{...settings,agents:{...settings.agents,stock:'off'}}}),d));
 return n;
}
console.log('Verificações concluídas:',checks(w,d));
