'use strict';
// All browser-accessible commands are in the separate owner console.
function projectUrl(env=process.env){
  const value=env.INTELLIGENCE_SUPABASE_URL;
  if(typeof value!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value))throw Error('Projeto do executor inválido.');
  return value;
}
// The account-based transport is restricted to the isolated preview. Supabase
// issues short-lived access tokens; a fresh login is used when the cached
// session is near expiry. Never retry an ambiguous mutation.
function serviceTransport(env,request=fetch){
  const base=projectUrl(env),key=env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY;
  const serviceId=env.INTELLIGENCE_SERVICE_USER_ID;
  if(env.VERCEL_ENV!=='preview'||env.INTELLIGENCE_EXECUTION_MODE!=='simulation'||
     base!==env.INTELLIGENCE_ISOLATED_PROJECT_URL||
     base==='https://ihtsonqnnlrxvorfrarl.supabase.co'||base==='https://oosumysibccagrfbomab.supabase.co'||
     env.INTELLIGENCE_PAID_RELEASE==='approved'||env.OPENAI_API_KEY||env.INTELLIGENCE_OPENAI_API_KEY||env.INTELLIGENCE_FINANCIAL_APPROVAL||
     env.INTELLIGENCE_WORKER_JWT||!key||!env.INTELLIGENCE_SERVICE_EMAIL||!env.INTELLIGENCE_SERVICE_PASSWORD||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId||''))throw Error('Conta de serviço isolada indisponível.');
  let session=null,pending=null;
  async function login(){
    if(session&&session.exp*1000>Date.now()+60000)return session.token;
    if(!pending){
      pending=(async()=>{
        const res=await request(base+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
          headers:{apikey:key,'Content-Type':'application/json'},
          body:JSON.stringify({email:env.INTELLIGENCE_SERVICE_EMAIL,password:env.INTELLIGENCE_SERVICE_PASSWORD})});
        if(!res.ok)throw Error('Autenticação da conta de serviço indisponível.');
        const data=await res.json();
        const token=data.access_token;
        if(typeof token!=='string'||token.length>8192||data.user?.id!==serviceId)throw Error('Identidade de serviço inválida.');
        const claims=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString());
        if(claims.role!=='authenticated'||claims.sub!==serviceId||!claims.session_id||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()+60000)throw Error('Sessão de serviço inválida.');
        session={token,exp:claims.exp};return token;
      })().finally(()=>{pending=null;});
    }
    return pending;
  }
  return async(action,args={})=>{
    const token=await login();
    const res=await request(base+'/rest/v1/rpc/artessencia_intelligence_service_v1',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:action,p_args:args})});
    if(!res.ok){if(res.status===401||res.status===403)session=null;throw Error('Comando da conta de serviço por confirmar.');}
    return res.json();
  };
}
function transport(env=process.env){
  if(env.INTELLIGENCE_WORKER_AUTH==='service_account')return serviceTransport(env);
  if(env.INTELLIGENCE_WORKER_AUTH&&env.INTELLIGENCE_WORKER_AUTH!=='jwt')throw Error('Método de autenticação inválido.');
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
module.exports={transport,serviceTransport,chargeLedger,projectUrl,ownerSession,publicProductPhoto};
