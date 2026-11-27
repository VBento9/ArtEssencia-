'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const decisions=require('../intelligence/mission-decisions.cjs'),createGateway=require('../intelligence/ai-gateway.cjs'),budget=require('../intelligence/ai-budget-policy.cjs');
test('schema constrains evidence and department delegation before model generation',()=>{
 const s=decisions.schemaFor('auditoria',['mission-a','task-b','mission-a']);
 assert.deepEqual(s.properties.tasks.items.properties.evidenceId.enum,['mission-a','task-b']);
 assert.equal(s.properties.tasks.maxItems,6);assert.equal(s.properties.delegations.maxItems,0);
 assert.equal(decisions.schemaFor('director',['mission-a']).properties.delegations.maxItems,8);
 assert.equal(decisions.schemaFor('auditoria',[]).properties.tasks.maxItems,0);
 const ctx={agent:'auditoria',evidenceIds:['mission-a']};
 const valid={document:'Relatório',tasks:[{title:'Verificar tarefa',evidenceId:'mission-a',priority:1}],delegations:[]};
 assert.deepEqual(decisions.parse(JSON.stringify(valid),ctx),valid);
 for(const [data,code] of [
  [{...valid,tasks:[{title:'Verificar',evidenceId:'inventada',priority:1}]},'decision_task'],
  [{...valid,delegations:[{agent:'stock',instruction:'Verificar'}]},'decision_delegation'],
  [{...valid,document:''},'decision_shape']
 ])assert.throws(()=>decisions.parse(JSON.stringify(data),ctx),e=>e.decisionCode===code);
 assert.throws(()=>decisions.parse('{',ctx),e=>e.decisionCode==='decision_json');
});
test('provider incomplete after accounted settlement has a bounded diagnostic and no retry',async()=>{
 const id='00000000-0000-0000-0000-000000000001',rate={model:'fixture',verified:true,current:true,toolsEnabled:false,contextLimit:400000,maxInputTokens:400000,maxOutputTokens:2000,inputRate:825000,outputRate:4950000,grossBps:12500};
 let calls=0,settlements=0;
 const g=createGateway({budget,releaseEnabled:true,decisionFormat:true,pricing:()=>rate,authorize:async()=>({verified:true,enabled:true,paidEnabled:true}),
 ledger:{reserve:async r=>({...r,status:'reserved'}),claim:async requestId=>({requestId,status:'inflight',model:rate.model,maximumMicroeur:budget.estimate(rate)}),unknown:async()=>{throw Error('unexpected');},settle:async r=>{settlements++;return {...r,status:'settled',overrun:false};}},
 provider:async payload=>{calls++;assert.equal(payload.text.format.schema.properties.delegations.maxItems,0);return {id:'fixture-receipt',model:rate.model,status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:100,output_tokens:2000},text:''};}});
 const result=await g.run({requestId:id,missionId:id,agent:'auditoria',instruction:'Auditar',context:JSON.stringify({evidenceIds:['mission-a']})});
 assert.equal(result.diagnostic,'provider_output_limit');assert.equal(result.status,'incomplete');assert.equal(calls,1);assert.equal(settlements,1);assert.ok(result.chargedMicroeur>0);
});
