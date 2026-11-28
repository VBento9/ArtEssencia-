'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
let number=10;const id=()=> '00000000-0000-0000-0000-'+String(number++).padStart(12,'0');
const ns='artessencia_intelligence_private';
async function fixture({postgres=false}={}){
 let db;
 if(!postgres){const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');db=new PGlite();}
 else{
  const {Client}=require(process.env.PG_MODULE||'pg');
  const options={host:'127.0.0.1',port:55433,user:'postgres',password:'intelligence_fixture',connectionTimeoutMillis:5000};
  const admin=new Client({...options,database:'intelligence_fixture'});await admin.connect();
  if(admin.connection.stream.remoteAddress!=='127.0.0.1'||admin.connection.stream.remotePort!==55433)throw Error('Unsafe SQL fixture');
  await admin.query('CREATE DATABASE intelligence_meetings_fixture');await admin.end();
  const connect=async()=>{const c=new Client({...options,database:'intelligence_meetings_fixture'});await c.connect();return c;};
  const c=await connect();
  db={exec:s=>c.query(s),query:(s,p)=>c.query(s,p),newConnection:connect,close:async()=>{await c.end();const a=new Client({...options,database:'intelligence_fixture'});await a.connect();await a.query('DROP DATABASE intelligence_meetings_fixture');await a.end();}};
 }
 const safeRoles=s=>s.replace(/CREATE ROLE (anon|authenticated|service_role|authenticator);/g,(_,name)=>`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${name}') THEN CREATE ROLE ${name}; END IF; END $$;`);
 const initial=fs.readFileSync('scripts/test_intelligence_central_browser.cjs','utf8').match(/await db.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${owner}',owner);
 await db.exec(safeRoles(initial));
 await db.exec(safeRoles(`CREATE ROLE service_role;CREATE ROLE authenticator;CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${owner}'),('${other}');CREATE TABLE auth.sessions(id uuid,user_id uuid,not_after timestamptz);CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;CREATE TABLE public.store_owner(user_id uuid,active boolean);INSERT INTO public.store_owner VALUES('${owner}',true);`));
 await db.exec(fs.readFileSync('sql/deploy/intelligence-production-disabled-v1.sql','utf8'));
 await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE OR REPLACE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.store_owner WHERE user_id=auth.uid() AND active) $$;`);
 await db.exec(fs.readFileSync('sql/intelligence-meetings-v1.sql','utf8'));
 async function login(user=owner){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('SET ROLE authenticated');}
 await login();
 return {db,login,rpc:async(a,args={})=>(await db.query('SELECT public.artessencia_intelligence_meetings_v1($1,$2) data',[a,JSON.stringify(args)])).rows[0].data};
}
async function run(){
 const {db,login,rpc}=await fixture({postgres:process.argv.includes('--postgres')});let revision=0;const meeting=id(),create={meeting,operation:id(),title:'Reunião sintética',agenda:'Rever prioridades e compromissos',participants:['director','stock','auditoria']};
 const action=async(a,args={})=>{const r=await rpc(a,{meeting,revision,operation:id(),...args});revision=r.revision;return r;};
 try{
 const created=await rpc('create',create);assert.deepEqual(await rpc('create',create),created);
 await assert.rejects(rpc('create',{...create,title:'Outro título'}),/OPERATION_CONFLICT/);
 assert.equal((await rpc('read',{meeting})).meetings[0].spend_approved,false);
 await login(other);await assert.rejects(rpc('read',{meeting}),/OWNER_REQUIRED/);await login();
 await assert.rejects(db.exec(`SELECT * FROM ${ns}.meetings`),/permission denied/);
 const question=await action('message',{text:'O que falta fazer?'});
 await assert.rejects(action('request',{message:question.messageId,agent:'stock'}),/TEAM_DISABLED_OR_STALE/);
 await assert.rejects(rpc('message',{meeting,revision:0,operation:id(),text:'Revisão obsoleta'}),/MEETING_REVISION_CONFLICT/);
 const minutes=await action('minutes');assert.equal((await rpc('read',{meeting})).minutes[0].evidence.length,0);
 await assert.rejects(action('decision',{minute:minutes.minuteId,text:'Conferir cera',agent:'stock',acceptance:'Conferir e registar as referências com evidência física'}),/APPROVED_MINUTES_REQUIRED/);
 await action('approve_minutes',{minute:minutes.minuteId});
 const decision=await action('decision',{minute:minutes.minuteId,text:'Conferir cera',agent:'stock',acceptance:'Conferir e registar as referências com evidência física',dueDate:'2026-12-04'});
 await assert.rejects(action('plan',{decision:decision.decisionId}),/APPROVED_DECISION_REQUIRED/);
 await action('approve_decision',{decision:decision.decisionId});
 const planned=await action('plan',{decision:decision.decisionId});assert.equal((await action('plan',{decision:decision.decisionId})).taskId,planned.taskId);
 await db.exec('RESET ROLE');assert.equal(Number((await db.query("SELECT count(*) n FROM public.artessencia_cloud_records WHERE entity='operational_tasks_v1'")).rows[0].n),1);
 await db.query("UPDATE public.artessencia_cloud_records SET data=jsonb_set(data,'{status}','\"concluida\"'),client_updated_at=now() WHERE record_id=$1",[planned.taskId]);
 await db.exec(`UPDATE ${ns}.team_controls SET enabled=true,modes=jsonb_set(jsonb_set(modes,'{stock}','"manual"'),'{director}','"manual"') WHERE user_id='${owner}'`);await login();
 assert.equal((await rpc('read',{meeting})).commitments[0].task_status,'concluida');
 const another=id();await rpc('create',{meeting:another,operation:id(),title:'Ronda sintética',agenda:'Consulta conjunta',participants:['director','stock']});
 const roundQuestion=await rpc('message',{meeting:another,revision:0,operation:id(),text:'Analisa as prioridades.'});
 const roundArgs={meeting:another,revision:roundQuestion.revision,operation:id(),message:roundQuestion.messageId};
 const round=await rpc('round',roundArgs);assert.equal(round.turns.length,2);assert.deepEqual(await rpc('round',roundArgs),round);
 const turn=await action('request',{message:question.messageId,agent:'stock'});await assert.rejects(action('request',{message:question.messageId,agent:'stock'}),/TURN_EXISTS/);
 await assert.rejects(action('request',{message:question.messageId,agent:'marketing'}),/PARTICIPANT_REQUIRED/);
 assert.equal((await rpc('read',{meeting})).turns[0].content,null);
 await db.exec('RESET ROLE');
 // Synthetic approved mission/run enables transactional budget tests without a provider.
 const request=id(),lease=id();
 await db.query(`UPDATE ${ns}.team_missions SET status='working',revision=1 WHERE mission_id=$1`,[turn.missionId]);
 await db.query(`INSERT INTO ${ns}.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status) VALUES($1,$2,$3,$4,1,'working')`,[owner,turn.missionId,lease,request]);
 await db.exec(`UPDATE ${ns}.ai_budget_control SET frozen=false,release_enabled=true,monthly_limit_microeur=1000000`);
 await assert.rejects(db.query(`SELECT ${ns}.ai_budget_reserve($1,'stock','fixture',100)`,[request]),/MEETING_SPENDING_DISABLED/);
 await login();await action('budget',{confirmed:true,maximumMicroeur:500});
 await db.exec('RESET ROLE');await db.query(`SELECT ${ns}.ai_budget_reserve($1,'stock','fixture',400)`,[request]);
 await login();await action('pause');await db.exec('RESET ROLE');
 await assert.rejects(db.query(`SELECT ${ns}.ai_budget_claim($1)`,[request]),/MEETING_SPENDING_DISABLED/);
 await login();await action('resume');await db.exec('RESET ROLE');
 await db.query(`SELECT ${ns}.ai_budget_claim($1)`,[request]);await db.query(`SELECT ${ns}.ai_budget_settle($1,100,'synthetic',false)`,[request]);
 await db.query(`UPDATE ${ns}.team_runs SET status='review_ready',outcome=$2,ended_at=now() WHERE mission_id=$1`,[turn.missionId,JSON.stringify({reasoning:'Relatório sintético: material por conferir.',report:{provenance:{sourceRevision:7,evidenceIds:['fixture'],capturedAt:'2026-11-28T00:00:00Z'}}})]);
 await db.query(`UPDATE ${ns}.team_missions SET status='review_ready' WHERE mission_id=$1`,[turn.missionId]);await login();
 const read=await rpc('read',{meeting});assert.equal(read.turns[0].content,'Relatório sintético: material por conferir.');assert.equal(read.cost.settledMicroeur,100);
 await action('reuse',{mission:turn.missionId});assert.equal((await rpc('read',{meeting})).messages.at(-1).author,'reused');
 const revised=await action('minutes');let page=await rpc('read',{meeting});assert.equal(page.minutes[0].evidence.length,1);assert.notEqual(revised.minuteId,minutes.minuteId);assert.ok(page.minutes.some(m=>m.minute_id===minutes.minuteId&&m.approved_at));
 // Descendant delegation cannot evade the original meeting cap.
 const child=id(),childReq=id(),childLease=id();await db.exec('RESET ROLE');
 await db.query(`INSERT INTO ${ns}.team_missions(user_id,mission_id,agent,kind,instruction,control_revision,status) VALUES($1,$2,'auditoria','technical_review','Auditoria sintética',0,'working')`,[owner,child]);
 await db.query(`INSERT INTO ${ns}.team_delegations(user_id,parent_id,department,child_id) VALUES($1,$2,'auditoria',$3)`,[owner,turn.missionId,child]);
 await db.query(`INSERT INTO ${ns}.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status) VALUES($1,$2,$3,$4,1,'working')`,[owner,child,childLease,childReq]);
 await assert.rejects(db.query(`SELECT ${ns}.ai_budget_reserve($1,'auditoria','fixture',401)`,[childReq]),/MEETING_BUDGET_LIMIT/);
 await db.query(`SELECT ${ns}.ai_budget_reserve($1,'auditoria','fixture',400)`,[childReq]);
 await login();await action('budget',{confirmed:true,maximumMicroeur:499});await db.exec('RESET ROLE');
 await assert.rejects(db.query(`SELECT ${ns}.ai_budget_claim($1)`,[childReq]),/MEETING_BUDGET_LIMIT/);
 if(db.newConnection){
  // Two independent PostgreSQL connections contend for the same transactional cap.
  await db.exec('RESET ROLE');await db.query(`SELECT ${ns}.ai_budget_settle($1,0,'unclaimed-synthetic',true)`,[childReq]);
  await login();await action('budget',{confirmed:true,maximumMicroeur:600});await db.exec('RESET ROLE');
  const requests=[];
  for(const [agent,kind] of [['comercial','commercial_review'],['marketing','marketing_plan']]){
   const mission=id(),request=id();requests.push({agent,request});
   await db.query(`INSERT INTO ${ns}.team_missions(user_id,mission_id,agent,kind,instruction,control_revision,status) VALUES($1,$2,$3,$4,'Sintética concorrente',0,'working')`,[owner,mission,agent,kind]);
   await db.query(`INSERT INTO ${ns}.team_delegations(user_id,parent_id,department,child_id) VALUES($1,$2,$3,$4)`,[owner,turn.missionId,agent,mission]);
   await db.query(`INSERT INTO ${ns}.team_runs(user_id,mission_id,lease_id,request_id,claimed_revision,status) VALUES($1,$2,$3,$4,1,'working')`,[owner,mission,id(),request]);
  }
  const clients=await Promise.all([db.newConnection(),db.newConnection()]);
  try{
   const outcomes=await Promise.allSettled(clients.map((c,i)=>c.query(`SELECT ${ns}.ai_budget_reserve($1,$2,'fixture',300)`,[requests[i].request,requests[i].agent])));
   assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
   assert.equal(outcomes.filter(x=>x.status==='rejected'&&/MEETING_BUDGET_LIMIT/.test(x.reason.message)).length,1);
   console.log('PASS: simultaneous PostgreSQL reservations on independent connections cannot exceed meeting cap');
  }finally{await Promise.all(clients.map(c=>c.end()));}
 }
 await login();await action('close');await assert.rejects(action('message',{text:'Fechada'}),/MEETING_CLOSED/);
 console.log('PASS: persistent meetings, owner isolation, idempotency, stale revisions, actual interventions, reused report provenance, versioned minutes, explicit approvals, original Planning, commitment status, scoped budget, delegated costs, suspension and cap reduction');
 }finally{await db.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run};
