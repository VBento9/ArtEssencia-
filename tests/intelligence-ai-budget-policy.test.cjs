'use strict';
const b=require('../intelligence/ai-budget-policy.cjs');
function checks(b){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=(f,m)=>{let x=false;try{f()}catch{x=true}check(x,m)};
 const p={verified:true,current:true,toolsEnabled:false,model:'fixture-mini',maxInputTokens:1000000,maxOutputTokens:1000000,inputRate:1000000,outputRate:4000000,grossBps:12300};
 const r={id:'a',month:'2026-11',channel:'director',releaseEnabled:true,authorized:true,pricing:p};
 const s=b.blank();check(b.estimate(p)===6150000,'gross calculation');
 reject(()=>b.reserve(s,{...r,releaseEnabled:false}),'off');reject(()=>b.reserve(s,{...r,authorized:false}),'auth');
 reject(()=>b.estimate({...p,current:false}),'stale');reject(()=>b.estimate({...p,toolsEnabled:true}),'tools');
 const a=b.reserve(s,r);check(b.usage(a,r.month).reserved===6150000,'reserve');check(s.entries.length===0,'immutable');
 reject(()=>b.reserve(a,r),'duplicate');const t=b.reserve(b.reserve(a,{...r,id:'b',channel:'legacy_social'}),{...r,id:'c',channel:'stock'});
 reject(()=>b.reserve(t,{...r,id:'d'}),'shared cap');
 const u=b.markUnknown(a,'a');check(b.usage(u,'2026-12').reserved===6150000,'unknown carried');
 reject(()=>b.reserve(u,{...r,id:'small'}),'unknown blocks all spending');
 reject(()=>b.reconcile(u,{id:'a',actual:0}),'no evidence');
 const v=b.reconcile(u,{id:'a',actual:2000000,trustedEvidence:true});check(b.usage(v,r.month).committed===2000000&&b.usage(v,r.month).reserved===0,'settled');
 reject(()=>b.reconcile(v,{id:'a',actual:0,trustedEvidence:true}),'repeat');
 const z=b.reconcile(a,{id:'a',actual:7000000,trustedEvidence:true});check(z.blocked,'overrun freeze');reject(()=>b.reserve(z,{...r,id:'b'}),'frozen');
 const q=b.reconcile(a,{id:'a',actual:0,trustedEvidence:true,noChargeConfirmed:true});check(b.usage(q,r.month).used===0,'confirmed void');
 check(b.channels.length===12&&b.ceiling===30000000&&b.stop===23000000,'scope');
 return n;
}
console.log('Verificações concluídas:',checks(b));
