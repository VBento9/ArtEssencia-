'use strict';
const factory=require('../intelligence/ai-gateway.cjs'),budget=require('../intelligence/ai-budget-policy.cjs');
async function gatewayChecks(factory,budget){
 let n=0;const check=(v,m)=>{if(!v)throw Error(m);n++};const reject=async(f,m)=>{let x=false;try{await f()}catch{x=true}check(x,m)};
 const request={requestId:'00000000-0000-0000-0000-000000000021',missionId:'00000000-0000-0000-0000-000000000022',agent:'stock',instruction:'Organizar materiais',context:'Cera 500 g'};
 let enabled=true,events=[],wrong=false,fail=false,blocked=false,authCount=0,dropAt=0,settleFail=false;
 const rate={verified:true,current:true,toolsEnabled:false,model:'fixture-mini',contextLimit:100000,maxInputTokens:100000,maxOutputTokens:1000,inputRate:1000000,outputRate:4000000,grossBps:12300};
 const opts={budget,authorize:async()=>({verified:true,enabled:enabled&&++authCount!==dropAt,paidEnabled:true}),pricing:async()=>rate,ledger:{
 reserve:async r=>{events.push('reserve');if(blocked)throw Error('budget');return {...r,status:'reserved'}},
 claim:async id=>{events.push('claim');return {requestId:id,status:'inflight',model:rate.model,maximumMicroeur:budget.estimate(rate)}},
 unknown:async()=>{events.push('unknown')},
 settle:async r=>{events.push('settle');if(settleFail)throw Error('settle');return {...r,status:'settled',overrun:false}}
 },provider:async p=>{events.push('provider');check(p.store===false&&!('tools'in p)&&p.max_output_tokens===1000,'restricted');if(fail)throw Error('network');return {id:'fixture-response',model:wrong?'other':rate.model,status:'completed',usage:{input_tokens:500,output_tokens:200},text:'Rever stock.'}}};
 await reject(()=>factory(opts).run(request),'off');check(!events.length,'no paid call');
 const g=factory({...opts,releaseEnabled:true});
 enabled=false;await reject(()=>g.run(request),'disabled');check(!events.length,'no reserve');enabled=true;
 rate.current=false;await reject(()=>g.run(request),'stale');rate.current=true;
 blocked=true;await reject(()=>g.run(request),'budget');check(!events.includes('provider'),'no call');blocked=false;events=[];
 const result=await g.run(request);check(result.status==='review'&&result.executedTools.length===0,'review');check(events.join(',')==='reserve,claim,provider,settle','order');check(result.chargedMicroeur===1599,'cost');
 events=[];fail=true;await reject(()=>g.run(request),'network');check(events.join(',')==='reserve,claim,provider,unknown','held');fail=false;
 events=[];wrong=true;await reject(()=>g.run(request),'wrong model');check(events.at(-1)==='unknown','unknown');wrong=false;
 events=[];authCount=0;dropAt=2;await reject(()=>g.run(request),'disabled before claim');check(events.join(',')==='reserve','no provider');dropAt=0;
 events=[];authCount=0;dropAt=3;check((await g.run(request)).status==='cancelled_after_charge','cancelled');dropAt=0;
 events=[];settleFail=true;await reject(()=>g.run(request),'settlement failure');check(events.filter(x=>x==='provider').length===1,'no retry');
 return n;
}
gatewayChecks(factory,budget).then(n=>console.log('Verificações concluídas:',n)).catch(e=>{console.error(e);process.exitCode=1});
