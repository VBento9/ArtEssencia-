'use strict';
const {isolatedProjectUrl,isolatedTrialEnvironment,transport,chargeLedger}=require('./worker-transport.cjs');
const providerFactory=require('./responses-provider.cjs');
const createRunner=require('./mission-runner.cjs');
const createGateway=require('./ai-gateway.cjs');
const core=require('./control-core.js');
const budget=require('./ai-budget-policy.cjs');
// Only a reviewed release may add a tariff after validating the account and total infrastructure exposure.
const approvedPricing=require('./approved-pricing.cjs');
function compose({env=process.env,call,provider,tariffs,publicReader}={}){
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
  const injected=!!call;
  call=call||transport(env);provider=provider||providerFactory(env.INTELLIGENCE_OPENAI_API_KEY);
  // An injected transport cannot implicitly contact any public project.
  if(!publicReader&&!injected)publicReader=()=>require('./catalog-crosscheck.cjs').createReader(env)();
  return {call,provider,pricing,publicReader};
}

// The simulation never calls a model endpoint. Positive fictional reservations
// exercise the same ledger; usage is zero. Only a separate disposable project is eligible.
const simulationModel='artessencia-simulation-v1';
function hostedMode(env=process.env){
 const url=require('./worker-transport.cjs').projectUrl(env);
 const production='https://ihtsonqnnlrxvorfrarl.supabase.co';
 if(env.INTELLIGENCE_EXECUTION_MODE==='trial'){
  if(env.INTELLIGENCE_EXECUTION_HOST||!isolatedTrialEnvironment(env))throw Error('Ensaio real isolado indisponível.');
  return 'trial';
 }
 if(env.INTELLIGENCE_EXECUTION_MODE==='simulation'){
  if(env.VERCEL_ENV!=='preview'||url!==isolatedProjectUrl||url!==env.INTELLIGENCE_ISOLATED_PROJECT_URL||
     env.INTELLIGENCE_PAID_RELEASE==='approved'||env.INTELLIGENCE_TRIAL_RELEASE==='approved'||env.OPENAI_API_KEY||env.INTELLIGENCE_OPENAI_API_KEY||env.INTELLIGENCE_FINANCIAL_APPROVAL)throw Error('Simulação isolada indisponível.');
  return 'simulation';
 }
 if(env.VERCEL_ENV!=='production'||url!==production||env.INTELLIGENCE_EXECUTION_MODE&&env.INTELLIGENCE_EXECUTION_MODE!=='paid')throw Error('Ambiente não autorizado.');
 return env.INTELLIGENCE_PAID_RELEASE==='approved'?'paid':'prepare_only';
}
function simulationProvider(payload){
 if(payload.model!==simulationModel||payload.store!==false)throw Error('Pedido de simulação inválido.');
 const user=payload.input[1].content;
 const input=JSON.parse(Array.isArray(user)?user[0].text:user);
 const context=JSON.parse(input.context);
 const evidenceId=context.evidenceIds[0];
 if(!evidenceId)throw Error('Evidência indisponível.');
 // A fixed exercise, not an attempt to infer stock or customer data.
 const director=payload.input[0].content.includes('Coordena departamentos e distribui trabalho.');
 const tasks=[{title:director?'[SIMULAÇÃO] Rever prioridades':'[SIMULAÇÃO] Rever resultado do departamento',priority:2,evidenceId}];
 return {id:'simulation-'+require('node:crypto').randomUUID(),model:simulationModel,status:'completed',usage:{input_tokens:0,output_tokens:0},
  text:JSON.stringify({document:'[SIMULAÇÃO — sem IA externa] Ensaio de consulta, decisão e persistência. As conclusões não são uma avaliação por IA real.',
   tasks,delegations:director?[{agent:'stock',instruction:'[SIMULAÇÃO] Conferir referências de inventário fictício.'}]:[]})};
}
async function composeTrial({env,call}){
 if(!isolatedTrialEnvironment(env))throw Error('Ensaio real isolado indisponível.');
 const mode='trial';
  const pricing=()=>{
   const rate=env.INTELLIGENCE_EXECUTION_HOST==='local'?require('./local-trial-pricing.cjs')(env):approvedPricing(env)[env.INTELLIGENCE_TARIFF_ID];
   if(!rate||rate.model!=='gpt-5.4-mini-2026-03-17'||budget.estimate(rate)>1000000)throw Error('Tarifa de ensaio indisponível.');
   return rate;
  };
  pricing();
  if(await call('trial_identity')!==true)throw Error('Autorização Cloud do ensaio real indisponível.');
  const provider=providerFactory(env.INTELLIGENCE_OPENAI_API_KEY);
  return {mode,pricing,call,provider:async payload=>{
   pricing();
   if(await call('trial_identity')!==true)throw Error('Autorização Cloud do ensaio real retirada.');
   return provider(payload);
  },publicReader:undefined};
}
async function composeLocalTrial({env,call}={}){
 if(env?.INTELLIGENCE_EXECUTION_HOST!=='local'||!isolatedTrialEnvironment(env))throw Error('Executor local isolado indisponível.');
 return composeTrial({env,call:call||transport(env)});
}
async function composeHosted({env=process.env,call,publicReader}={}){
 const mode=hostedMode(env);
 const injected=!!call;
 call=call||transport(env);
 if(mode==='prepare_only')return {mode,call};
 if(!publicReader&&!injected)publicReader=()=>require('./catalog-crosscheck.cjs').createReader(env)();
 if(mode==='paid')return {mode,...compose({env,call,publicReader})};
 if(mode==='trial')return composeTrial({env,call});
 if(await call('simulation_identity')!==true)throw Error('Base de ensaio não autorizada.');
 const checkedCall=async(action,args)=>{
  if(await call('simulation_identity')!==true)throw Error('Autorização de simulação retirada.');
  return call(action,args);
 };
 const rate={model:simulationModel,verified:true,current:true,validUntil:new Date(Date.now()+3600000).toISOString(),toolsEnabled:false,
  contextLimit:400000,maxInputTokens:400000,maxOutputTokens:2000,inputRate:1,outputRate:1,grossBps:10000};
 // Do not set or override the real paid-release environment variable.
 // Only this private, explicitly gated runtime can use the synthetic tariff.
 const pricing=()=>{budget.estimate(rate);return rate;};
 return {mode,call:checkedCall,pricing,provider:simulationProvider,publicReader};
}

