'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {fixture}=require('./test_intelligence_meetings_sql.cjs');
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const ns='artessencia_intelligence_private';
async function run(){
 const {db,login}=await fixture({postgres:process.argv.includes('--postgres')});
 const rpc=async(a,args={})=>(await db.query('SELECT public.artessencia_intelligence_console_v1($1,$2) data',[a,JSON.stringify(args)])).rows[0].data;
 try{
  await db.exec('RESET ROLE');
  await db.exec(fs.readFileSync('sql/intelligence-professional-continuity-v1.sql','utf8'));
  const revision=Number((await db.query(`SELECT revision FROM ${ns}.team_controls WHERE user_id=$1`,[owner])).rows[0].revision);
  const snapshot=async()=>({
    budget:(await db.query(`SELECT * FROM ${ns}.ai_budget_control`)).rows,
    entries:(await db.query(`SELECT count(*) n FROM ${ns}.ai_budget_entries`)).rows,
    missions:(await db.query(`SELECT count(*) n FROM ${ns}.team_missions`)).rows
  });
  const before=await snapshot();
  await login(other);await assert.rejects(rpc('prepare_team_routines',{revision,confirmed:true}),/OWNER_REQUIRED/);
  await login();await assert.rejects(rpc('prepare_team_routines',{revision,confirmed:false}),/ROUTINE_PREPARATION_APPROVAL_REQUIRED/);
  await assert.rejects(rpc('prepare_team_routines',{revision:revision+1,confirmed:true}),/TEAM_REVISION_CONFLICT/);
  await db.exec('RESET ROLE');
  await db.query(`INSERT INTO ${ns}.team_routines(user_id,agent,cadence,kind,instruction,enabled) VALUES($1,'stock','weekly','inventory_audit','Configuração anterior',false)`,[owner]);
  await login();
  const prepared=await rpc('prepare_team_routines',{revision,confirmed:true});
  assert.equal(prepared.activated,false);assert.equal(prepared.prepared.length,8);
  const again=await rpc('prepare_team_routines',{revision,confirmed:true});assert.deepEqual(again,{prepared:[],activated:false});
  await db.exec('RESET ROLE');
  const rows=(await db.query(`SELECT agent,cadence,instruction,enabled FROM ${ns}.team_routines WHERE user_id=$1 ORDER BY agent`,[owner])).rows;
  assert.equal(rows.length,9);assert.ok(rows.every(x=>x.enabled===false));
  assert.deepEqual(rows.find(x=>x.agent==='stock'),{agent:'stock',cadence:'weekly',instruction:'Configuração anterior',enabled:false});
  assert.deepEqual(await snapshot(),before);
  await login();await assert.rejects(rpc('remember',{id:'00000000-0000-0000-0000-000000000099',agent:'stock',mission:'00000000-0000-0000-0000-000000000098',summary:'Memória sem evidência',kind:'lesson'}),/EVIDENCE_REQUIRED/);
  console.log('PASS: owner access, confirmation, stale revision, eight missing departments, nine suspended, idempotency, existing routine preserved, no new missions or spending, memory evidence required');
  await db.exec('RESET ROLE');await db.exec(fs.readFileSync('sql/intelligence-professional-start-v1.sql','utf8'));
  // These are synthetic completed reports, not actual AI outputs.
  for(const [agent,kind,id] of [['director','daily_priority_plan','00000000-0000-0000-0000-000000000071'],['stock','inventory_audit','00000000-0000-0000-0000-000000000072']]){
   await db.query(`INSERT INTO ${ns}.team_missions(user_id,mission_id,agent,kind,instruction,control_revision,status) VALUES($1,$2,$3,$4,'Relatório sintético já concluído',$5,'review_ready')`,[owner,id,agent,kind,revision]);
  }
  const prior=await snapshot();
  await login(other);await assert.rejects(rpc('start_team_work',{revision,confirmed:true}),/OWNER_REQUIRED/);
  await login();await assert.rejects(rpc('start_team_work',{revision,confirmed:false}),/TEAM_START_APPROVAL_REQUIRED/);
  const start=await rpc('start_team_work',{revision,confirmed:true});
  assert.deepEqual(start,{prepared:7,mode:'semi',paid:false});
  await db.exec('RESET ROLE');
  const c=(await db.query(`SELECT revision,enabled,modes FROM ${ns}.team_controls WHERE user_id=$1`,[owner])).rows[0];assert.equal(c.enabled,true);assert.ok(Object.values(c.modes).every(x=>x==='semi'));
  assert.equal(Number((await db.query(`SELECT count(*) n FROM ${ns}.team_routines WHERE user_id=$1 AND enabled`,[owner])).rows[0].n),9);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM ${ns}.team_missions WHERE user_id=$1 AND status='pending_review'`,[owner])).rows[0].n),7);
  assert.equal(Number((await db.query(`SELECT count(*) n FROM ${ns}.team_missions WHERE user_id=$1 AND status='review_ready'`,[owner])).rows[0].n),2);
  const after=await snapshot();assert.deepEqual(after.budget,prior.budget);assert.deepEqual(after.entries,prior.entries);
  await login();assert.deepEqual(await rpc('start_team_work',{revision:Number(c.revision),confirmed:true}),{prepared:0,mode:'semi',paid:false});
  console.log('PASS: start nine employees in semi mode, reuse two completed reports, prepare seven pending missions, no paid release and no duplicate on retry');
 }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
