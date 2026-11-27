'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const training=require('../intelligence/professional-training.cjs'),data=require('../intelligence/professional-training.json');
const core=require('../intelligence/control-core.js'),gateway=require('../intelligence/ai-gateway.cjs'),budget=require('../intelligence/ai-budget-policy.cjs');
test('All nine departments have distinct procedures, an exercise, and a versioned receipt, not certification',()=>{
 assert.deepEqual(Object.keys(data.profiles).sort(),core.agents.slice().sort());
 assert.throws(()=>training.profile('__proto__'));
 const ui=Object.fromEntries(Object.entries(data.profiles).map(([k,p])=>[k,{modules:p.modules,procedures:p.procedures,quality:p.quality,exercise:p.exercise}]));
 assert.ok(fs.readFileSync('intelligence/central-ui.js','utf8').includes('const trainingOverview='+JSON.stringify({version:data.version,profiles:ui})+';'));
 for(const agent of core.agents){
  const p=training.profile(agent),r=training.receipt(agent);
  assert.equal(p.procedures.length,3);assert.ok(p.exercise&&p.quality);
  assert.match(r.digest,/^[a-f0-9]{64}$/);assert.equal(r.certification,'not_assessed');
  assert.ok(training.instructions(agent).includes(p.procedures[0]));
  assert.ok(training.instructions(agent).includes('Biblioteca de Fragrâncias'));
 }
});
test('Gateway loads the specific professional curriculum before the simulated provider call for each agent',async()=>{
 const rate={model:'fixture-training',verified:true,current:true,toolsEnabled:false,contextLimit:1000,maxInputTokens:1000,maxOutputTokens:100,inputRate:1000000,outputRate:1000000,grossBps:10000};
 const id='00000000-0000-0000-0000-000000000001';
 for(const agent of core.agents){
  let called=0;
  const g=gateway({budget,releaseEnabled:true,decisionFormat:true,pricing:async()=>rate,authorize:async()=>({verified:true,enabled:true,paidEnabled:true}),ledger:{
   reserve:async r=>({...r,status:'reserved'}),
   claim:async requestId=>({requestId,status:'inflight',model:rate.model,maximumMicroeur:budget.estimate(rate)}),
   settle:async r=>({...r,status:'settled',overrun:false}),unknown:async()=>{throw Error('unexpected');}
  },provider:async p=>{
   called++;assert.ok(p.input[0].content.includes(training.instructions(agent)));assert.equal(p.input[0].role,'developer');
   assert.equal(p.store,false);assert.deepEqual(p.text.format.schema.properties.tasks.items.properties.evidenceId.enum,['mission-fixture']);assert.equal(p.text.format.schema.properties.delegations.maxItems,agent==='director'?8:0);return {id:'fixture',model:rate.model,status:'completed',usage:{input_tokens:10,output_tokens:10},text:'{}'};
  }});
  assert.equal((await g.run({requestId:id,missionId:id,agent,instruction:'Ensaio fictício',context:JSON.stringify({evidenceIds:['mission-fixture']})})).status,'review');
  assert.equal(called,1);
 }
});
