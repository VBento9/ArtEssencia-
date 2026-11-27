'use strict';
// All browser-accessible commands are in the separate owner console.
function projectUrl(env=process.env){
  const value=env.INTELLIGENCE_SUPABASE_URL;
  if(typeof value!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value))throw Error('Projeto do executor inválido.');
  return value;
}
function transport(env=process.env){
  if(!env.INTELLIGENCE_WORKER_JWT||!env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY)throw Error('Executor indisponível.');
  const endpoint=projectUrl(env)+'/rest/v1/rpc/artessencia_intelligence_worker_v1';
  const claims=JSON.parse(Buffer.from(env.INTELLIGENCE_WORKER_JWT.split('.')[1]||'','base64url').toString());
  if(claims.role!=='artessencia_intelligence_worker'||!claims.sub||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now())throw Error('Credencial específica do executor indisponível.');
  return async(action,args={})=>{
    const result=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+env.INTELLIGENCE_WORKER_JWT,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:action,p_args:args})});
    if(!result.ok)throw Error('Comando do servidor por confirmar.');
    return result.json();
  };
}
function chargeLedger(call,scope){
  return {
    reserve:r=>call('reserve',{...scope,request:r.requestId,channel:r.channel,model:r.model,maximum:r.maximumMicroeur}),
    claim:request=>call('claim_charge',{...scope,request}),unknown:request=>call('unknown',{request}),
    settle:r=>call('settle',{request:r.requestId,actual:r.actualMicroeur,evidence:r.evidenceRef})
  };
}
module.exports={transport,chargeLedger,projectUrl};
