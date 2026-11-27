'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {run}=require('../intelligence/remote-trial.cjs');
const {environment}=require('../intelligence/local-trial.cjs');
const {isolatedTrialEnvironment}=require('../intelligence/worker-transport.cjs');
const server=require('../intelligence/server-runtime.cjs');
const owner='00000000-0000-0000-0000-000000000001',service='00000000-0000-0000-0000-000000000002',mission='00000000-0000-0000-0000-000000000003';
const config={publishableKey:'sb_publishable_fixture',serviceId:service,serviceEmail:'service@example.invalid',servicePassword:'fixture',apiKey:'fixture',financialApproval:'{}'};
const host={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'VBento9/ArtEssencia-',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch'};
const env={...environment(config),...host,INTELLIGENCE_EXECUTION_HOST:'github_actions'};
test('remote trial accepts only explicit main dispatch in the existing repository',async()=>{
 assert.equal(isolatedTrialEnvironment(env),true);
 for(const change of [{GITHUB_ACTIONS:'false'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/other'},{GITHUB_EVENT_NAME:'push'},{GITHUB_EVENT_NAME:'pull_request'},{VERCEL_ENV:'preview'}]){
  assert.equal(isolatedTrialEnvironment({...env,...change}),false);
  await assert.rejects(server.composeRemoteTrial({env:{...env,...change},call:async()=>{throw Error('unexpected');}}),/remoto/);
 }
 assert.throws(()=>server.hostedMode(env));assert.throws(()=>server.compose({env}));
 await assert.rejects(server.composeLocalTrial({env}),/local/);
 await assert.rejects(server.composeRemoteTrial({env,call:async()=>true}),/financeira/);
});
test('remote executor uses one approved mission and never creates, approves or retries',async()=>{
 const calls=[];
 const deps={compose:async({env})=>{assert.equal(isolatedTrialEnvironment(env),true);return {call:async(action)=>{calls.push(action);return owner;}};},
  processNext:async(runtime,command)=>{calls.push(command);return {status:'blocked',stage:'reasoning',diagnostic:'decision_task',chargedMicroeur:4,document:'private'};}};
 const result=await run(config,{missionId:mission,revision:1},host,deps);
 assert.deepEqual(calls,['identity',{owner,missionId:mission,revision:1}]);
 assert.equal(result.automaticRetry,false);assert.equal(result.status,'blocked');assert.equal(result.document,undefined);
 await assert.rejects(run(config,{missionId:mission,revision:0},host,deps));
 await assert.rejects(run(config,{missionId:'bad',revision:1},host,deps));
});
test('remote financial scope cannot reuse local approval',()=>{
 const now=Date.now(),p={scope:'isolated_local_trial_v1',model:'gpt-5.4-mini-2026-03-17',checkedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+60000).toISOString(),
 ownerApproved:true,autoRechargeOff:true,dedicatedKeyConfigured:true,noNewHosting:true,noTopup:true,providerCutoffInstantaneous:false,maxTrialMicroeur:1000000,projectObservedSpendMicroUsd:0,observedBalanceMicroUsd:2000000,evidenceRef:'fixture',ownerApprovalRef:'fixture',inputMicroUsdPerMillion:750000,outputMicroUsdPerMillion:4500000,eurPerUsdUpperPpm:1100000,grossBps:12500};
 const pricing=require('../intelligence/local-trial-pricing.cjs');
 const remote={...env,INTELLIGENCE_TARIFF_ID:p.model,INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify(p)};
 assert.throws(()=>pricing(remote));
 assert.equal(require('../intelligence/ai-budget-policy.cjs').estimate(pricing({...remote,INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify({...p,scope:'isolated_remote_trial_v1'})})),424875);
});
