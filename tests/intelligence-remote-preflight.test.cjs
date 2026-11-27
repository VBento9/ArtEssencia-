'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const preflight=require('../intelligence/remote-preflight.cjs');
const config={publishableKey:'sb_publishable_fixture',serviceId:'00000000-0000-0000-0000-000000000001',serviceEmail:'service@example.invalid',servicePassword:'private-password-fixture',apiKey:'private-key-fixture',financialApproval:'{}'};
const host={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'VBento9/ArtEssencia-',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch'};
const model='gpt-5.4-mini-2026-03-17';
test('preflight verifies real transports without Responses, missions, ledger or secret output',async()=>{
 const calls=[];const result=await preflight(config,host,async(url,o)=>{
  calls.push([url,o]);assert.equal(o.redirect,'error');
  return {ok:true,headers:{get:()=> 'private-organization-fixture'},json:async()=>url.includes('/auth/')?{user:{id:config.serviceId},access_token:'private-token-fixture'}:{id:model,object:'model'}};
 });
 assert.equal(result.status,'preflight_passed');assert.equal(result.paidRequest,false);
 assert.equal(result.organizationFingerprint,require('node:crypto').createHash('sha256').update('private-organization-fixture').digest('hex')); 
 assert.equal(calls.length,2);assert.equal(calls[0][1].method,'POST');assert.equal(calls[1][1].method,'GET');
 assert.equal(calls[0][0],'https://thqhyetvxledlgjdtmzp.supabase.co/auth/v1/token?grant_type=password');
 assert.equal(calls[1][0],'https://api.openai.com/v1/models/'+model);
 assert.ok(!JSON.stringify(result).includes('private-'));
});
test('credential, identity and network failures are sanitized and not retried',async()=>{
 let calls=0;let result=await preflight(config,host,async()=>{calls++;return {ok:false,status:401};});
 assert.equal(calls,2);assert.equal(result.status,'preflight_blocked');assert.equal(result.serviceHttpStatus,401);assert.equal(result.modelHttpStatus,401);
 result=await preflight(config,host,async()=>({ok:true,json:async()=>({user:{id:'wrong'},access_token:'private',id:'wrong',object:'model'})}));
 assert.equal(result.serviceAuthentication,false);assert.equal(result.modelAccess,false);
 result=await preflight(config,host,async()=>{throw Error('private-fixture');});
 assert.equal(result.serviceNetworkFailure,true);assert.equal(result.modelNetworkFailure,true);assert.ok(!JSON.stringify(result).includes('private'));
 await assert.rejects(preflight(config,{...host,GITHUB_EVENT_NAME:'push'},async()=>{throw Error('unexpected');}));
});
