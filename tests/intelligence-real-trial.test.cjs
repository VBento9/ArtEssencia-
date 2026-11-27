'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const runtime=require('../intelligence/server-runtime.cjs');
const {isolatedProjectUrl,isolatedTrialEnvironment,serviceTransport}=require('../intelligence/worker-transport.cjs');
const now=new Date(),start=new Date(now.getTime()-1000),end=new Date(now.getTime()+60000);
const lisbonMonth=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit'}).formatToParts(d).filter(x=>x.type==='year'||x.type==='month').map(x=>x.value).join('-');
const model='gpt-5.4-mini-2026-03-17';
const approval={model,checkedAt:start.toISOString(),validUntil:end.toISOString(),evidenceRef:'fixture',ownerApprovalRef:'fixture',autoRechargeOff:true,dedicatedKeyVerified:true,usageReconciled:true,infrastructureVerified:true,otherGrossMonthlyUpperMicroeur:0,grossBps:12300,eurPerUsdUpperPpm:1040000,inputMicroUsdPerMillion:750000,outputMicroUsdPerMillion:4500000,budgetMonth:lisbonMonth(now),exclusiveProjectVerified:true,providerHardLimitVerified:true,taxVerified:true,exchangeUpperBoundVerified:true,pendingExternalCostsReconciled:true,providerHardLimitMicroUsd:10000000};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature/intelligence-hybrid-foundation-20261126',INTELLIGENCE_EXECUTION_MODE:'trial',INTELLIGENCE_TRIAL_RELEASE:'approved',INTELLIGENCE_WORKER_AUTH:'service_account',INTELLIGENCE_SUPABASE_URL:isolatedProjectUrl,INTELLIGENCE_ISOLATED_PROJECT_URL:isolatedProjectUrl,INTELLIGENCE_OPENAI_API_KEY:'fixture-never-used',INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify(approval),INTELLIGENCE_TARIFF_ID:model,INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'fixture',INTELLIGENCE_SERVICE_EMAIL:'fixture@example.invalid',INTELLIGENCE_SERVICE_PASSWORD:'fixture',INTELLIGENCE_SERVICE_USER_ID:'00000000-0000-0000-0000-000000000001'};
test('trial cannot target production, another branch, use fallback keys, JWT or production release',()=>{
 assert.equal(runtime.hostedMode(env),'trial');assert.equal(isolatedTrialEnvironment(env),true);
 for(const change of [{VERCEL_ENV:'production'},{VERCEL_GIT_COMMIT_REF:'main'},{INTELLIGENCE_TRIAL_RELEASE:'off'},{INTELLIGENCE_SUPABASE_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co'},{INTELLIGENCE_ISOLATED_PROJECT_URL:'https://abcdefghijklmnopqrst.supabase.co'},{INTELLIGENCE_WORKER_AUTH:'jwt'},{INTELLIGENCE_WORKER_JWT:'fixture'},{INTELLIGENCE_PAID_RELEASE:'approved'},{OPENAI_API_KEY:'fixture'},{INTELLIGENCE_OPENAI_API_KEY:''},{INTELLIGENCE_FINANCIAL_APPROVAL:''}]){
  assert.throws(()=>runtime.hostedMode({...env,...change}));assert.throws(()=>serviceTransport({...env,...change}));
 }
 assert.throws(()=>runtime.compose({env}),/Faturação suspensa/);
});
test('trial requires financial evidence before Cloud identity and refuses revoked trial before provider',async()=>{
 const calls=[];
 await assert.rejects(runtime.composeHosted({env:{...env,INTELLIGENCE_FINANCIAL_APPROVAL:'{}'},call:async()=>{throw Error('unexpected');}}),/Validação financeira/);
 // Use an explicit fixed time window entirely within the current Lisbon month.
 if(lisbonMonth(start)!==lisbonMonth(end))return;
 await assert.rejects(runtime.composeHosted({env,call:async()=>false}),/Autorização Cloud/);
 let allowed=true;
 const pilot=await runtime.composeHosted({env,call:async a=>{calls.push(a);return allowed;}});
 assert.equal(pilot.mode,'trial');assert.equal(pilot.publicReader,undefined);
 await assert.rejects(runtime.processNext(pilot),/missão manual/);
 await assert.rejects(runtime.processNext(pilot,{owner:'fixture'}, {scheduled:true}),/missão manual/);
 assert.throws(()=>runtime.runLegacy(pilot,'legacy_social',{},'fixture'),/indisponível/);
 allowed=false;await assert.rejects(pilot.provider({}),/retirada/);
 assert.deepEqual(calls,['trial_identity','trial_identity']);
});
test('isolated SQL keeps paid production release off and separates lifetime cap from month rollover',()=>{
 const sql=fs.readFileSync('sql/isolated/intelligence_test_real_trial_gate_v1.sql','utf8');
 assert.match(sql,/UNSAFE_REAL_TRIAL_FIXTURE/);assert.match(sql,/expires_at<=approved_at\+interval '24 hours'/);
 assert.match(sql,/monthly_limit_microeur=1000000/);assert.match(sql,/isolated_trial_used\(\)\+p_max>1000000/);
 assert.match(sql,/isolated_trial_used\(\)>1000000/);assert.match(sql,/TRIAL_MANUAL_ONLY/);
 assert.match(sql,/TRIAL_RECEIPT_SCOPE/);assert.doesNotMatch(sql,/SET release_enabled=true|SET enabled=true/);
});