function runLegacy(runtime,channel,payload,id){
  if(['simulation','trial'].includes(runtime.mode))throw Error('Assistente legado indisponível em ensaio alojado.');
  const scope={channel,request:id};
  const permitted=async()=>{runtime.pricing();return await runtime.call('permission',scope)===true;};
  const ledger=chargeLedger(runtime.call,scope);
  return require('./legacy-ai.cjs').createLegacyService({...runtime,permitted,ledger})(channel,payload,id);
}
async function processNext(runtime,approvedMission,{scheduled=false}={}){
  if(runtime.mode==='trial'&&(!approvedMission||scheduled))throw Error('Ensaio real apenas por missão manual aprovada.');
  const {call,pricing,provider}=runtime;
  if(approvedMission && await call('identity')!==approvedMission.owner)throw Error('Titular inválido.');
  if(scheduled&&approvedMission)throw Error('Agendamento inválido.');
  const next=approvedMission||await call('next',scheduled?{scheduled:true}:{});
  if(scheduled&&next?.scheduledOnly!==true)throw Error('Política de agendamento indisponível.');
  if(!next?.owner)throw Error('Titular indisponível.');
  if(!next.missionId)return {status:'idle'};
  const owner=next.owner;
  const store={
    async claim(q){
      const r=await call('claim_run',{mission:q.missionId,revision:q.expectedRevision,...(scheduled?{scheduled:true}:{})});
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
      stage:q.stage,diagnostic:q.diagnostic||null,chargedMicroeur:q.chargedMicroeur,receipts:q.receipts}})
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
      if(input.mime&&runtime.mode==='trial')throw Error('Anexos excluídos do ensaio real inicial.');
      if(input.mime)evidence.attachment=require('./stock-input.cjs')(input);
    }
    if(q.agent==='financeiro')evidence.payload=require('./finance-context.cjs')(evidence.payload);
    if(q.agent==='catalogo'){
      let publicData=null;
      try{if(runtime.publicReader)publicData=await runtime.publicReader();}catch{}
      evidence.payload.crosscheck=require('./catalog-crosscheck.cjs').compare(evidence.payload,publicData);
    }
    return evidence;
  }
  const runner=createRunner({core,gateway,store,contextSource,decisionFormat:true,releaseEnabled:true,
    engines:{audit:require('./inventory-audit.js').auditInventory,organizer:require('./stock-organizer.js'),
      operational:require('./operational-agents.js'),business:require('./business-agents.js')},
    executor:{run:async()=>{throw Error('Ação sem autorização.');}}});
  return runner.run({owner,missionId:next.missionId,expectedRevision:next.revision});
}
module.exports={compose,composeHosted,composeLocalTrial,hostedMode,processNext,runLegacy};
