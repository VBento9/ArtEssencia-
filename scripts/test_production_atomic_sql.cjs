'use strict';
// Isolated PostgreSQL (PGlite): no network, credentials or production records.
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE public.artessencia_v1_state(user_id uuid primary key,data jsonb,revision bigint,updated_at timestamptz,device_id text,app_version text);
 CREATE TABLE public.artessencia_v1_orders(id uuid primary key,user_id uuid,data jsonb,status text,updated_at timestamptz);
 CREATE TABLE public.artessencia_v1_products(id uuid primary key,user_id uuid,data jsonb,updated_at timestamptz);
 GRANT USAGE ON SCHEMA auth TO authenticated;
 GRANT SELECT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
 ALTER TABLE artessencia_v1_state ENABLE ROW LEVEL SECURITY; ALTER TABLE artessencia_v1_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE artessencia_v1_products ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner ON artessencia_v1_state TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 CREATE POLICY owner ON artessencia_v1_orders TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 CREATE POLICY owner ON artessencia_v1_products TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
 `);
 await db.exec(fs.readFileSync('sql/complete-production-backoffice-v1.sql','utf8'));
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',oid='00000000-0000-0000-0000-000000000011',pid='00000000-0000-0000-0000-000000000021';
 const order={id:'TEST-ORDER',status:'Em produção',items:[{code:'TEST',qty:1}],technicalSnapshotV1757:{lines:[{index:0,code:'TEST',materialsCaptured:true,materials:[{item:'fragrâncias Artficium',qtyPerUnit:27.3}]}]}};
 const product={code:'TEST',name:'Teste',manufactured:true};
 const state={stock:[{name:'Fragrância Artficium',unit:'g',qty:50}],stockMoves:[],productionRuns:[],productRecipes:{TEST:[{item:'Fragrância Artficium',qty:999}]}};
 async function reset(){await db.exec('RESET ROLE;TRUNCATE artessencia_v1_orders,artessencia_v1_products,artessencia_v1_state');await db.query('INSERT INTO artessencia_v1_state VALUES($1,$2,7,now(),$3,$4)',[owner,JSON.stringify(state),'fixture','1.9.25']);await db.query('INSERT INTO artessencia_v1_orders VALUES($1,$2,$3,$4,now())',[oid,owner,JSON.stringify(order),order.status]);await db.query('INSERT INTO artessencia_v1_products VALUES($1,$2,$3,now())',[pid,owner,JSON.stringify(product)]);await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('SET ROLE authenticated');}
 async function sources(){return {orders:(await db.query('SELECT * FROM artessencia_v1_orders')).rows,products:(await db.query('SELECT * FROM artessencia_v1_products')).rows}}
 const run={id:'RUN-TEST',date:'2026-10-25',materials:{'Fragrância Artficium':27.3}};
 async function rpc(revision=7,r=run,s=undefined){s=s||await sources();return (await db.query('SELECT artessencia_complete_production_backoffice_v1($1,$2,$3,$4,$5) AS result',[revision,JSON.stringify(r),JSON.stringify(s.orders),JSON.stringify(s.products),'fixture'])).rows[0].result}
 async function snapshot(){return {state:(await db.query('SELECT * FROM artessencia_v1_state')).rows,orders:(await db.query('SELECT * FROM artessencia_v1_orders')).rows}}
 await reset();const originalSources=await sources();const result=await rpc(7,run,originalSources);assert.equal(result.state.data.stock[0].qty,22.7);assert.equal(result.orders[0].status,'Pronta');assert.equal(result.state.revision,8);assert.equal(result.state.data.stock[0].unit,'g');assert.equal(result.state.app_version,'1.9.26');assert.equal(result.state.data.productionRuns.length,1);
 const replay=await rpc(7,run,originalSources);assert.equal(replay.replayed,true);assert.equal(replay.state.data.stock[0].qty,22.7);assert.equal(replay.state.data.stockMoves.length,1);console.log('PASS SQL: frozen legacy fragrance alias, no unit conversion, atomic success and idempotent retry.');
 await reset();const before=await snapshot();await assert.rejects(rpc(6),/cloud_revision_conflict/);assert.deepEqual(await snapshot(),before);
 await assert.rejects(rpc(7,{...run,materials:{'Fragrância Artficium':1}}),/MATERIAL_CONTRACT_MISMATCH/);assert.deepEqual(await snapshot(),before);
 const stale=await sources();stale.orders[0].data.items[0].qty=2;await assert.rejects(rpc(7,run,stale),/ORDER_CHANGED/);assert.deepEqual(await snapshot(),before);
 await db.exec("RESET ROLE;CREATE FUNCTION reject_order_test() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SIMULATED_ORDER_WRITE_FAILURE';END$$;CREATE TRIGGER reject_order BEFORE UPDATE ON artessencia_v1_orders FOR EACH ROW EXECUTE FUNCTION reject_order_test();SET ROLE authenticated;");
 await assert.rejects(rpc(),/SIMULATED_ORDER_WRITE_FAILURE/);assert.deepEqual(await snapshot(),before);console.log('PASS SQL: stale revision/order, altered totals and late order-write failure roll back stock and orders.');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(rpc(7,run,originalSources),/CANONICAL_STATE_REQUIRED/);assert.equal((await snapshot()).state.length,0);
 await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(rpc(7,run,originalSources),/permission denied/);console.log('PASS SQL: owner RLS and anonymous execution denied.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
