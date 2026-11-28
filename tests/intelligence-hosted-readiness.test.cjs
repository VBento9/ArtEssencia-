'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {availability}=require('../intelligence/hosted-readiness.cjs');
const worker=require('../intelligence/server-runtime.cjs');
const now=new Date('2026-11-27T12:00:00Z'),model='gpt-5.4-mini-2026-03-17';
const approval={model,checkedAt:'2026-11-27T11:00:00Z',validUntil:'2026-11-27T13:00:00Z',budgetMonth:'2026-11',autoRechargeOff:true,dedicatedKeyVerified:true,usageReconciled:true,infrastructureVerified:true,otherGrossMonthlyUpperMicroeur:0,grossBps:12500,eurPerUsdUpperPpm:1100000,inputMicroUsdPerMillion:750000,outputMicroUsdPerMillion:4500000,evidenceRef:'fixture',ownerApprovalRef:'fixture',exclusiveProjectVerified:true,providerHardLimitVerified:true,taxVerified:true,exchangeUpperBoundVerified:true,pendingExternalCostsReconciled:true,providerHardLimitMicroUsd:10000000};
const claims=Buffer.from(JSON.stringify({role:'artessencia_intelligence_worker',sub:'fixture',exp:Math.floor(now.getTime()/1000)+3600})).toString('base64url');
const env={VERCEL_ENV:'production',INTELLIGENCE_SUPABASE_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co',INTELLIGENCE_WORKER_ENABLED:'true',INTELLIGENCE_PAID_RELEASE:'approved',INTELLIGENCE_OPENAI_API_KEY:'fixture',INTELLIGENCE_WORKER_JWT:'fixture.'+claims+'.fixture',INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'fixture',INTELLIGENCE_TARIFF_ID:model,INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify(approval)};
test('hosted readiness exposes only configured status and bounded maximum, not evidence or secrets',()=>{
 assert.deepEqual(availability(env,worker,now),{status:'configured',mode:'paid',maximumMicroeur:424875});
});
test('hosted readiness fails closed for disabled, wrong project, unavailable credentials or incomplete financial evidence',()=>{
 assert.deepEqual(availability({...env,INTELLIGENCE_WORKER_ENABLED:'false'},worker,now),{status:'disabled'});
 for(const change of [{VERCEL_ENV:'preview'},{INTELLIGENCE_SUPABASE_URL:'https://thqhyetvxledlgjdtmzp.supabase.co'},{INTELLIGENCE_PAID_RELEASE:'off'},{INTELLIGENCE_FINANCIAL_APPROVAL:'{}'},{INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify({...approval,providerHardLimitVerified:false})},{INTELLIGENCE_OPENAI_API_KEY:''},{INTELLIGENCE_WORKER_JWT:''},{INTELLIGENCE_WORKER_JWT:'invalid'},{INTELLIGENCE_WORKER_AUTH:'service_account'}]){
  assert.deepEqual(availability({...env,...change},worker,now),{status:'unavailable'});
 }
});
test('production service credentials require explicit release and retain financial evidence gate',()=>{
 const service={...env,INTELLIGENCE_WORKER_AUTH:'service_account',INTELLIGENCE_WORKER_JWT:'',INTELLIGENCE_SERVICE_RELEASE:'approved',INTELLIGENCE_SERVICE_EMAIL:'fixture@example.invalid',INTELLIGENCE_SERVICE_PASSWORD:'fixture',INTELLIGENCE_SERVICE_USER_ID:'00000000-0000-0000-0000-000000000002'};
 assert.equal(availability(service,worker,now).status,'configured');
 for(const patch of [{INTELLIGENCE_SERVICE_RELEASE:''},{VERCEL_ENV:'preview'},{INTELLIGENCE_SERVICE_PASSWORD:''},{INTELLIGENCE_WORKER_JWT:'conflicting'},{INTELLIGENCE_FINANCIAL_APPROVAL:'{}'}])assert.equal(availability({...service,...patch},worker,now).status,'unavailable');
});
test('availability verifies live Cloud binding and exact owner before advertising execution',async()=>{
 const {checkedAvailability}=require('../intelligence/hosted-readiness.cjs');
 let calls=0;const transport=()=>async action=>{calls++;assert.equal(action,'identity');return 'owner';};
 assert.equal((await checkedAvailability(env,worker,transport,'owner',now)).status,'configured');
 assert.equal((await checkedAvailability(env,worker,transport,'other',now)).status,'unavailable');
 assert.equal((await checkedAvailability(env,worker,()=>async()=>{throw Error('revoked');},'owner',now)).status,'unavailable');
 await checkedAvailability({...env,INTELLIGENCE_PAID_RELEASE:'off'},worker,transport,'owner',now);assert.equal(calls,2);
});

test('monthly target policy retains hard provider limit and uses contingency only for verified external ceiling',()=>{
 const pricing=require('../intelligence/approved-pricing.cjs');
 const flexible={...approval,budgetPolicy:'monthly_target_v1',targetGrossMonthlyMicroeur:30000000,contingencyGrossMicroeur:5000000,ownerAcceptsNonInstantCutoff:true,otherGrossMonthlyUpperMicroeur:7000000,providerHardLimitMicroUsd:20000000};
 const read=p=>pricing({...env,INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify(p)},now);
 assert.ok(read(flexible)[model]); // gross provider cap 27.5 EUR; total 34.5 EUR
 assert.throws(()=>read({...flexible,budgetPolicy:undefined}));
 for(const patch of [{providerHardLimitVerified:false},{ownerAcceptsNonInstantCutoff:false},{contingencyGrossMicroeur:5000001},{targetGrossMonthlyMicroeur:35000000},{providerHardLimitMicroUsd:21000000},{otherGrossMonthlyUpperMicroeur:7000001},{autoRechargeOff:false},{usageReconciled:false},{budgetPolicy:'unreviewed'}])assert.throws(()=>read({...flexible,...patch}));
 assert.equal(require('../intelligence/ai-budget-policy.cjs').stop,23000000);
});
