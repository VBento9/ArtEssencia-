'use strict';
// Local disposable fixture only; no provider, no credentials, no remote database.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const ns='artessencia_intelligence_private',owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0000-000000000003';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid()='${owner}'::uuid$$;
   GRANT USAGE ON SCHEMA auth TO authenticated;`);
  for(const p of ['intelligence-ai-budget-draft-v1','intelligence-team-draft-v1','intelligence-run-draft-v1'])await db.exec(fs.readFileSync('sql/'+p+'.sql','utf8'));
  await db.exec(`ALTER TABLE ${ns}.team_runs ADD COLUMN tool_receipts jsonb NOT NULL DEFAULT '[]';
   CREATE TABLE ${ns}.team_inputs(user_id uuid,mission_id uuid);
   CREATE TABLE ${ns}.team_delegations(user_id uuid,parent_id uuid);
   INSERT INTO ${ns}.team_controls(user_id,enabled,revision,modes) VALUES('${owner}',true,1,'{"auditoria":"manual"}');
   SELECT set_config('request.jwt.claim.sub','${owner}',false);
   SELECT ${ns}.team_create_mission('${id}','auditoria','technical_review','Synthetic audit',1);
   SELECT ${ns}.team_transition('${id}',0,'approved',NULL);
   SELECT ${ns}.team_claim_run('${id}',1);
   INSERT INTO ${ns}.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status,actual_microeur,settled_month,evidence_ref)
    SELECT request_id,'auditoria','fixture',424875,now(),CURRENT_DATE,'settled',4208,CURRENT_DATE,'fixture-receipt' FROM ${ns}.team_runs;
   SELECT ${ns}.team_finish_run('${id}',lease_id,'blocked','{"stage":"reasoning","receipts":[],"chargedMicroeur":4208}') FROM ${ns}.team_runs;`);
  await db.exec(fs.readFileSync('sql/intelligence-audit-retry-v1.sql','utf8'));
  const row=async q=>(await db.query(q)).rows[0];
  const rpc=async rev=>(await db.query('SELECT public.artessencia_intelligence_requeue_audit_v1($1,$2) AS result',[id,rev])).rows[0].result;
  const old=await row(`SELECT to_jsonb(r) AS data FROM ${ns}.team_runs r`);
  const ledger=await row(`SELECT to_jsonb(e) AS data FROM ${ns}.ai_budget_entries e`);
  await db.exec('SET ROLE anon');await assert.rejects(rpc(3),/permission denied/);
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${other}',false); SET ROLE authenticated`);
  await assert.rejects(rpc(3),/OWNER_REQUIRED/);
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${owner}',false); SET ROLE authenticated`);
  await assert.rejects(rpc(2),/MISSION_REVISION_CONFLICT/);
  await assert.rejects(db.exec(`SELECT * FROM ${ns}.team_run_retry_archive`),/permission denied/);
  await db.exec(`RESET ROLE; UPDATE ${ns}.ai_budget_control SET frozen=true; SET ROLE authenticated`);
  await assert.rejects(rpc(3),/RETRY_BUDGET_UNRECONCILED/);
  await db.exec(`RESET ROLE; UPDATE ${ns}.ai_budget_control SET frozen=false; UPDATE ${ns}.team_runs SET tool_receipts='[{}]'; SET ROLE authenticated`);
  await assert.rejects(rpc(3),/RETRY_SIDE_EFFECT_UNVERIFIED/);
  await db.exec(`RESET ROLE; UPDATE ${ns}.team_runs SET tool_receipts='[]'; SET ROLE authenticated`);
  const result=await rpc(3);assert.equal(result.status,'pending_review');assert.equal(result.requiresNewApproval,true);assert.equal(result.revision,4);
  await assert.rejects(rpc(3),/MISSION_REVISION_CONFLICT/);
  await db.exec('RESET ROLE');
  assert.deepEqual((await row(`SELECT run_snapshot AS data FROM ${ns}.team_run_retry_archive`)).data,old.data);
  assert.deepEqual(await row(`SELECT to_jsonb(e) AS data FROM ${ns}.ai_budget_entries e`),ledger);
  assert.equal(Number((await row(`SELECT count(*) n FROM ${ns}.team_runs`)).n),0);
  await assert.rejects(db.exec(`SELECT ${ns}.team_claim_run('${id}',4)`),/INVALID_TRANSITION/);
  await db.exec(`SELECT ${ns}.team_transition('${id}',4,'approved',NULL); SELECT ${ns}.team_claim_run('${id}',5);`);
  const fresh=await row(`SELECT request_id,lease_id FROM ${ns}.team_runs`);
  assert.notEqual(fresh.request_id,old.data.request_id);assert.notEqual(fresh.lease_id,old.data.lease_id);
  await assert.rejects(db.query(`SELECT ${ns}.team_finish_run($1,$2,'blocked','{"stage":"reasoning","receipts":[]}')`,[id,old.data.lease_id]),/LEASE_INVALID/);
  assert.equal((await row(`SELECT release_enabled FROM ${ns}.ai_budget_control`)).release_enabled,false);
  assert.deepEqual(await row(`SELECT to_jsonb(e) AS data FROM ${ns}.ai_budget_entries e`),ledger);
  console.log('PASS: owner-only audit requeue, immutable history and receipt, stale revision, frozen budget, side effects, new approval and lease, disabled financial release');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
