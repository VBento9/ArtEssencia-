'use strict';
const create=require('../intelligence/mission-runner.cjs');
async function checks(create,core,operational,createGateway,budget,createExecutor){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};
 const reject=async f=>{let x=false;try{await f()}catch{x=true}check(x,'expected rejection')};
 const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 const owner=id(1),missionId=id(2),leaseId=id(3),requestId=id(4),actionId=id(5),draftId=id(6);
 function fixture({disabled=false,wrongContext=false,wrongTask=false,providerFail=false,revoke=false,finishFail=false}={}){
  let claimed=false,active=true,calls=0,records=[],events=[];
  const settings={...core.defaults(),enabled:true,agents:{...core.defaults().agents,financeiro:'manual'}};
  const m={owner,id:missionId,leaseId,requestId,agent:'financeiro',kind:'finance_review',instruction:'Rever margens',controlRevision:1,revision:2,status:'working'};
  const actions=[{actionId,tool:'create_task',taskKey:JSON.stringify(['financeiro','review_margin',wrongTask?'X':'P1'])},{actionId:draftId,tool:'save_draft',type:'relatorio'}];
  const store={
   claim:async q=>{if(claimed||q.owner!==owner||q.missionId!==missionId||q.expectedRevision!==1)throw Error('claim');claimed=true;events.push('claim');return m;},
   verifyLease:async()=>({verified:true,owner,missionId,leaseId,agent:m.agent,kind:m.kind,controlRevision:1,active,settings,actions}),
   finish:async q=>{events.push('finish');if(finishFail)throw Error('finish');return {status:q.status,missionId,leaseId};},
   interrupt:async()=>({status:'blocked',missionId,leaseId})
  };
  const rate={verified:true,current:true,toolsEnabled:false,model:'fixture-mini',contextLimit:100000,maxInputTokens:100000,maxOutputTokens:1000,inputRate:1000000,outputRate:4000000,grossBps:12300};
  const gateway=createGateway({releaseEnabled:true,budget,authorize:async()=>({verified:true,enabled:active,paidEnabled:true}),pricing:async()=>rate,ledger:{
   reserve:async r=>{events.push('reserve');return {...r,status:'reserved'}},
   claim:async id=>({requestId:id,status:'inflight',model:rate.model,maximumMicroeur:budget.estimate(rate)}),
   unknown:async()=>{events.push('unknown')},settle:async r=>({...r,status:'settled',overrun:false})
  },provider:async p=>{calls++;events.push('provider');if(providerFail)throw Error('network');if(revoke)active=false;return {id:'fixture-response',model:rate.model,status:'completed',usage:{input_tokens:500,output_tokens:200},text:'Rever margem. Não foi alterado o preço.'}}});
  const recordStore={insertOnce:async r=>{if(!active)throw Error('off');records.push(r);return {id:r.id||r.record_id,status:'created'}}};
  const executor=createExecutor({releaseEnabled:true,digest:s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h.toString(16).padStart(64,'0')},authorize:async q=>({...q,verified:true,enabled:active,missionActive:true,toolGranted:actions.some(a=>a.actionId===q.actionId&&a.tool===q.tool),serverTime:'2026-11-26T10:00:00Z'}),taskStore:recordStore,draftStore:recordStore});
  const runner=create({releaseEnabled:!disabled,core,engines:{operational},store,gateway,executor,contextSource:async()=>({verified:true,owner:wrongContext?id(99):owner,agent:m.agent,missionId,leaseId,sourceRevision:7,evidenceIds:['cost-P1'],payload:{today:'2026-11-26',targetMarginPct:40,products:[{code:'P1',costComplete:true,totalCost:8,netSalePrice:10}],orders:[]}})});
  return {run:()=>runner.run({owner,missionId,expectedRevision:1}),inspect:()=>({claimed,calls,records,events})};
 }
 let f=fixture({disabled:true});await reject(f.run);check(!f.inspect().claimed,'off before claim');
 f=fixture();const result=await f.run();check(result.status==='review_ready'&&result.receipts.length===2,'complete');
 const s=f.inspect();check(s.calls===1&&s.records.length===2,'one model, two tools');check(s.records[0].entity==='operational_tasks_v1'&&s.records[1].status==='draft_review','real tool format');check(s.events.join(',')==='claim,reserve,provider,finish','order');await reject(f.run);check(f.inspect().calls===1,'no duplicate');
 f=fixture({wrongContext:true});check((await f.run()).stage==='context'&&f.inspect().calls===0,'scope');
 f=fixture({wrongTask:true});check((await f.run()).stage==='tools'&&f.inspect().records.length===0,'task grant bound');
 f=fixture({providerFail:true});check((await f.run()).status==='blocked'&&f.inspect().records.length===0&&f.inspect().events.includes('unknown'),'failure retains');
 f=fixture({revoke:true});check((await f.run()).status==='blocked'&&f.inspect().records.length===0,'revocation');
 f=fixture({finishFail:true});const interrupted=await f.run();check(interrupted.status==='blocked'&&interrupted.receipts.length===2&&!interrupted.automaticRetry,'retain partial receipts');await reject(f.run);
 return n;
}
checks(create,require('../intelligence/control-core.js'),require('../intelligence/operational-agents.js'),require('../intelligence/ai-gateway.cjs'),require('../intelligence/ai-budget-policy.cjs'),require('../intelligence/tool-executor.cjs')).then(n=>console.log('Verificações concluídas:',n)).catch(e=>{console.error(e);process.exitCode=1});
