'use strict';
// No server, scheduler, production access, persistent credentials or external dependencies.
const {randomUUID}=require('node:crypto');
const {isolatedProjectUrl}=require('./worker-transport.cjs');
const server=require('./server-runtime.cjs');
const budget=require('./ai-budget-policy.cjs');
const model='gpt-5.4-mini-2026-03-17';
const missionInstruction='[ENSAIO IA REAL — dados fictícios] Revê as prioridades da ArtEssencia de teste. Identifica bloqueios, usa as memórias profissionais disponíveis e propõe até três tarefas prioritárias justificadas por evidências. Se necessário, propõe delegações, com objetivo, prazo e critério de conclusão. Não alteres stock, preços, catálogo ou contactos. Não inventes factos.';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function environment(config){
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||'')||!uuid(config.serviceId)||
  typeof config.serviceEmail!=='string'||!config.serviceEmail||!config.servicePassword||!config.apiKey||!config.financialApproval)throw Error('Configuração local incompleta.');
 // Only the isolated constants and explicitly supplied values enter the runtime.
 return {INTELLIGENCE_EXECUTION_HOST:'local',INTELLIGENCE_EXECUTION_MODE:'trial',INTELLIGENCE_TRIAL_RELEASE:'approved',INTELLIGENCE_WORKER_AUTH:'service_account',
  INTELLIGENCE_SUPABASE_URL:isolatedProjectUrl,INTELLIGENCE_ISOLATED_PROJECT_URL:isolatedProjectUrl,INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:config.publishableKey,
  INTELLIGENCE_SERVICE_USER_ID:config.serviceId,INTELLIGENCE_SERVICE_EMAIL:config.serviceEmail,INTELLIGENCE_SERVICE_PASSWORD:config.servicePassword,
  INTELLIGENCE_OPENAI_API_KEY:config.apiKey,INTELLIGENCE_FINANCIAL_APPROVAL:config.financialApproval,INTELLIGENCE_TARIFF_ID:model};
}
async function ownerConsole(config,request=fetch){
 const base=isolatedProjectUrl,headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 async function json(path,body,token){
  const response=await request(base+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  if(!response.ok)throw Error('Operação do titular por confirmar. Não repetir automaticamente.');
  return response.json();
 }
 const session=await json('/auth/v1/token?grant_type=password',{email:config.ownerEmail,password:config.ownerPassword});
 const owner=session.user?.id,token=session.access_token;
 if(!uuid(owner)||owner===config.serviceId||typeof token!=='string'||!token||await json('/rest/v1/rpc/artessencia_is_owner_v1',{},token)!==true)throw Error('Titular de ensaio não autorizado.');
 return {owner,call:(action,args={})=>json('/rest/v1/rpc/artessencia_intelligence_console_v1',{p_action:action,p_args:args},token)};
}
async function run(config,{compose=server.composeLocalTrial,processNext=server.processNext,connectOwner=ownerConsole,confirm=async()=>false,write=()=>{},newId=randomUUID}={}){
 const env=environment(config);
 // Both pricing and database authorization must pass before creating a mission.
 const runtime=await compose({env});
 const maximum=budget.estimate(runtime.pricing());
 if(maximum>1000000)throw Error('Reserva superior ao orçamento autorizado.');
 const console=await connectOwner(config);
 if(await runtime.call('identity')!==console.owner)throw Error('Titular do executor diferente do titular autenticado.');
 const panel=await console.call('read');
 if(panel.controls?.enabled!==true||panel.controls?.modes?.director!=='manual'||
  !Object.values(panel.controls.modes).every(x=>['manual','off'].includes(x))||!Array.isArray(panel.routines)||panel.routines.some(x=>x.enabled)||
  panel.budget?.monthlyLimitMicroeur!==1000000||panel.budget?.ledgerReleased!==false||panel.budget?.ledgerFrozen!==false||
  Number(panel.budget.unknown)!==0||Number(panel.budget.staleInflight)!==0||Number(panel.budget.pending)!==0)throw Error('Estado do ensaio não seguro.');
 if(!Array.isArray(panel.missions)||panel.missions.some(m=>['working','approved','pending_review'].includes(m.status)))throw Error('Existem missões abertas. Rever antes de criar outra.');
 write('Missão: Leonor — '+missionInstruction+'\nReserva conservadora máxima: '+(maximum/1000000).toFixed(6)+' EUR. Limite acumulado da Cloud: 1 EUR.');
 if(!await confirm())return {status:'cancelled_before_creation'};
 const missionId=newId();
 if(!uuid(missionId))throw Error('Identificador inválido.');
 write('Identificador da missão: '+missionId);
 const created=await console.call('mission',{id:missionId,revision:panel.controls.revision,agent:'director',kind:'daily_priority_plan',instruction:missionInstruction});
 if(created.mission_id!==missionId||created.status!=='pending_review'||Number(created.revision)!==0)throw Error('Criação por confirmar. Não repetir.');
 const approved=await console.call('approve',{id:missionId,revision:0});
 if(approved.mission_id!==missionId||approved.status!=='approved'||Number(approved.revision)!==1)throw Error('Aprovação por confirmar. Não repetir.');
 const result=await processNext(runtime,{owner:console.owner,missionId,revision:1});
 if(result.status!=='review_ready')return {status:result.status,missionId,automaticRetry:false};
 const snapshot=await console.call('read');
 const doc=snapshot.documents?.find(d=>d.mission_id===missionId);
 if(!doc||typeof doc.content!=='string')throw Error('Conclusão Cloud por confirmar. Não repetir.');
 return {status:'review_ready',missionId,chargedMicroeur:result.chargedMicroeur,document:doc.content};
}
module.exports={environment,ownerConsole,run,missionInstruction};
