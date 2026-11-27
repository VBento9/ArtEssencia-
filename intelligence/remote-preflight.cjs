'use strict';
const {environment}=require('./local-trial.cjs');
const {isolatedTrialEnvironment,isolatedProjectUrl}=require('./worker-transport.cjs');
const model='gpt-5.4-mini-2026-03-17';
// Credentials remain inside the runner. No Responses request, mission, reservation,
// application write, provider response body or auth token is returned or logged.
module.exports=async function preflight(config,host=process.env,request=fetch){
 const env={...environment(config),INTELLIGENCE_EXECUTION_HOST:'github_actions'};
 for(const key of ['GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','VERCEL_ENV','VERCEL','VERCEL_GIT_COMMIT_REF'])env[key]=host[key];
 if(!isolatedTrialEnvironment(env))throw Error('Ensaio remoto indisponível.');
 const result={status:'preflight_blocked',serviceAuthentication:false,modelAccess:false,model,paidRequest:false};
 try{
  const response=await request(isolatedProjectUrl+'/auth/v1/token?grant_type=password',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:config.serviceEmail,password:config.servicePassword})});
  if(!response.ok)result.serviceHttpStatus=response.status;
  else{
   const session=await response.json();
   result.serviceAuthentication=session.user?.id===config.serviceId&&typeof session.access_token==='string'&&!!session.access_token;
  }
 }catch{result.serviceNetworkFailure=true;}
 try{
  const response=await request('https://api.openai.com/v1/models/'+model,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+config.apiKey}});
  if(!response.ok)result.modelHttpStatus=response.status;
  else{const metadata=await response.json();result.modelAccess=metadata.id===model&&metadata.object==='model';}
 }catch{result.modelNetworkFailure=true;}
 if(result.serviceAuthentication&&result.modelAccess)result.status='preflight_passed';
 return result;
};
