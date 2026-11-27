'use strict';
// All browser-accessible commands are in the separate owner console.
const isolatedProjectUrl='https://thqhyetvxledlgjdtmzp.supabase.co';
function projectUrl(env=process.env){
  const value=env.INTELLIGENCE_SUPABASE_URL;
  if(typeof value!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(value))throw Error('Projeto do executor inválido.');
  return value;
}
// Trial is a distinct, explicitly gated isolated mode, never a paid production override.
function isolatedTrialEnvironment(env){
 const hosted=env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='feature/intelligence-hybrid-foundation-20261126'&&!env.INTELLIGENCE_EXECUTION_HOST;
 const local=env.INTELLIGENCE_EXECUTION_HOST==='local'&&!env.VERCEL_ENV&&!env.VERCEL&&!env.VERCEL_GIT_COMMIT_REF;
 const remote=env.INTELLIGENCE_EXECUTION_HOST==='github_actions'&&env.GITHUB_ACTIONS==='true'&&
  env.GITHUB_REPOSITORY==='VBento9/ArtEssencia-'&&env.GITHUB_REF==='refs/heads/main'&&
  env.GITHUB_EVENT_NAME==='workflow_dispatch'&&!env.VERCEL_ENV&&!env.VERCEL&&!env.VERCEL_GIT_COMMIT_REF;
 return (hosted||local||remote)&&
  env.INTELLIGENCE_EXECUTION_MODE==='trial'&&env.INTELLIGENCE_TRIAL_RELEASE==='approved'&&
  env.INTELLIGENCE_SUPABASE_URL===isolatedProjectUrl&&env.INTELLIGENCE_ISOLATED_PROJECT_URL===isolatedProjectUrl&&
  env.INTELLIGENCE_WORKER_AUTH==='service_account'&&env.INTELLIGENCE_PAID_RELEASE!=='approved'&&
  !env.OPENAI_API_KEY&&!!env.INTELLIGENCE_OPENAI_API_KEY&&!!env.INTELLIGENCE_FINANCIAL_APPROVAL&&!env.INTELLIGENCE_WORKER_JWT;
}
// Production service authentication is an explicit release, independent of the
// financial release. The Cloud binding starts disabled and authorizes each RPC.
function productionServiceEnvironment(env){
 return env.VERCEL_ENV==='production'&&env.INTELLIGENCE_SUPABASE_URL==='https://ihtsonqnnlrxvorfrarl.supabase.co'&&
  env.INTELLIGENCE_SERVICE_RELEASE==='approved'&&env.INTELLIGENCE_WORKER_AUTH==='service_account'&&
  !env.INTELLIGENCE_WORKER_JWT&&!env.INTELLIGENCE_EXECUTION_HOST&&
  (!env.INTELLIGENCE_EXECUTION_MODE||env.INTELLIGENCE_EXECUTION_MODE==='paid');
}
// The account-based transport is restricted to the released production or isolated preview. Supabase
// issues short-lived access tokens; rotate the refresh token within one warm
// executor instance. Fail closed on authentication failures. Never retry a mutation.
function serviceTransport(env,request=fetch){
  const base=projectUrl(env),key=env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY;
  const serviceId=env.INTELLIGENCE_SERVICE_USER_ID;
  const simulation=env.VERCEL_ENV==='preview'&&env.INTELLIGENCE_EXECUTION_MODE==='simulation'&&
     base===env.INTELLIGENCE_ISOLATED_PROJECT_URL&&base===isolatedProjectUrl&&
     env.INTELLIGENCE_PAID_RELEASE!=='approved'&&env.INTELLIGENCE_TRIAL_RELEASE!=='approved'&&!env.OPENAI_API_KEY&&
     !env.INTELLIGENCE_OPENAI_API_KEY&&!env.INTELLIGENCE_FINANCIAL_APPROVAL&&!env.INTELLIGENCE_WORKER_JWT;
  if((!simulation&&!isolatedTrialEnvironment(env)&&!productionServiceEnvironment(env))||!key||!env.INTELLIGENCE_SERVICE_EMAIL||!env.INTELLIGENCE_SERVICE_PASSWORD||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId||''))throw Error('Conta de serviço isolada indisponível.');
  let session=null,pending=null,blocked=false;
  function invalidate(){
    blocked=true;
    session=null;
  }
  async function login(){
    if(blocked)throw Error('Sessão do executor bloqueada; intervenção necessária.');
    if(session&&session.exp*1000>Date.now()+60000)return session.token;
    if(!pending){
      const previous=session;
      pending=(async()=>{
        try{
          const grant=previous?'refresh_token':'password';
          const body=previous?{refresh_token:previous.refreshToken}:{email:env.INTELLIGENCE_SERVICE_EMAIL,password:env.INTELLIGENCE_SERVICE_PASSWORD};
          const res=await request(base+'/auth/v1/token?grant_type='+grant,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
            headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});
          if(!res.ok)throw Error('Autenticação indisponível.');
          const data=await res.json();
          const token=data.access_token,refreshToken=data.refresh_token;
          if(typeof token!=='string'||token.length>8192||typeof refreshToken!=='string'||!refreshToken||refreshToken.length>8192||data.user?.id!==serviceId)throw Error('Identidade de serviço inválida.');
          const claims=JSON.parse(Buffer.from(token.split('.')[1]||'','base64url').toString());
          if(claims.role!=='authenticated'||claims.sub!==serviceId||typeof claims.session_id!=='string'||!claims.session_id||
             (previous&&claims.session_id!==previous.id)||!Number.isFinite(claims.exp)||claims.exp*1000<=Date.now()+60000||blocked)throw Error('Sessão de serviço inválida.');
          session={token,refreshToken,exp:claims.exp,id:claims.session_id};
          return token;
        }catch{
          // Refresh may have rotated a token before a response was lost.
          // Do not replay it or silently authenticate again with the password.
          invalidate();
          throw Error('Autenticação da conta de serviço indisponível; intervenção necessária.');
        }
      })().finally(()=>{pending=null;});
    }
    return pending;
  }
  return async(action,args={})=>{
    const token=await login();
    if(blocked)throw Error('Sessão do executor bloqueada; intervenção necessária.');
    const res=await request(base+'/rest/v1/rpc/artessencia_intelligence_service_v1',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({p_action:action,p_args:args})});
    if(!res.ok){if(res.status===401||res.status===403)invalidate();throw Error('Comando da conta de serviço por confirmar.');}
    return res.json();
  };
}
// Cache only the real process environment; injected test environments remain independent.
// Cold instances authenticate independently; the database binding and session check
// remain the authoritative revocation gate for all instances.
let warmServiceTransport=null;
function transport(env=process.env){
  if(env.INTELLIGENCE_WORKER_AUTH==='service_account'){
    if(env!==process.env)return serviceTransport(env);
    if(!warmServiceTransport)warmServiceTransport=serviceTransport(env);
    return warmServiceTransport;
  }
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
module.exports={productionServiceEnvironment,isolatedProjectUrl,isolatedTrialEnvironment,transport,serviceTransport,chargeLedger,projectUrl,ownerSession,publicProductPhoto};
