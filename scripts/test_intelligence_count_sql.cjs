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
 await db.close();console.log('PASS: intelligence count fixture');
})().catch(e=>{console.error(e);process.exitCode=1});
