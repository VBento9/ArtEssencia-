'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../intelligence/hosted-background.cjs');
const mission={owner:'owner',missionId:'mission',revision:7};
test('acknowledges a persistent claim before completion and continues after caller disconnects',async()=>{
 let finish,completed=false;
 const worker={processNext:async(runtime,m,{onClaim})=>{
  assert.equal(m,mission);onClaim({missionId:'mission',revision:8,status:'working'});
  await new Promise(resolve=>{finish=resolve;});completed=true;return {status:'review_ready'};
 }};
 const job=start(worker,{},mission);await job.accepted;assert.equal(completed,false);
 // No browser signal is passed to the worker. Closing the caller does not cancel it.
 finish();await job.completion;assert.equal(completed,true);
});
test('rejects duplicate or failed claims and never advertises acceptance before persistence',async()=>{
 for(const worker of [
  {processNext:async()=>{throw Error('revision conflict');}},
  {processNext:async()=>({status:'idle'})},
  {processNext:async(r,m,{onClaim})=>onClaim({missionId:'other',revision:8,status:'working'})},
  {processNext:async(r,m,{onClaim})=>onClaim({missionId:'mission',revision:7,status:'working'})}
 ]){
  const job=start(worker,{},mission);await assert.rejects(job.accepted);await job.completion;
 }
});
test('post-claim interruption never retries the model or the claim',async()=>{
 let calls=0;
 const job=start({processNext:async(r,m,{onClaim})=>{
  calls++;onClaim({missionId:'mission',revision:8,status:'working'});throw Error('lost response');
 }},{},mission);
 await job.accepted;await job.completion;assert.equal(calls,1);
});
