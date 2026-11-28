'use strict';
// Deployment safety check only. No provider, mission, worker enablement or data writes.
async function check(env=process.env,request=fetch){
 if(env.VERCEL_ENV!=='production'||env.INTELLIGENCE_SERVICE_RELEASE!=='approved')return {status:'skipped'};
 const base='https://ihtsonqnnlrxvorfrarl.supabase.co';
 if(env.INTELLIGENCE_SUPABASE_URL!==base||env.INTELLIGENCE_WORKER_AUTH!=='service_account'||
    env.INTELLIGENCE_WORKER_ENABLED!=='false'||env.INTELLIGENCE_PAID_RELEASE==='approved'||
    !env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY||!env.INTELLIGENCE_SERVICE_EMAIL||!env.INTELLIGENCE_SERVICE_PASSWORD||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.INTELLIGENCE_SERVICE_USER_ID||''))throw Error('DEPLOYMENT_AUTH_CONFIGURATION');
 let token=null,passed=false,closed=false;
 const call=(path,body)=>request(base+path,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(10000),
  headers:{apikey:env.INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 try{
  const login=await call('/auth/v1/token?grant_type=password',{email:env.INTELLIGENCE_SERVICE_EMAIL,password:env.INTELLIGENCE_SERVICE_PASSWORD});
  if(!login.ok)throw Error();
  const session=await login.json();token=session.access_token;
  if(typeof token!=='string'||!token||session.user?.id!==env.INTELLIGENCE_SERVICE_USER_ID)throw Error();
  const user=await call('/auth/v1/user');
  if(!user.ok||(await user.json()).id!==env.INTELLIGENCE_SERVICE_USER_ID)throw Error();
  const owner=await call('/rest/v1/rpc/artessencia_is_owner_v1',{});
  if(!owner.ok||await owner.json()!==false)throw Error();
  const bridge=await call('/rest/v1/rpc/artessencia_intelligence_service_v1',{p_action:'identity',p_args:{}});
  const denied=await bridge.json();
  if(bridge.status!==403||denied.code!=='42501'||denied.message!=='SERVICE_REQUIRED')throw Error();
  passed=true;
 }catch{passed=false;}
 finally{
  if(token){try{closed=(await call('/auth/v1/logout?scope=local',{})).ok;}catch{closed=false;}}
 }
 if(!passed||!closed)throw Error('DEPLOYMENT_AUTH_NOT_CONFIRMED');
 return {status:'verified',identityVerified:true,owner:false,executionBlocked:true,sessionClosed:true};
}
module.exports={check};
