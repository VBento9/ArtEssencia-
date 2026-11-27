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
// Authenticate against exactly the worker's project; never fall back to production.
async function ownerSession(req,{env=process.env,request=fetch}={}){
  const token=String(req?.headers?.authorization||'');
  if(!/^Bearer [^ ]+$/.test(token)||token.length>8192)return null;
  const base=projectUrl(env),key=env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY;
  if(typeof key!=='string'||!key)throw Error('Projeto de autenticação indisponível.');
  const headers={Authorization:token,apikey:key};
  const options={headers,redirect:'error',signal:AbortSignal.timeout(10000)};
  const user=await request(base+'/auth/v1/user',options);
  if(!user.ok)return null;
  const id=(await user.json())?.id;
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;
  const permission=await request(base+'/rest/v1/rpc/artessencia_is_owner_v1',{...options,method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'});
  return permission.ok&&await permission.json()===true?id:null;
}
function publicProductPhoto(value,env=process.env){
  if(typeof value!=='string'||!value.trim()||value.length>2500)return '';
  try{
    const url=new URL(value),base=new URL(projectUrl(env));
    const path='/storage/v1/object/public/artessencia-shop/';
    if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(path)||url.pathname.length<=path.length)return '';
    return url.href;
  }catch{return '';}
}
module.exports={transport,chargeLedger,projectUrl,ownerSession,publicProductPhoto};
