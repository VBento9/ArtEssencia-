'use strict';
// Read-only, no provider, transport, mission claim, secret disclosure or new financial approval.
// The subsequent execution independently repeats the runtime and SQL authorization checks.
const budget=require('./ai-budget-policy.cjs');
const approvedPricing=require('./approved-pricing.cjs');
function availability(env,worker,now=new Date()){
 try{
  if(env.INTELLIGENCE_WORKER_ENABLED!=='true')return {status:'disabled'};
  const mode=worker.hostedMode(env);
  if(mode!=='paid')return {status:'unavailable'};
  if(!env.INTELLIGENCE_OPENAI_API_KEY||!env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY)return {status:'unavailable'};
  if(env.INTELLIGENCE_WORKER_AUTH==='service_account'){
   if(!require('./worker-transport.cjs').productionServiceEnvironment(env)||!env.INTELLIGENCE_SERVICE_EMAIL||!env.INTELLIGENCE_SERVICE_PASSWORD||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.INTELLIGENCE_SERVICE_USER_ID||''))return {status:'unavailable'};
  }else{
   if(env.INTELLIGENCE_WORKER_AUTH&&env.INTELLIGENCE_WORKER_AUTH!=='jwt')return {status:'unavailable'};
   const claims=JSON.parse(Buffer.from((env.INTELLIGENCE_WORKER_JWT||'').split('.')[1]||'','base64url').toString());
   if(claims.role!=='artessencia_intelligence_worker'||typeof claims.sub!=='string'||!Number.isFinite(claims.exp)||claims.exp*1000<=now.getTime())return {status:'unavailable'};
  }
  require('./manual-activation.cjs').manualStage(env,now);
  const rate=approvedPricing(env,now)[env.INTELLIGENCE_TARIFF_ID];
  const maximumMicroeur=budget.estimate(rate);
  return {status:'configured',mode:'paid',maximumMicroeur};
 }catch{return {status:'unavailable'};}
}
async function checkedAvailability(env,worker,transport,owner,now=new Date()){
 const config=availability(env,worker,now);
 if(config.status!=='configured')return config;
 // Never let an expected disabled-binding response poison the execution
 // transport cached for this process. Probes get an independent environment.
 let call,confirmed=false;
 try{call=transport({...env});confirmed=await call('identity')===owner;}catch{}
 try{await call?.close?.();}catch{confirmed=false;}
 return confirmed?config:{status:'unavailable'};
}
module.exports={availability,checkedAvailability};
