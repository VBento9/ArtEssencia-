'use strict';
const {transport,chargeLedger}=require('./worker-transport.cjs');
const providerFactory=require('./responses-provider.cjs');
const createRunner=require('./mission-runner.cjs');
const createGateway=require('./ai-gateway.cjs');
const core=require('./control-core.js');
const budget=require('./ai-budget-policy.cjs');
// Only a reviewed release may add a tariff after validating the account and total infrastructure exposure.
const approvedPricing=require('./approved-pricing.cjs');
function compose({env=process.env,call,provider,tariffs}={}){
  // Real provider is unavailable outside the explicitly released production deployment.
  // Tests inject both the transport and provider, never a real API key.
  if(!provider&&(env.VERCEL_ENV!=='production'||env.INTELLIGENCE_SUPABASE_URL!=='https://ihtsonqnnlrxvorfrarl.supabase.co'))throw Error('Faturação suspensa fora da produção autorizada.');
  const rate=(tariffs||approvedPricing(env))[env.INTELLIGENCE_TARIFF_ID];
  function pricing(){
    if(env.INTELLIGENCE_PAID_RELEASE!=='approved'||!rate||rate.verified!==true||
       !Number.isFinite(Date.parse(rate.validUntil))||Date.parse(rate.validUntil)<=Date.now())throw Error('Faturação suspensa.');
    budget.estimate(rate);
    return rate;
  }
  pricing();
  call=call||transport(env);provider=provider||providerFactory(env.OPENAI_API_KEY);
  return {call,provider,pricing};
}
function runLegacy(runtime,channel,payload,id){
  const scope={channel,request:id};
  const permitted=async()=>{runtime.pricing();return await runtime.call('permission',scope)===true;};
  const ledger=chargeLedger(runtime.call,scope);
  return require('./legacy-ai.cjs').createLegacyService({...runtime,permitted,ledger})(channel,payload,id);
}
async function processNext(runtime,approvedMission){
  const {call,pricing,provider}=runtime;
  if(approvedMission && await call('identity')!==approvedMission.owner)throw Error('Titular inválido.');
  const next=approvedMission||await call('next');
  if(!next?.owner)throw Error('Titular indisponível.');
  if(!next.missionId)return {status:'idle'};
  const owner=next.owner;
  const store={
    async claim(q){
      const r=await call('claim_run',{mission:q.missionId,revision:q.expectedRevision});
      if(r.user_id!==owner)throw Error('Titular inválido.');
      return {id:r.mission_id,owner,kind:r.kind,agent:r.agent,instruction:r.instruction,revision:r.revision,status:r.status,
        controlRevision:r.control_revision,leaseId:r.lease_id,requestId:r.request_id};
    },
    async verifyLease(m){
      const r=await call('status',{mission:m.id});
      return {verified:r.requestId===m.requestId,owner:r.owner,agent:r.agent,kind:r.kind,missionId:r.missionId,
        controlRevision:r.controlRevision,leaseId:r.leaseId,active:r.active,settings:r.settings,memory:r.memory,actions:[]};
    },
    finish:q=>call('finish',{mission:q.mission.id,lease:q.mission.leaseId,status:'review_ready',outcome:{
      summary:q.summary,report:q.report,reasoning:q.reasoning,chargedMicroeur:q.chargedMicroeur,receipts:q.receipts,delegations:q.delegations||[]}}),
    interrupt:q=>call('finish',{mission:q.mission.id,lease:q.mission.leaseId,status:'blocked',outcome:{
      stage:q.stage,chargedMicroeur:q.chargedMicroeur,receipts:q.receipts}})
  };
  const gateway={run(request){
    const scope={channel:request.agent,mission:request.missionId,request:request.requestId};
    return createGateway({budget,pricing,provider,decisionFormat:true,releaseEnabled:true,ledger:chargeLedger(call,scope),
      authorize:async()=>({verified:true,enabled:await call('permission',scope)===true,paidEnabled:!!pricing()})}).run(request);
  }};
  async function contextSource(q){
    const action=q.agent==='director'?'director':['inventory_audit','stock_organization_plan'].includes(q.kind)?'stock':'department';
    const evidence=await call(action,{mission:q.missionId,lease:q.leaseId});
    if(evidence.agent!==q.agent||evidence.kind!==q.kind)throw Error('Âmbito inválido.');
    if(q.agent==='stock'){
      const input=await call('input',{mission:q.missionId,lease:q.leaseId});
      if(input.mime)evidence.attachment=require('./stock-input.cjs')(input);
    }
    if(q.agent==='financeiro')evidence.payload=require('./finance-context.cjs')(evidence.payload);
    return evidence;
  }
  const runner=createRunner({core,gateway,store,contextSource,decisionFormat:true,releaseEnabled:true,
    engines:{audit:require('./inventory-audit.js').auditInventory,organizer:require('./stock-organizer.js'),
      operational:require('./operational-agents.js'),business:require('./business-agents.js')},
    executor:{run:async()=>{throw Error('Ação sem autorização.');}}});
  return runner.run({owner,missionId:next.missionId,expectedRevision:next.revision});
}
module.exports={compose,processNext,runLegacy};
