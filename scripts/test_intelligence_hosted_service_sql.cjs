'use strict';
// Disposable synthetic database: this script never connects to either Cloud.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),ns='artessencia_intelligence_private';
 const owner='00000000-0000-0000-0000-000000000001',service='00000000-0000-0000-0000-000000000002',session='00000000-0000-0000-0000-000000000003';
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE artessencia_intelligence_worker NOLOGIN;
 CREATE SCHEMA auth;CREATE SCHEMA ${ns};
 CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 INSERT INTO auth.users VALUES('${owner}'),('${service}');INSERT INTO auth.sessions VALUES('${session}','${service}',NULL);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT current_setting('request.jwt.claims',true)::jsonb$$;
 CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid()='${owner}'::uuid$$;
 CREATE FUNCTION public.artessencia_intelligence_worker_v1(text,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$BEGIN
 IF $1='reserve' THEN RAISE EXCEPTION 'FINANCIAL_RELEASE_REQUIRED'; END IF;
 RETURN jsonb_build_object('owner',auth.uid(),'action',$1);END$$;
 REVOKE ALL ON FUNCTION public.artessencia_intelligence_worker_v1(text,jsonb) FROM PUBLIC;
 GRANT USAGE ON SCHEMA auth TO authenticated;`);
 await db.exec(fs.readFileSync('sql/intelligence-hosted-service-v1.sql','utf8'));
 const admin=async sql=>{await db.exec('RESET ROLE');await db.exec(sql);await login();};
 const login=async(id=service,sid=session)=>{
  await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({sub:id,role:'authenticated',session_id:sid})]);await db.exec('SET ROLE authenticated');
 };
 const rpc=async action=>(await db.query('SELECT public.artessencia_intelligence_service_v1($1,$2) r',[action,'{}'])).rows[0].r;
 await login();await assert.rejects(rpc('identity'),/SERVICE_REQUIRED/);
 await admin(`INSERT INTO ${ns}.worker_service_binding(service_id,owner_id) VALUES('${service}','${owner}')`);
 await assert.rejects(rpc('identity'),/SERVICE_REQUIRED/);
 await admin(`UPDATE ${ns}.worker_service_binding SET enabled=true`);
 assert.deepEqual(await rpc('identity'),{owner,action:'identity'});
 assert.equal((await db.query("SELECT auth.uid() id")).rows[0].id,service);
 await assert.rejects(rpc('reserve'),/FINANCIAL_RELEASE_REQUIRED/);
 assert.equal((await db.query("SELECT auth.uid() id")).rows[0].id,service);
 await assert.rejects(rpc('change_permissions'),/INVALID_SERVICE_ACTION/);
 await assert.rejects(rpc('trial_identity'),/INVALID_SERVICE_ACTION/);
 await assert.rejects(db.exec(`UPDATE ${ns}.worker_service_binding SET enabled=false`),/permission denied/);
 await assert.rejects(db.query('SELECT public.artessencia_intelligence_worker_v1($1,$2)',['identity','{}']),/permission denied/);
 await login(owner);await assert.rejects(rpc('identity'),/SERVICE_REQUIRED/);
 await login(service,owner);await assert.rejects(rpc('identity'),/SERVICE_SESSION_REQUIRED/);
 await admin(`UPDATE auth.sessions SET not_after=now()-interval '1 minute'`);
 await assert.rejects(rpc('identity'),/SERVICE_SESSION_REQUIRED/);
 await admin(`UPDATE auth.sessions SET not_after=NULL;UPDATE ${ns}.worker_service_binding SET enabled=false`);
 await assert.rejects(rpc('identity'),/SERVICE_REQUIRED/);
 console.log('PASS: disabled defaults, service binding, owner scope, live session, expiry, revocation, role isolation, financial gate delegation and claim restoration');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
