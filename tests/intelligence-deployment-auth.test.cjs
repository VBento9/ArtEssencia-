'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {check}=require('../intelligence/deployment-auth-check.cjs');
const id='00000000-0000-0000-0000-000000000002';
const env={VERCEL_ENV:'production',INTELLIGENCE_SERVICE_RELEASE:'approved',INTELLIGENCE_SUPABASE_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co',INTELLIGENCE_WORKER_AUTH:'service_account',INTELLIGENCE_WORKER_ENABLED:'false',INTELLIGENCE_PAID_RELEASE:'disabled',INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'fixture-public',INTELLIGENCE_SERVICE_EMAIL:'fixture@example.invalid',INTELLIGENCE_SERVICE_PASSWORD:'fixture-password',INTELLIGENCE_SERVICE_USER_ID:id};
function fixture(failure){
 const paths=[];const reply=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
 return {paths,request:async(url,opts)=>{
  const path=new URL(url).pathname;paths.push(path+new URL(url).search);assert.equal(opts.redirect,'error');
  assert.equal(new URL(url).origin,env.INTELLIGENCE_SUPABASE_URL);
  if(path.endsWith('/token'))return reply(failure==='login'?401:200,{access_token:'fixture-token',user:{id:failure==='identity'?'wrong':id}});
  assert.equal(opts.headers.Authorization,'Bearer fixture-token');
  if(path.endsWith('/user'))return reply(200,{id});
  if(path.endsWith('artessencia_is_owner_v1'))return reply(200,failure==='owner');
  if(path.endsWith('artessencia_intelligence_service_v1'))return failure==='binding'?reply(200,'owner'):reply(403,{code:'42501',message:'SERVICE_REQUIRED'});
  if(path.endsWith('/logout'))return reply(failure==='logout'?503:204,{});
  throw Error('Unexpected endpoint');
 }};
}
test('deployment validates real transport contract without provider calls and closes only its temporary session',async()=>{
 const f=fixture();assert.deepEqual(await check(env,f.request),{status:'verified',identityVerified:true,owner:false,executionBlocked:true,sessionClosed:true});
 assert.equal(f.paths.length,5);assert.equal(f.paths.at(-1),'/auth/v1/logout?scope=local');
});
test('wrong credentials, identity, owner privilege, active binding and logout failure stop deployment without retries',async()=>{
 for(const failure of ['login','identity','owner','binding','logout']){
  const f=fixture(failure);await assert.rejects(check(env,f.request),/DEPLOYMENT_AUTH_NOT_CONFIRMED/);
  assert.equal(f.paths.filter(p=>p.includes('grant_type=password')).length,1);
  if(failure!=='login')assert.equal(f.paths.filter(p=>p.includes('/logout')).length,1);
 }
});
test('preview skips authentication and enabled execution or wrong project fails before any request',async()=>{
 let calls=0;const request=()=>{calls++;throw Error('unexpected');};
 assert.deepEqual(await check({...env,VERCEL_ENV:'preview'},request),{status:'skipped'});
 for(const patch of [{INTELLIGENCE_WORKER_ENABLED:'true'},{INTELLIGENCE_PAID_RELEASE:'approved'},{INTELLIGENCE_SUPABASE_URL:'https://thqhyetvxledlgjdtmzp.supabase.co'},{INTELLIGENCE_SERVICE_PASSWORD:''}])await assert.rejects(check({...env,...patch},request),/CONFIGURATION/);
 assert.equal(calls,0);
});
