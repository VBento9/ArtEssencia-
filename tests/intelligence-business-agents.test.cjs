'use strict';
const a=require('../intelligence/business-agents.js');
function tests(a){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=f=>{let x=false;try{f()}catch{x=true}check(x,'rejection')};const today='2026-11-26';
 const ci={today,quotes:[{id:'Q1',status:'open',followupDate:today,contactAllowed:true},{id:'Q2',status:'open',followupDate:today,contactAllowed:false},{id:'Q3',status:'closed',followupDate:today,contactAllowed:true}],requests:[{id:'R1',status:'unanswered',receivedDate:today}]};
 const before=JSON.stringify(ci),c=a.commercial(ci);check(c.tasks.length===3,'commercial');check(c.tasks.some(t=>t.kind==='review_quote'&&t.title.includes('Q2')),'contact');check(c.tasks.every(t=>t.requiresApproval),'approval');check(JSON.stringify(ci)===before,'immutability');
 reject(()=>a.commercial({...ci,quotes:[ci.quotes[0],ci.quotes[0]]}));
 const m=a.marketing({today,campaigns:[{id:'C1',status:'planned',startDate:today,endDate:'2026-12-24',assetsReady:false},{id:'C2',status:'active',startDate:'2026-10-01',endDate:'2026-10-31',assetsReady:false},{id:'C3',status:'planned',startDate:'2026-02-30',endDate:today}],posts:[{id:'P1',status:'planned',publishDate:today}]});check(m.tasks.length===3,'marketing');check(!m.tasks.some(t=>t.title.includes('C2')),'expired');check(m.tasks.some(t=>t.kind==='review_campaign'),'invalid date');
 const cat=a.catalog({products:[{code:'A',catalogEligible:true,published:true,description:'Vela'},{code:'B',catalogEligible:false}]});check(cat.tasks.length===1&&cat.tasks[0].priority===1,'catalog');check(cat.tasks[0].details.missing.includes('fotografia')&&!cat.tasks[0].details.missing.includes('descrição'),'missing');
 const inn=a.innovation({ideas:[{id:'I1',status:'testing',costVerified:true},{id:'I2',status:'planned',costVerified:true,safetyTestsComplete:true,feasibilityVerified:true,distinctiveFeaturesVerified:false},{id:'I3',status:'archived'}]});check(inn.tasks.length===2,'innovation');check(inn.tasks[0].details.missing.includes('ensaios de segurança'),'safety');check(inn.tasks[1].kind==='review_differentiation','differentiation');
 const au=a.audit({checks:[{id:'A',status:'pass',severity:'normal'},{id:'B',status:'unknown',severity:'critical'},{id:'C',status:'fail',severity:'normal'}],syncVerified:false});check(au.tasks.length===3,'audit');check(au.tasks[0].priority===1,'critical');check(au.tasks.every(t=>t.requiresApproval),'no writes');reject(()=>a.audit({checks:[{id:'X',status:'bogus',severity:'critical'}]}));reject(()=>a.catalog({products:null}));
 check([c,m,cat,inn,au].every(r=>r.mode==='proposal_only'),'proposal');
 return n;
}
console.log('Verificações concluídas:',tests(a));

const commercialFixture={today:'2026-11-26',quotes:[{id:'Q1',status:'open',recordStatus:'Rascunho',reference:'ORC-1',sourceDigest:'a'.repeat(64),followupDate:'2026-12-01',contactAllowed:false}],requests:[]};
const commercialResult=a.commercial(commercialFixture);
if(commercialResult.commercialProposals.length!==1||commercialResult.commercialProposals[0].kind!=='quote'||commercialResult.commercialProposals[0].requiresApproval!==true)throw Error('Proposta comercial vinculada');
if(a.commercial({...commercialFixture,quotes:[{...commercialFixture.quotes[0],sourceDigest:'invalid'}]}).commercialProposals.length)throw Error('Proposta sem evidência');
