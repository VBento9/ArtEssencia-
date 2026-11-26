'use strict';
// Synthetic local PGlite fixture only. Never connect to production.
const postgres=process.argv.includes('--postgres');
async function database(){
 if(!postgres){const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');return new PGlite();}
 // Never use an externally supplied URL, production credentials or a remote host.
 const {Client}=require(process.env.PG_MODULE||'pg');
 const c=new Client({host:'127.0.0.1',port:55433,database:'intelligence_fixture',user:'postgres',password:'intelligence_fixture',connectionTimeoutMillis:5000});
 await c.connect();
 const probe=await c.query("SELECT current_database() AS db, current_user AS actor");
 // Docker NAT changes inet_server_addr(); check the actual client socket instead.
 if(probe.rows[0]?.db!=='intelligence_fixture'||probe.rows[0]?.actor!=='postgres'||c.connection.stream.remoteAddress!=='127.0.0.1'||c.connection.stream.remotePort!==55433){await c.end();throw Error('Unsafe SQL fixture database');}
 return {exec:s=>c.query(s),query:(s,p)=>c.query(s,p),close:()=>c.end()};
}
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const db=await database();
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE FUNCTION public.artessencia_is_owner_v1() RETURNS boolean LANGUAGE sql AS $$SELECT auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
 CREATE TABLE public.artessencia_v1_state(user_id uuid primary key,data jsonb,revision bigint,updated_at timestamptz,device_id text,app_version text);
 GRANT USAGE ON SCHEMA auth TO authenticated;
 GRANT SELECT,UPDATE ON public.artessencia_v1_state TO authenticated;
 ALTER TABLE public.artessencia_v1_state ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner ON public.artessencia_v1_state TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 `);
 await db.exec(fs.readFileSync('sql/intelligence-count-draft-v1.sql','utf8'));
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',mission='00000000-0000-0000-0000-000000000011';
 const original={stock:[{name:'Cera',qty:500,unit:'g',unitCost:.02},{name:'Pavio',qty:8,unit:'un',unitCost:.1}],stockMoves:[],productRecipes:{A:[{item:'Cera',qty:20}]},purchases:[{item:'Cera',qty:500}],cash:[],productionRuns:[]};
 const lines=[{name:'Cera',unit:'g',before:500,after:1000},{name:'Pavio',unit:'un',before:8,after:0}];
 await db.query('INSERT INTO public.artessencia_v1_state VALUES($1,$2,7,now(),$3,$4)',[owner,JSON.stringify(original),'fixture','1.9.196']);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('SET ROLE authenticated');
 async function rpc(rev=7,l=lines){return (await db.query('SELECT public.artessencia_intelligence_count_v1($1,$2,$3,$4) AS r',[rev,mission,JSON.stringify(l),'fixture'])).rows[0].r;}
 const read=async()=> (await db.query('SELECT data,revision FROM public.artessencia_v1_state')).rows;
 await assert.rejects(rpc(),/permission denied/);
 await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_count_v1(bigint,uuid,jsonb,text) TO authenticated; GRANT USAGE ON SCHEMA artessencia_intelligence_private TO authenticated; GRANT SELECT ON artessencia_intelligence_private.controls,artessencia_intelligence_private.count_receipts,artessencia_intelligence_private.count_approvals TO authenticated; GRANT INSERT ON artessencia_intelligence_private.count_receipts TO authenticated; GRANT EXECUTE ON FUNCTION artessencia_intelligence_private.normalize_count_lines(jsonb) TO authenticated; SET ROLE authenticated');
 await assert.rejects(rpc(),/AGENT_DISABLED/);
 await db.exec('RESET ROLE');
 await db.query('INSERT INTO artessencia_intelligence_private.controls(user_id) VALUES($1)',[owner]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(),/AGENT_DISABLED/);
 await db.exec('RESET ROLE');
 await db.query('UPDATE artessencia_intelligence_private.controls SET enabled=true WHERE user_id=$1',[owner]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(),/AGENT_DISABLED/);
 await db.exec('RESET ROLE');
 await db.query('UPDATE artessencia_intelligence_private.controls SET stock_enabled=true WHERE user_id=$1',[owner]);
 await db.exec('SET ROLE authenticated');
 const before=await read();
 await assert.rejects(rpc(6),/cloud_revision_conflict/);assert.deepEqual(await read(),before);
 await assert.rejects(rpc(),/MISSION_NOT_APPROVED/);assert.deepEqual(await read(),before);
 await assert.rejects(db.query("INSERT INTO artessencia_intelligence_private.count_approvals(user_id,mission_id,expected_revision,request_lines,expires_at) VALUES($1,$2,7,$3,now()+interval '1 hour')",[owner,mission,JSON.stringify(lines)]),/permission denied/);
 await db.exec('RESET ROLE');
 await db.query("INSERT INTO artessencia_intelligence_private.count_approvals(user_id,mission_id,expected_revision,request_lines,approved_at,expires_at) VALUES($1,$2,7,$3,now()-interval '2 hours',now()-interval '1 hour')",[owner,mission,JSON.stringify(lines)]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(),/MISSION_NOT_APPROVED/);
 await db.exec('RESET ROLE');
 await db.query("UPDATE artessencia_intelligence_private.count_approvals SET approved_at=now(),expires_at=now()+interval '1 hour' WHERE user_id=$1 AND mission_id=$2",[owner,mission]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(7,[{...lines[0],after:999},lines[1]]),/MISSION_NOT_APPROVED/);
 await assert.rejects(db.query("UPDATE artessencia_intelligence_private.count_approvals SET expected_revision=8"),/permission denied/);
 await assert.rejects(db.query("DELETE FROM artessencia_intelligence_private.count_approvals"),/permission denied/);

 await db.exec('RESET ROLE');
 await db.query("UPDATE artessencia_intelligence_private.count_approvals SET request_lines=$1 WHERE user_id=$2 AND mission_id=$3",[JSON.stringify([lines[0],{...lines[1],before:9}]),owner,mission]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(7,[lines[0],{...lines[1],before:9}]),/STOCK_CHANGED/);assert.deepEqual(await read(),before);
 await db.exec('RESET ROLE');
 await db.query("UPDATE artessencia_intelligence_private.count_approvals SET request_lines=$1 WHERE user_id=$2 AND mission_id=$3",[JSON.stringify(lines),owner,mission]);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(rpc(7,[lines[0],lines[0]]),/DUPLICATE_LINE/);
 await assert.rejects(rpc(7,[{...lines[1],after:1.5}]),/INVALID_QUANTITY/);
 await assert.rejects(rpc(7,[{...lines[0],unit:'ml'}]),/MISSION_NOT_APPROVED/);
 await db.exec("RESET ROLE; CREATE FUNCTION public.reject_receipt_fixture() RETURNS trigger LANGUAGE plpgsql AS $fixture$ BEGIN RAISE EXCEPTION 'SIMULATED_RECEIPT_FAILURE'; END; $fixture$; CREATE TRIGGER reject_receipt_fixture BEFORE INSERT ON artessencia_intelligence_private.count_receipts FOR EACH ROW EXECUTE FUNCTION public.reject_receipt_fixture(); SET ROLE authenticated");
 await assert.rejects(rpc(),/SIMULATED_RECEIPT_FAILURE/);assert.deepEqual(await read(),before);
 await db.exec('RESET ROLE; DROP TRIGGER reject_receipt_fixture ON artessencia_intelligence_private.count_receipts; SET ROLE authenticated');
 const result=await rpc();assert.equal(result.state.revision,8);assert.equal(result.state.data.stock[0].qty,1000);assert.equal(result.state.data.stock[1].qty,0);assert.equal(result.state.data.stockMoves.length,2);assert.equal(result.state.data.stock[0].unitCost,.02);assert.deepEqual(result.state.data.productRecipes,original.productRecipes);assert.deepEqual(result.state.data.purchases,original.purchases);
 const replay=await rpc(7,[...lines].reverse());assert.equal(replay.replayed,true);assert.equal(replay.state.data.stockMoves.length,2);
 await assert.rejects(rpc(7,[{...lines[0],after:999},lines[1]]),/IDEMPOTENCY_CONFLICT/);
 const receipts=await db.query('SELECT * FROM artessencia_intelligence_private.count_receipts');
 assert.equal(receipts.rows.length,1);assert.equal(Number(receipts.rows[0].committed_revision),8);
 await assert.rejects(db.query('DELETE FROM artessencia_intelligence_private.count_receipts'),/permission denied/);
 await assert.rejects(db.query('UPDATE artessencia_intelligence_private.count_receipts SET committed_revision=9'),/permission denied/);
 // Simulate a legacy restore removing the movement log. Receipt must still block re-application.
 await db.exec("RESET ROLE; UPDATE public.artessencia_v1_state SET data=jsonb_set(data,'{stockMoves}','[]'::jsonb), revision=9; SET ROLE authenticated");
 const restored=await read();const durable=await rpc(7);assert.equal(durable.replayed,true);assert.deepEqual(await read(),restored);
 await assert.rejects(rpc(7,[{...lines[0],after:999},lines[1]]),/IDEMPOTENCY_CONFLICT/);

 // Exercise the private server command circuit using fixture-only EXECUTE grants.
 const m2='00000000-0000-0000-0000-000000000012',m3='00000000-0000-0000-0000-000000000013',m4='00000000-0000-0000-0000-000000000014';
 const adjustment=[{name:'Cera',unit:'g',before:1000,after:900}];
 const control=async(a,b)=>(await db.query('SELECT artessencia_intelligence_private.set_count_controls($1,$2) AS r',[a,b])).rows[0].r;
 const approve=async(id,rev=9,l=adjustment)=>(await db.query('SELECT artessencia_intelligence_private.approve_count($1,$2,$3) AS r',[rev,id,JSON.stringify(l)])).rows[0].r;
 const execute=async(id,rev=9,l=adjustment)=>(await db.query('SELECT artessencia_intelligence_private.execute_approved_count($1,$2,$3,$4) AS r',[rev,id,JSON.stringify(l),'fixture'])).rows[0].r;
 const revoke=async(id)=>(await db.query('SELECT artessencia_intelligence_private.revoke_count($1) AS r',[id])).rows[0].r;
 await assert.rejects(approve(m2),/permission denied/);
 await db.exec('RESET ROLE; REVOKE EXECUTE ON FUNCTION public.artessencia_intelligence_count_v1(bigint,uuid,jsonb,text) FROM authenticated; REVOKE INSERT ON artessencia_intelligence_private.count_receipts FROM authenticated; GRANT EXECUTE ON FUNCTION artessencia_intelligence_private.set_count_controls(boolean,boolean),artessencia_intelligence_private.approve_count(bigint,uuid,jsonb),artessencia_intelligence_private.revoke_count(uuid),artessencia_intelligence_private.execute_approved_count(bigint,uuid,jsonb,text) TO authenticated; SET ROLE authenticated');
 await assert.rejects(rpc(),/permission denied/);
 await assert.rejects(execute(m2),/MISSION_NOT_APPROVED/);
 await assert.rejects(approve(m2,8),/cloud_revision_conflict/);
 await assert.rejects(approve(m2,9,[{...adjustment[0],before:999}]),/STOCK_CHANGED/);
 assert.equal((await approve(m2)).status,'approved');
 await assert.rejects(approve(m2),/MISSION_ID_USED/);
 assert.equal((await revoke(m2)).status,'revoked');
 await assert.rejects(execute(m2),/MISSION_NOT_APPROVED/);
 assert.equal((await approve(m3)).status,'approved');
 await control(false,false);
 await assert.rejects(execute(m3),/AGENT_DISABLED/);
 await control(true,true);
 await assert.rejects(execute(m3),/MISSION_NOT_APPROVED/);
 assert.equal((await approve(m4)).status,'approved');
 const finalResult=await execute(m4);assert.equal(finalResult.state.data.stock[0].qty,900);assert.equal(finalResult.state.revision,10);
 assert.equal((await execute(m4)).replayed,true);
 await assert.rejects(revoke(m4),/MISSION_ALREADY_EXECUTED/);
 const status=async(id)=>(await db.query('SELECT artessencia_intelligence_private.count_status($1) AS r',[id])).rows[0].r;
 await assert.rejects(status(m4),/permission denied/);
 await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION artessencia_intelligence_private.count_status(uuid) TO authenticated; SET ROLE authenticated');
 const receiptStatus=await status(m4);assert.equal(receiptStatus.status,'committed');assert.equal(receiptStatus.owner,owner);assert.equal(receiptStatus.committedRevision,10);assert.deepEqual(receiptStatus.lines,adjustment);assert.equal('state' in receiptStatus,false);
 assert.equal((await status(m2)).status,'revoked');assert.equal((await status(m3)).status,'revoked');
 assert.equal((await status('00000000-0000-0000-0000-000000000099')).status,'missing');
 await control(false,false);assert.equal((await status(m4)).status,'committed');await control(true,true);

 await assert.rejects(db.query("INSERT INTO artessencia_intelligence_private.count_receipts(user_id,mission_id,request_lines,committed_revision,committed_at) VALUES($1,$2,$3,10,now())",[owner,m3,JSON.stringify(adjustment)]),/permission denied/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(execute(m4),/OWNER_REQUIRED/);await assert.rejects(control(true,true),/OWNER_REQUIRED/);await assert.rejects(approve(m4),/OWNER_REQUIRED/);await assert.rejects(status(m4),/OWNER_REQUIRED/);
 await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(rpc(),/permission denied/);
 
 // Financial ledger uses the same synthetic instance; no provider calls.
 await db.exec('RESET ROLE');
 await db.exec(fs.readFileSync('sql/intelligence-ai-budget-draft-v1.sql','utf8'));
 const bid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 const reserve=async(n,max=12000000,channel='director',conn=db)=>(await conn.query('SELECT artessencia_intelligence_private.ai_budget_reserve($1,$2,$3,$4) AS r',[bid(n),channel,'fixture-mini',max])).rows[0].r;
 const claim=async n=>(await db.query('SELECT artessencia_intelligence_private.ai_budget_claim($1) AS r',[bid(n)])).rows[0].r;
 const settle=async(n,actual,voided=false)=>(await db.query('SELECT artessencia_intelligence_private.ai_budget_settle($1,$2,$3,$4) AS r',[bid(n),actual,'fixture-evidence',voided])).rows[0].r;
 await assert.rejects(reserve(100),/BUDGET_DISABLED/);
 await db.exec('SET ROLE authenticated');
 await assert.rejects(reserve(100),/permission denied/);
 await assert.rejects(db.query('UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=true'),/permission denied/);
 await db.exec('RESET ROLE; UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=true');
 if(postgres){
  const peer=await database();
  try{
   const results=await Promise.allSettled([reserve(100),reserve(101,12000000,'legacy_social',peer)]);
   assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
   assert.match(String(results.find(x=>x.status==='rejected').reason),/BUDGET_LIMIT/);
   const winner=results[0].status==='fulfilled'?100:101;
   await settle(winner,0,true);
  }finally{await peer.close();}
 }
 assert.equal((await reserve(102)).status,'reserved');
 await assert.rejects(reserve(102),/DUPLICATE_REQUEST/);
 await assert.rejects(reserve(103,12000000,'legacy_social'),/BUDGET_LIMIT/);
 assert.equal((await claim(102)).status,'inflight');
 await assert.rejects(claim(102),/REQUEST_NOT_CLAIMABLE/);
 await db.query('SELECT artessencia_intelligence_private.ai_budget_unknown($1)',[bid(102)]);
 await db.query("UPDATE artessencia_intelligence_private.ai_budget_entries SET reserved_month=reserved_month-interval '1 month' WHERE request_id=$1",[bid(102)]);
 await assert.rejects(reserve(103,12000000,'legacy_social'),/BUDGET_LIMIT/);
 assert.equal((await settle(102,2000000)).status,'settled');
 await assert.rejects(settle(102,0,true),/REQUEST_NOT_SETTLEABLE/);
 assert.equal((await reserve(104,21000000,'legacy_social')).remainingMicroeur,0);
 await assert.rejects(reserve(105,1),/BUDGET_LIMIT/);
 await claim(104);
 await db.exec('UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=false');
 assert.equal((await settle(104,22000000)).overrun,true);
 await db.exec('UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=true');
 await assert.rejects(reserve(105,1),/BUDGET_DISABLED/);
 console.log('PASS: AI budget shared cap, unknown carry, one-time claim, settlement, freeze and PostgreSQL concurrency');

 
 // Team persistence fixture: privileged test connection only; no app grants.
 await db.exec(fs.readFileSync('sql/intelligence-team-draft-v1.sql','utf8'));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const modes={director:'off',stock:'manual',producao:'off',financeiro:'off',comercial:'off',marketing:'off',inovacao:'off',catalogo:'off',auditoria:'off'};
 const allOff=Object.fromEntries(Object.keys(modes).map(a=>[a,'off']));
 const tc=async(rev,on,m,conn=db)=>(await conn.query('SELECT artessencia_intelligence_private.team_set_controls($1,$2,$3) AS r',[rev,on,JSON.stringify(m)])).rows[0].r;
 const tm=async(n,rev,agent='stock',kind='inventory_audit')=>(await db.query('SELECT artessencia_intelligence_private.team_create_mission($1,$2,$3,$4,$5) AS r',[bid(n),agent,kind,'Synthetic inventory',rev])).rows[0].r;
 const tt=async(n,rev,status,summary=null,conn=db)=>(await conn.query('SELECT artessencia_intelligence_private.team_transition($1,$2,$3,$4) AS r',[bid(n),rev,status,summary])).rows[0].r;
 await assert.rejects(tm(201,0),/TEAM_DISABLED_OR_STALE/);
 await assert.rejects(tc(0,false,modes),/INVALID_CONTROLS/);
 await db.exec('SET ROLE authenticated');await assert.rejects(tc(0,true,modes),/permission denied/);await db.exec('RESET ROLE');
 assert.equal((await tc(0,true,modes)).revision,1);
 await assert.rejects(tc(0,true,modes),/TEAM_REVISION_CONFLICT/);
 await assert.rejects(tm(201,1,'stock','finance_review'),/INVALID_MISSION/);
 await assert.rejects(tm(201,1,'financeiro','finance_review'),/TEAM_DISABLED_OR_STALE/);
 assert.equal((await tm(201,1)).status,'pending_review');
 await assert.rejects(tm(201,1),/MISSION_ID_USED/);
 await assert.rejects(tt(201,0,'working'),/INVALID_TRANSITION/);
 assert.equal((await tt(201,0,'approved')).status,'approved');
 if(postgres){
  const peer=await database();
  try{
   await peer.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
   const claims=await Promise.allSettled([tt(201,1,'working'),tt(201,1,'working',null,peer)]);
   assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
   assert.match(String(claims.find(x=>x.status==='rejected').reason),/MISSION_REVISION_CONFLICT/);
  }finally{await peer.close();}
 }else await tt(201,1,'working');
 assert.equal((await tt(201,2,'review_ready','Synthetic result')).status,'review_ready');
 const events=await db.query('SELECT status FROM artessencia_intelligence_private.team_events WHERE mission_id=$1 ORDER BY revision',[bid(201)]);
 assert.deepEqual(events.rows.map(r=>r.status),['pending_review','approved','working','review_ready']);
 await tm(202,1);await tt(202,0,'approved');
 await tc(1,false,allOff);await tc(2,true,modes);
 await assert.rejects(tt(202,1,'working'),/TEAM_DISABLED_OR_STALE/);
 assert.equal((await tt(202,1,'cancelled')).status,'cancelled');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
 await assert.rejects(tm(203,3),/OWNER_REQUIRED/);
 await db.exec('SET ROLE authenticated');await assert.rejects(db.query('SELECT * FROM artessencia_intelligence_private.team_memory'),/permission denied/);await db.exec('RESET ROLE');
 console.log('PASS: persistent team controls, mission transitions, history, revocation and PostgreSQL concurrent claim');

 
 await db.exec(fs.readFileSync('sql/intelligence-run-draft-v1.sql','utf8'));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const runStore=require('../intelligence/sql-run-store.cjs')({query:(s,p)=>db.query(s,p),owner,loadGrants:async()=>[],releaseEnabled:true});
 await tm(301,3);await tt(301,0,'approved');
 const run=await runStore.claim({owner,missionId:bid(301),expectedRevision:1});
 assert.equal(run.status,'working');assert.equal((await runStore.verifyLease(run)).active,true);
 await assert.rejects(runStore.claim({owner,missionId:bid(301),expectedRevision:1}),/MISSION_REVISION_CONFLICT/);
 const final={mission:run,status:'review_ready',summary:'Synthetic verified result',report:{},reasoning:'Fixture',chargedMicroeur:1000,receipts:[]};
 await assert.rejects(runStore.finish(final),/CHARGE_UNVERIFIED/);
 await db.query("INSERT INTO artessencia_intelligence_private.ai_budget_entries(request_id,channel,model,maximum_microeur,reserved_at,reserved_month,status,actual_microeur,settled_month,evidence_ref) VALUES($1,'stock','fixture-mini',2000,now(),date_trunc('month',now())::date,'settled',1000,date_trunc('month',now())::date,'fixture-run')",[run.requestId]);
 assert.equal((await runStore.finish(final)).status,'review_ready');
 assert.equal((await runStore.finish(final)).replayed,true);
 await assert.rejects(runStore.finish({...final,summary:'Different'}),/RUN_ALREADY_FINAL/);
 assert.equal((await runStore.status(bid(301))).outcome.chargedMicroeur,1000);
 await tm(302,3);await tt(302,0,'approved');
 const interrupted=await runStore.claim({owner,missionId:bid(302),expectedRevision:1});
 await tc(3,false,allOff);
 assert.equal((await runStore.verifyLease(interrupted)).active,false);
 assert.equal((await runStore.interrupt({mission:interrupted,stage:'reasoning',chargedMicroeur:null,receipts:[]})).status,'blocked');
 assert.equal((await runStore.status(bid(302))).missionStatus,'blocked');
 await db.exec('SET ROLE authenticated');await assert.rejects(runStore.status(bid(301)),/permission denied/);await db.exec('RESET ROLE');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(runStore.status(bid(301)),/OWNER_REQUIRED/);
 console.log('PASS: persistent run lease, financial receipt binding, replay, recovery, revocation and private permissions');

 
 await db.exec(fs.readFileSync('sql/intelligence-stock-context-draft-v1.sql','utf8'));
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
 await db.query("UPDATE public.artessencia_v1_state SET data=jsonb_set(data,'{products}', $1::jsonb) WHERE user_id=$2",[JSON.stringify([{code:'A',privateNote:'fixture-only'}]),owner]);
 await tc(4,true,modes);await tm(401,5);await tt(401,0,'approved');
 const stockRun=await runStore.claim({owner,missionId:bid(401),expectedRevision:1});
 const contextFactory=require('../intelligence/sql-stock-context.cjs');
 const context=contextFactory({owner,query:(s,p)=>db.query(s,p),releaseEnabled:true});
 const q={owner,agent:stockRun.agent,kind:stockRun.kind,missionId:stockRun.id,leaseId:stockRun.leaseId};
 await assert.rejects(contextFactory({owner,query:(s,p)=>db.query(s,p)})(q),/fora do âmbito/);
 await assert.rejects(context({...q,agent:'financeiro'}),/fora do âmbito/);
 await assert.rejects(context({...q,leaseId:bid(499)}),/LEASE_INVALID/);
 const projected=await context(q);
 assert.deepEqual(Object.keys(projected.payload).sort(),['productRecipes','products','stock']);
 assert.equal(projected.payload.stock[0].name,'Cera');
 assert.deepEqual(projected.payload.products,[{code:'A'}]);
 const audit=require('../intelligence/inventory-audit.js').auditInventory(projected.payload);assert.ok(audit.stockCount>0);
 await tm(402,5,'stock','stock_organization_plan');await tt(402,0,'approved');
 const org=await runStore.claim({owner,missionId:bid(402),expectedRevision:1});
 assert.deepEqual(Object.keys((await context({owner,agent:org.agent,kind:org.kind,missionId:org.id,leaseId:org.leaseId})).payload),['stock']);
 await db.exec('SET ROLE authenticated');await assert.rejects(context(q),/permission denied/);await db.exec('RESET ROLE');
 await tc(5,false,allOff);await assert.rejects(context(q),/TEAM_DISABLED_OR_STALE/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(context(q),/OWNER_REQUIRED/);
 console.log('PASS: stock context scope, canonical revision, minimal fields, lease and revocation');

 await db.close();console.log('PASS: intelligence count fixture');
})().catch(e=>{console.error(e);process.exitCode=1});
