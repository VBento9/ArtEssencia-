'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {environment,run,ownerConsole}=require('../intelligence/local-trial.cjs');
const server=require('../intelligence/server-runtime.cjs');
const {isolatedTrialEnvironment,isolatedProjectUrl}=require('../intelligence/worker-transport.cjs');
const owner='00000000-0000-0000-0000-000000000001',service='00000000-0000-0000-0000-000000000002',mission='00000000-0000-0000-0000-000000000003';
const config={publishableKey:'sb_publishable_fixture',serviceId:service,serviceEmail:'service@example.invalid',servicePassword:'fixture',ownerEmail:'owner@example.invalid',ownerPassword:'fixture',apiKey:'fixture',financialApproval:'{}'};
test('local config is pinned to isolated project and rejected by hosted and paid paths',async()=>{
 const env=environment({...config,VERCEL_ENV:'production',INTELLIGENCE_SUPABASE_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co'});
 assert.equal(env.INTELLIGENCE_SUPABASE_URL,isolatedProjectUrl);assert.equal(isolatedTrialEnvironment(env),true);
 assert.throws(()=>server.hostedMode(env));assert.throws(()=>server.compose({env}));
 await assert.rejects(server.composeLocalTrial({env:{...env,VERCEL_ENV:'preview'}}),/local isolado/);
 await assert.rejects(server.composeLocalTrial({env,call:async()=>true}),/Validação financeira/);
});
test('owner transport stays on isolated URL and uses owner credentials, not service',async()=>{
 const calls=[];const c=await ownerConsole(config,async(url,o)=>{calls.push([url,JSON.parse(o.body),o.headers]);assert.equal(o.redirect,'error');
  return {ok:true,json:async()=>url.includes('/token?')?{user:{id:owner},access_token:'fixture-token'}:true};
 });
 assert.equal(c.owner,owner);assert.equal(calls[0][0],isolatedProjectUrl+'/auth/v1/token?grant_type=password');assert.equal(calls[0][1].email,config.ownerEmail);
 assert.equal(calls[1][2].Authorization,'Bearer fixture-token');
});
function fixture({pending=false,confirm=true,identity=owner}={}){
 const events=[];
 const panel={controls:{enabled:true,revision:16,modes:{director:'manual',stock:'manual'}},routines:[],missions:pending?[{status:'approved'}]:[],
  budget:{monthlyLimitMicroeur:1000000,ledgerReleased:false,ledgerFrozen:false,unknown:0,staleInflight:0,pending:0}};
 const rate={verified:true,current:true,toolsEnabled:false,model:'fixture',maxInputTokens:1000,maxOutputTokens:100,inputRate:750000,outputRate:4500000,grossBps:12300};
 const deps={compose:async()=>({pricing:()=>rate,call:async()=>identity}),connectOwner:async()=>({owner,call:async(action)=>{
  events.push(action);
  if(action==='read')return {...panel,documents:[{mission_id:mission,content:'Resultado fictício'}]};
  if(action==='mission')return {mission_id:mission,status:'pending_review',revision:0};
  if(action==='approve')return {mission_id:mission,status:'approved',revision:1};
 }}),processNext:async(r,m)=>{events.push('execute');assert.deepEqual(m,{owner,missionId:mission,revision:1});return {status:'review_ready',chargedMicroeur:5};},confirm:async()=>confirm,newId:()=>mission};
 return {deps,events};
}
test('local launcher requires explicit confirmation and never creates another mission if pending',async()=>{
 let f=fixture({confirm:false});assert.equal((await run(config,f.deps)).status,'cancelled_before_creation');assert.deepEqual(f.events,['read']);
 f=fixture({pending:true});await assert.rejects(run(config,f.deps),/missões abertas/);assert.deepEqual(f.events,['read']);
 f=fixture({identity:service});await assert.rejects(run(config,f.deps),/Titular do executor/);assert.deepEqual(f.events,[]);
 f=fixture();const result=await run(config,f.deps);assert.equal(result.status,'review_ready');assert.equal(result.chargedMicroeur,5);
 assert.deepEqual(f.events,['read','mission','approve','execute','read']);
});

test('local trial uses independent, expiring conservative tariff without claiming an instant provider cutoff',async()=>{
 const now=new Date(),p={scope:'isolated_local_trial_v1',model:'gpt-5.4-mini-2026-03-17',checkedAt:new Date(now-1000).toISOString(),validUntil:new Date(+now+60000).toISOString(),
  ownerApproved:true,autoRechargeOff:true,dedicatedKeyConfigured:true,noNewHosting:true,noTopup:true,providerCutoffInstantaneous:false,maxTrialMicroeur:1000000,
  projectObservedSpendMicroUsd:0,observedBalanceMicroUsd:2970000,evidenceRef:'fixture',ownerApprovalRef:'fixture',inputMicroUsdPerMillion:750000,outputMicroUsdPerMillion:4500000,
  eurPerUsdUpperPpm:1100000,grossBps:12500};
 const env=environment({...config,financialApproval:JSON.stringify(p)});
 const pricing=require('../intelligence/local-trial-pricing.cjs'),rate=pricing(env,now);
 assert.equal(require('../intelligence/ai-budget-policy.cjs').estimate(rate),424875);
 assert.throws(()=>pricing({...env,INTELLIGENCE_EXECUTION_HOST:''},now),/local/);
 for(const change of [{providerCutoffInstantaneous:true},{maxTrialMicroeur:1000001},{noTopup:false},{autoRechargeOff:false},{validUntil:new Date(now-1).toISOString()},{eurPerUsdUpperPpm:900000}]){
  assert.throws(()=>pricing({...env,INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify({...p,...change})},now),/local/);
 }
 const runtime=await server.composeLocalTrial({env,call:async()=>true});
 assert.equal(runtime.mode,'trial');assert.equal(runtime.pricing().model,p.model);
 assert.throws(()=>server.hostedMode(env));
 assert.throws(()=>require('../intelligence/approved-pricing.cjs')(env));
});
