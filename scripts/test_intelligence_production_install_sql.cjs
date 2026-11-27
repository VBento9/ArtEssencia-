'use strict';
// Synthetic schema only. No remote credentials, writes or connections.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),owner='00000000-0000-0000-0000-000000000001';
 try{
 const fixture=fs.readFileSync('scripts/test_intelligence_central_browser.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${owner}',owner);
 await db.exec(fixture);
 await db.exec(`CREATE ROLE service_role;CREATE ROLE authenticator;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${owner}');
 CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
 CREATE TABLE public.store_owner(user_id uuid,active boolean);INSERT INTO public.store_owner VALUES('${owner}',true);`);
 const sql=fs.readFileSync('sql/deploy/intelligence-production-disabled-v1.sql','utf8');
 await db.exec(sql);
 const row=async s=>(await db.query(s)).rows[0];
 assert.deepEqual(await row('SELECT release_enabled,frozen,monthly_limit_microeur::int cap FROM artessencia_intelligence_private.ai_budget_control'),{release_enabled:false,frozen:true,cap:0});
 assert.equal((await row('SELECT enabled FROM artessencia_intelligence_private.team_controls')).enabled,false);
 assert.equal((await row('SELECT count(*)::int n FROM artessencia_intelligence_private.worker_service_binding')).n,0);
 await db.exec('SET ROLE authenticated');
 const r=await row("SELECT public.artessencia_intelligence_console_v1('read','{}') data");
 assert.equal(r.data.controls.enabled,false);assert.equal(r.data.budget.monthlyLimitMicroeur,0);
 assert.equal(r.data.missions.length,0);assert.equal(r.data.routines.length,0);
 await assert.rejects(db.query("SELECT public.artessencia_intelligence_service_v1('identity','{}')"),/SERVICE_REQUIRED/);
 await db.exec('RESET ROLE');
 await assert.rejects(db.exec(sql),/INTELLIGENCE_ALREADY_INSTALLED/);await db.exec('ROLLBACK');
 console.log('PASS: full production installation, owner console read, zero budget, all modes off, no bindings/routines, service denied and repeat installation refused');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
