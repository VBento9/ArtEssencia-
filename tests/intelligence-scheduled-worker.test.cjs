'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {handle}=require('../intelligence/scheduled-worker.cjs');
const server=require('../intelligence/server-runtime.cjs');
const secret='fixture-secret-abcdefghijklmnopqrstuvwxyz';
function fixture({mode='simulation',outcomes=['review_ready','idle'],tickDelay=0,fail=false,enabled=true}={}){
 const events=[];let stamp=0;
 const runtime={mode,call:async action=>{events.push(action);stamp+=tickDelay;if(fail)throw Error('fixture');return {prepared:1,recovered:0};}};
 const worker={composeHosted:async()=>{events.push('compose');return runtime;},processNext:async(r,explicit,options)=>{
  assert.equal(r,runtime);assert.equal(explicit,undefined);assert.deepEqual(options,{scheduled:true});
  events.push('next');return {status:outcomes.shift()||'review_ready'};
 }};
 const env={CRON_SECRET:secret,INTELLIGENCE_WORKER_ENABLED:String(enabled)};
 async function run(authorization='Bearer '+secret){
  const res={status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};
  return handle({headers:{authorization}},res,{worker,env,now:()=>stamp});
 }
 return {events,run};
}
test('scheduler rejects invalid credentials and disabled executor before any runtime activity',async()=>{
 let f=fixture();assert.equal((await f.run('Bearer wrong')).code,401);assert.deepEqual(f.events,[]);
 f=fixture({enabled:false});assert.equal((await f.run()).code,503);assert.deepEqual(f.events,[]);
});
test('prepare-only scheduler never claims or calls model work',async()=>{
 const f=fixture({mode:'prepare_only'});const r=await f.run();
 assert.equal(r.code,200);assert.equal(r.body.paid,false);assert.deepEqual(f.events,['compose','tick']);
});
test('scheduler ticks then uses scoped processing and stops on idle, blocked, or nine completions',async()=>{
 let f=fixture();let r=await f.run();assert.equal(r.body.completed,1);assert.equal(r.body.status,'idle');
 assert.deepEqual(f.events,['compose','tick','next','next']);
 f=fixture({outcomes:['blocked']});r=await f.run();assert.equal(r.body.completed,0);assert.equal(r.body.status,'blocked');
 f=fixture({outcomes:[]});r=await f.run();assert.equal(r.body.completed,9);assert.equal(f.events.filter(e=>e==='next').length,9);
});
test('scheduler does not start a new job after its soft deadline or a failed tick',async()=>{
 let f=fixture({tickDelay:45000});let r=await f.run();assert.equal(r.body.completed,0);assert.deepEqual(f.events,['compose','tick']);
 f=fixture({fail:true});r=await f.run();assert.equal(r.code,503);assert.deepEqual(f.events,['compose','tick']);
});
test('scheduled runtime rejects old SQL without explicit scoped queue confirmation',async()=>{
 const calls=[];await assert.rejects(server.processNext({call:async(action,args)=>{calls.push([action,args]);return {owner:'fixture',missionId:null};}},undefined,{scheduled:true}),/Política de agendamento/);
 assert.deepEqual(calls,[['next',{scheduled:true}]]);
 assert.deepEqual(await server.processNext({call:async()=>({owner:'fixture',missionId:null,scheduledOnly:true})},undefined,{scheduled:true}),{status:'idle'});
});
