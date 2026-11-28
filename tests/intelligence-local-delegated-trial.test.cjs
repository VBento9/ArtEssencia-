'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {run,verifiedPanel}=require('../intelligence/local-delegated-trial.cjs');
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const config={publishableKey:'sb_publishable_fixture',serviceId:id(9),serviceEmail:'service@example.invalid',servicePassword:'fixture',apiKey:'fixture',financialApproval:'{}'};
const parent=id(1),owner=id(2),agents=['auditoria','comercial','marketing'];
function fixture(){
 const panel={controls:{enabled:true,modes:{director:'manual',auditoria:'manual',comercial:'manual',marketing:'manual'}},routines:[],
  budget:{monthlyLimitMicroeur:1000000,ledgerReleased:false,ledgerFrozen:false,unknown:0,staleInflight:0,pending:0,settled:7282},
  missions:[{mission_id:parent,agent:'director',status:'review_ready'},...agents.map((agent,i)=>({mission_id:id(i+3),parent_id:parent,agent,status:'pending_review',revision:0,instruction:'Fictícia'}))],documents:[]};
 const rate={model:'fixture',verified:true,current:true,toolsEnabled:false,maxInputTokens:400000,maxOutputTokens:2000,inputRate:825000,outputRate:4950000,grossBps:12500};
 const calls=[];
 const deps={compose:async()=>({pricing:()=>rate,call:async a=>a==='identity'?owner:true}),connectOwner:async()=>({owner,call:async(a,args)=>{
  if(a==='read')return structuredClone(panel);
  assert.equal(a,'approve');calls.push('approve:'+args.id);
  const m=panel.missions.find(m=>m.mission_id===args.id);m.status='approved';m.revision++;return structuredClone(m);
 }}),confirm:async()=>true,processNext:async(rt,args)=>{
  calls.push('execute:'+args.missionId);const m=panel.missions.find(m=>m.mission_id===args.missionId);assert.equal(m.status,'approved');
  m.status='review_ready';m.revision=3;panel.budget.settled+=10000;panel.documents.push({mission_id:m.mission_id,content:'Resultado fictício'});
  return {status:'review_ready',chargedMicroeur:10000};
 }};
 return {panel,deps,calls};
}
test('each existing delegation requires individual owner confirmation; no mission creation or automatic retry',async()=>{
 const f=fixture();let n=0;f.deps.confirm=async()=>++n<=1;
 const a=await run(config,parent,f.deps);
 assert.equal(a.status,'stopped_by_owner');assert.equal(a.results.length,1);assert.deepEqual(f.calls,['approve:'+id(3),'execute:'+id(3)]);
 f.deps.confirm=async()=>true;const b=await run(config,parent,f.deps);
 assert.equal(b.results.length,2);assert.deepEqual(b.results.map(x=>x.agent),['comercial','marketing']);
 assert.equal(f.calls.length,6);
});
test('reject unrelated pending, revoked manual mode, unsafe ledger or uncertain previous execution',async()=>{
 for(const mutate of [
  p=>p.missions.push({mission_id:id(8),status:'pending_review'}),
  p=>p.controls.modes.auditoria='auto',
  p=>p.budget.pending=1,
  p=>p.missions[1].status='approved',
  p=>p.budget.settled=600000
 ]){
  const f=fixture();mutate(f.panel);await assert.rejects(run(config,parent,f.deps));assert.deepEqual(f.calls,[]);
 }
});
test('stops on first uncertain result without executing next department',async()=>{
 const f=fixture();f.deps.processNext=async()=>({status:'recovery_required',stage:'reasoning'});
 const r=await run(config,parent,f.deps);assert.equal(r.status,'stopped_for_reconciliation');assert.equal(r.automaticRetry,false);assert.deepEqual(f.calls,['approve:'+id(3)]);
});

test('preserves reconciled blocked delegation without replay and executes remaining pending missions',async()=>{
 const f=fixture();f.panel.missions[1].status='blocked';f.panel.missions[1].revision=3;
 const result=await run(config,parent,f.deps);
 assert.equal(result.status,'completed_remaining');assert.deepEqual(result.blocked,[id(3)]);
 assert.deepEqual(result.results.map(x=>x.agent),['comercial','marketing']);assert.deepEqual(f.calls,['approve:'+id(4),'execute:'+id(4),'approve:'+id(5),'execute:'+id(5)]);
});
