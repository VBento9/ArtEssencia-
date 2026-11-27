'use strict';
// Independent disposable database; no remote URL, provider, credentials or production data.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const owner='00000000-0000-0000-0000-000000000001',service='00000000-0000-0000-0000-000000000002',session='00000000-0000-0000-0000-000000000003';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const ns='artessencia_intelligence_private',model='gpt-5.4-mini-2026-03-17';
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
   CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
   CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid()='${owner}'::uuid $$;
  `);
  await db.exec(fs.readFileSync('sql/intelligence-ai-budget-draft-v1.sql','utf8'));
  await db.exec(`
   CREATE TABLE ${ns}.team_controls(user_id uuid PRIMARY KEY,enabled boolean NOT NULL,revision bigint NOT NULL,modes jsonb NOT NULL);
   CREATE TABLE ${ns}.team_missions(user_id uuid,mission_id uuid PRIMARY KEY,agent text,status text,control_revision bigint,revision bigint,kind text,created_at timestamptz DEFAULT now());
   CREATE TABLE ${ns}.team_runs(user_id uuid,mission_id uuid,request_id uuid PRIMARY KEY,status text);
   CREATE TABLE ${ns}.team_routines(user_id uuid,enabled boolean);
   CREATE TABLE ${ns}.worker_service_binding(service_id uuid PRIMARY KEY,owner_id uuid,enabled boolean NOT NULL DEFAULT false);
   CREATE FUNCTION ${ns}.team_run_status(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$
    SELECT jsonb_build_object('active',true,'agent',m.agent,'requestId',r.request_id)
    FROM ${ns}.team_missions m JOIN ${ns}.team_runs r USING(mission_id,user_id)
    WHERE m.mission_id=p_id AND m.user_id=auth.uid() $$;
   INSERT INTO ${ns}.team_controls VALUES('${owner}',true,1,'{"stock":"manual","director":"manual"}');
   INSERT INTO ${ns}.worker_service_binding VALUES('${service}','${owner}',false);
   INSERT INTO auth.sessions VALUES('${session}','${service}',NULL);
  `);
  await db.exec(fs.readFileSync('sql/intelligence-worker-v1.sql','utf8'));
  await db.exec(`INSERT INTO ${ns}.simulation_release VALUES('${owner}',false)`);
  await db.exec(fs.readFileSync('sql/isolated/intelligence_test_simulation_budget_gate_v1.sql','utf8'));
  await db.exec(`INSERT INTO ${ns}.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status,actual_microeur,settled_month,evidence_ref)
   VALUES('${id(10)}','stock','artessencia-simulation-v1',1,now(),DATE '2000-01-01','settled',0,DATE '2000-01-01','fixture')`);
  await db.exec(fs.readFileSync('sql/isolated/intelligence_test_real_trial_gate_v1.sql','utf8'));
  const row=async q=>(await db.query(q)).rows[0];
  const control=await row(`SELECT release_enabled,monthly_limit_microeur FROM ${ns}.ai_budget_control`);
  assert.equal(control.release_enabled,false);assert.equal(Number(control.monthly_limit_microeur),1000000);
  assert.equal((await row(`SELECT enabled FROM ${ns}.trial_release`)).enabled,false);
  assert.equal(Number((await row(`SELECT count(*) n FROM ${ns}.ai_budget_entries`)).n),1);
  await db.exec('GRANT USAGE ON SCHEMA auth TO authenticated');
  const login=async (actor=service,sid=session)=>{
   await db.exec('RESET ROLE');
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[actor,JSON.stringify({sub:actor,role:'authenticated',session_id:sid})]);
   await db.exec('SET ROLE authenticated');
  };
  const rpc=async(action,args={})=>(await db.query('SELECT public.artessencia_intelligence_service_v1($1,$2) AS r',[action,JSON.stringify(args)])).rows[0].r;
  const admin=async sql=>{await db.exec('RESET ROLE');await db.exec(sql);await login();};
  await login();
  await assert.rejects(rpc('trial_identity'),/SERVICE_REQUIRED/);
  await assert.rejects(db.exec(`UPDATE ${ns}.trial_release SET enabled=true`),/permission denied/);
  await admin(`UPDATE ${ns}.worker_service_binding SET enabled=true`);
  assert.equal(await rpc('trial_identity'),false);
  await assert.rejects(rpc('next'),/ISOLATED_EXECUTION_DISABLED/);
  await login(owner);await assert.rejects(rpc('trial_identity'),/SERVICE_REQUIRED/);
  await login(service,id(99));await assert.rejects(rpc('trial_identity'),/SERVICE_SESSION_REQUIRED/);
  await admin(`UPDATE ${ns}.trial_release SET enabled=true,approved_at=now(),expires_at=now()+interval '1 hour'`);
  assert.equal(await rpc('trial_identity'),true);
  assert.equal((await row("SELECT current_setting('request.jwt.claim.sub') AS sub")).sub,service);
  await assert.rejects(rpc('tick'),/TRIAL_MANUAL_ONLY/);
  await assert.rejects(rpc('next'),/TRIAL_MANUAL_ONLY/);
  await assert.rejects(rpc('reserve',{channel:'legacy_social',model,request:id(20),maximum:1}),/TRIAL_MANUAL_ONLY/);
  await assert.rejects(rpc('reserve',{channel:'stock',mission:id(21),model:'artessencia-simulation-v1',request:id(22),maximum:1}),/ISOLATED_MODEL_DENIED/);
  await admin(`UPDATE ${ns}.team_controls SET modes='{"stock":"auto"}'`);
  assert.equal(await rpc('trial_identity'),false);
  await admin(`UPDATE ${ns}.team_controls SET modes='{"stock":"manual","director":"manual"}';INSERT INTO ${ns}.team_routines VALUES('${owner}',true)`);
  assert.equal(await rpc('trial_identity'),false);
  await admin(`UPDATE ${ns}.team_routines SET enabled=false;UPDATE ${ns}.trial_release SET approved_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'`);
  assert.equal(await rpc('trial_identity'),false);
  await admin(`UPDATE ${ns}.trial_release SET approved_at=now(),expires_at=now()+interval '1 hour';
   INSERT INTO ${ns}.team_missions(user_id,mission_id,agent,status,control_revision,revision,kind) VALUES
   ('${owner}','${id(30)}','stock','working',1,2,'inventory_audit'),
   ('${owner}','${id(31)}','stock','working',1,2,'inventory_audit');
   INSERT INTO ${ns}.team_runs VALUES('${owner}','${id(30)}','${id(40)}','working','[]'),
   ('${owner}','${id(31)}','${id(41)}','working','[]')`);
  const a={mission:id(30),request:id(40),channel:'stock'},b={mission:id(31),request:id(41),channel:'stock'};
  assert.equal((await rpc('reserve',{...a,model,maximum:700000})).remainingMicroeur,300000);
  await assert.rejects(rpc('reserve',{...b,model,maximum:300001}),/BUDGET_LIMIT/);
  assert.equal((await rpc('claim_charge',a)).status,'inflight');
  assert.equal((await rpc('settle',{request:a.request,actual:600000,evidence:'fixture-response'})).actualMicroeur,600000);
  await admin(`UPDATE ${ns}.ai_budget_entries SET reserved_month=DATE '2000-01-01',settled_month=DATE '2000-01-01' WHERE request_id='${a.request}'`);
  await assert.rejects(rpc('reserve',{...b,model,maximum:400001}),/TRIAL_LIFETIME_LIMIT/);
  assert.equal((await rpc('reserve',{...b,model,maximum:400000})).remainingMicroeur,0);
  await admin(`UPDATE ${ns}.trial_release SET approved_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'`);
  await assert.rejects(rpc('claim_charge',b),/ISOLATED_EXECUTION_DISABLED/);
  await admin(`UPDATE ${ns}.trial_release SET enabled=false;UPDATE ${ns}.worker_service_binding SET enabled=false`);
  await assert.rejects(rpc('trial_identity'),/SERVICE_REQUIRED/);
  await db.exec('RESET ROLE');
  assert.equal((await row(`SELECT release_enabled FROM ${ns}.ai_budget_control`)).release_enabled,false);
  console.log('PASS: actual isolated trial migration, service identity, expiry, manual-only, model separation, historical zero-cost record, lifetime cap across months, disabled production release');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
