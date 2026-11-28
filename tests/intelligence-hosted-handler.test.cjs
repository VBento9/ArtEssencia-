'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const background=require('../intelligence/hosted-background.cjs');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const source=fs.readFileSync('api/intelligence-worker.js','utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','return async function handler');
async function fixture({owner='owner',claim=true}={}){
 const jobs=[],events=[],missionId='00000000-0000-0000-0000-000000000001';let finish;
 const worker={hostedMode:()=> 'paid',composeHosted:async()=>({}),processNext:async(r,m,{onClaim})=>{
  events.push('process');if(!claim)throw Error('duplicate');
  onClaim({missionId:m.missionId,revision:m.revision+1,status:'working'});events.push('claimed');
  await new Promise(resolve=>{finish=resolve;});events.push('persisted');return {status:'review_ready'};
 }};
 const handler=await new AsyncFunction('waitUntil','background','scheduledWorker','worker','workerTransport','readiness','process',source)(p=>jobs.push(p),background,{},worker,{ownerSession:async()=>owner},{},{env:{INTELLIGENCE_WORKER_ENABLED:'true'}});
 const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};
 return {run:body=>handler({method:'POST',body:body||{missionId,revision:7}},res),jobs,events,res,missionId,finish:()=>finish()};
}
test('HTTP accepts after durable claim, attaches completion to platform, and does not await model result',async()=>{
 const f=await fixture();await f.run();assert.equal(f.res.code,202);assert.equal(f.res.body.status,'accepted');
 assert.deepEqual(f.events,['process','claimed']);assert.equal(f.jobs.length,1);
 f.finish();await Promise.all(f.jobs);assert.deepEqual(f.events,['process','claimed','persisted']);
});
test('HTTP rejects unauthorized owner, malformed revision, and duplicate claims without acceptance',async()=>{
 let f=await fixture({owner:null});await f.run();assert.equal(f.res.code,403);assert.equal(f.jobs.length,0);
 f=await fixture();await f.run({missionId:f.missionId,revision:-1});assert.equal(f.res.code,400);assert.equal(f.jobs.length,0);
 f=await fixture({claim:false});await f.run();assert.equal(f.res.code,503);await Promise.all(f.jobs);assert.deepEqual(f.events,['process']);
});
