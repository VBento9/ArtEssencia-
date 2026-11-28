'use strict';
const p=require('../intelligence/professional-memory.cjs');
function checks(p){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=f=>{let x=false;try{f()}catch{x=true}check(x,'expected rejection')};
 const c={owner:'owner-a',agent:'stock',verified:true,enabled:true,humanApproval:true,evidenceVerified:true,now:'2026-11-26T10:00:00Z',expiresAt:'2027-01-01T00:00:00Z'};
 const i={id:'m1',owner:c.owner,agent:c.agent,kind:'rule',summary:'Preservar unidades base nas fichas técnicas.',evidenceId:'decision-1'};
 const draft=p.propose(i,c);check(draft.status==='pending_review','draft');
 reject(()=>p.propose({...i,summary:'email cliente@example.com'},c));
 reject(()=>p.propose({...i,agent:'financeiro'},c));
 reject(()=>p.confirm(draft,{...c,humanApproval:false}));
 reject(()=>p.confirm(draft,{...c,evidenceVerified:false}));
 reject(()=>p.confirm(draft,{...c,expiresAt:'2030-01-01'}));
 const r=p.confirm(draft,c);check(r.status==='active','verified');
 const out=p.context([r],c);check(out.entries.length===1&&out.mode==='evidence_only'&&!('owner'in out.entries[0]),'context');
 check(p.context([r],{...c,agent:'director'}).entries.length===0,'department separation');
 check(p.context([r],{...c,owner:'owner-b'}).entries.length===0,'owner separation');
 check(p.context([r],{...c,now:'2027-01-01T00:00:00Z'}).entries.length===0,'expiry');
 check(p.context([draft],c).entries.length===0,'no drafts');
 check(p.context([p.revoke(r,c)],c).entries.length===0,'revocation');
 reject(()=>p.revoke(r,{...c,owner:'other'}));
 reject(()=>p.context([r,r],c));
 reject(()=>p.context([r],{...c,enabled:false}));
 const many=Array.from({length:20},(_,j)=>({...r,id:'m'+j,summary:'x'.repeat(700)}));check(JSON.stringify(p.context(many,c).entries).length<6300,'bounded context');
 return n;
}
console.log('Verificações concluídas:',checks(p));
