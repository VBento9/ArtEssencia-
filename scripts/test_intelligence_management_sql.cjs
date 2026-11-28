'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {fixture}=require('./test_intelligence_meetings_sql.cjs');
const ns='artessencia_intelligence_private',owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function run(){
 const {db,login}=await fixture({postgres:process.argv.includes('--postgres')});
 const rpc=async(action,args={})=>(await db.query('SELECT public.artessencia_intelligence_management_v1($1,$2) data',[action,JSON.stringify(args)])).rows[0].data;
 try{
  await db.exec('RESET ROLE');await db.exec(fs.readFileSync('sql/intelligence-professional-start-v1.sql','utf8'));await db.exec(fs.readFileSync('sql/intelligence-management-v1.sql','utf8'));
  await db.query(`UPDATE ${ns}.team_controls SET enabled=true,modes=jsonb_set(jsonb_set(modes,'{stock}','"semi"'),'{director}','"semi"') WHERE user_id=$1`,[owner]);
  const revision=Number((await db.query(`SELECT revision FROM ${ns}.team_controls WHERE user_id=$1`,[owner])).rows[0].revision);
  const mission=id(91);
  await db.query(`INSERT INTO ${ns}.team_missions(user_id,mission_id,agent,kind,instruction,revision,control_revision,status) VALUES($1,$2,'stock','inventory_audit','Relatório sintético',3,$3,'review_ready')`,[owner,mission,revision]);
  const task=(key,title,priority,kind=null)=>({agent:'stock',key,title,priority,kind,dueDate:null,requiresApproval:true});
  const tasks=[task('original','Verificar cera',1,'review_cost'),task('duplicate',' verificar   CERA ',1),task('distinct','Rever ficha',2)];
  await db.query(`INSERT INTO ${ns}.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status,outcome,ended_at) VALUES($1,$2,$3,$4,2,'review_ready',$5,now())`,[owner,mission,id(92),id(93),JSON.stringify({report:{mode:'read-only',tasks},receipts:[]})]);
  const budget=(await db.query(`SELECT * FROM ${ns}.ai_budget_control`)).rows;
  await login(other);await assert.rejects(rpc('read'),/OWNER_REQUIRED/);await login();
  const first=await rpc('read');assert.equal(first.total,3);assert.equal(first.groups,2);assert.equal(first.sameTitleExtra,1);assert.equal(first.candidates[0].key,'original');
  const items=first.candidates.map(x=>({missionId:x.missionId,key:x.key}));
  await assert.rejects(rpc('plan',{revision,confirmed:false,items}),/MANAGEMENT_APPROVAL_REQUIRED/);
  await assert.rejects(rpc('plan',{revision:revision+1,confirmed:true,items}),/TEAM_REVISION_CONFLICT/);
  await assert.rejects(rpc('plan',{revision,confirmed:true,items:[items[0],{missionId:mission,key:'duplicate'}]}),/MANAGEMENT_SELECTION_STALE/);
  assert.equal((await rpc('read')).eligible,2);
  const receipt=await rpc('plan',{revision,confirmed:true,items});assert.equal(receipt.receipts.length,2);assert.equal(receipt.paid,false);
  const after=await rpc('read');assert.equal(after.eligible,0);assert.equal(after.alreadyInPlanning,2);
  await assert.rejects(rpc('plan',{revision,confirmed:true,items}),/MANAGEMENT_SELECTION_STALE/);
  await db.exec('RESET ROLE');assert.deepEqual((await db.query(`SELECT * FROM ${ns}.ai_budget_control`)).rows,budget);
  assert.equal(Number((await db.query("SELECT count(*) n FROM public.artessencia_cloud_records WHERE entity='operational_tasks_v1'")).rows[0].n),2);
  assert.deepEqual((await db.query(`SELECT outcome->'report'->'tasks' tasks FROM ${ns}.team_runs WHERE mission_id=$1`,[mission])).rows[0].tasks,tasks);
  console.log('PASS: owner scope, grouping, atomic approval, stale replay blocked, original report and budget preserved');
 }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
