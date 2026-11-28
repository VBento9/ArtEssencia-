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
  else{
   const metadata=await response.json();result.modelAccess=metadata.id===model&&metadata.object==='model';
   const organization=response.headers?.get('openai-organization');
   // Compare account scope without publishing an organization name or identifier.
   result.organizationFingerprint=typeof organization==='string'&&organization.length>0&&organization.length<300
    ? require('node:crypto').createHash('sha256').update(organization).digest('hex'):null;
  }
 }catch{result.modelNetworkFailure=true;}
 // Official read-only account identity endpoint. Never log names, email, user ID,
 // organization IDs or raw response. Hash only syntactically valid organization IDs.
 // Membership is not proof that this key is dedicated or that a particular project is billed.
 result.accountIdentity=false;
 result.accountOrganizationFingerprints=[];
 try{
  const response=await request('https://api.openai.com/v1/me',{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+config.apiKey}});
  if(!response.ok)result.accountIdentityHttpStatus=response.status;
  else{
   const account=await response.json();
   const entries=account?.orgs?.data;
   if(account?.object==='user'&&Array.isArray(entries)&&entries.length<=100){
    const ids=entries.map(x=>x?.id);
    if(ids.length>0&&ids.every(x=>typeof x==='string'&&/^org-[A-Za-z0-9_-]{1,200}$/.test(x))){
     const {createHash}=require('node:crypto');
     result.accountOrganizationFingerprints=[...new Set(ids.map(x=>createHash('sha256').update(x).digest('hex')))].sort();
     result.accountIdentity=true;
    }
   }
  }
 }catch{result.accountIdentityNetworkFailure=true;}
 if(result.serviceAuthentication&&result.modelAccess)result.status='preflight_passed';
 return result;
};
