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

 await db.exec(fs.readFileSync('sql/complete-production-backoffice-v2.sql','utf8'));
 const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',oid='00000000-0000-0000-0000-000000000011',pid='00000000-0000-0000-0000-000000000021';
 const product={code:'P',name:'Vela',manufactured:true,price:12,marginPct:50};
 const order={id:'O',status:'Em produção',total:36,items:[{code:'P',qty:2,price:12,personalization:{fragrance:'Coco'}},{code:'P',qty:1,price:12,personalization:{fragrance:'Figo'}}],technicalSnapshotV1757:{lines:[0,1].map(index=>({index,code:'P',materialsCaptured:true,materials:[{item:'Cera',qtyPerUnit:100,unit:'g'},{item:'Referência',qtyPerUnit:10,unit:'g',unitCost:.1}]}))}};
 const state={settings:{productionFragranceStockV2:['Referência','Coco','Figo','Litros']},stock:[{name:'Cera',unit:'g',qty:500,unitCost:.01},{name:'Referência',unit:'g',qty:90,unitCost:.1},{name:'Coco',unit:'g',qty:50,unitCost:.2},{name:'Figo',unit:'g',qty:50,unitCost:.3},{name:'Litros',unit:'ml',qty:50,unitCost:.1}],stockMoves:[{id:'past'}],productionRuns:[{id:'past',orders:['old']}],productRecipes:{P:[{item:'Cera',qty:1},{item:'Referência',qty:99}]}};
 const selections=[{orderId:'O',lineIndex:0,recipeIndex:1,referenceItem:'Referência',actualItem:'Coco',actualQty:22,unit:'g'},{orderId:'O',lineIndex:1,recipeIndex:1,referenceItem:'Referência',actualItem:'Figo',actualQty:9,unit:'g'}];
 const run={id:'RUN',materials:{Cera:300,Coco:22,Figo:9},fragranceSelections:selections};
 const clone=x=>JSON.parse(JSON.stringify(x));let passed=0;
 async function reset(change=()=>{}){
  await db.exec('RESET ROLE;TRUNCATE artessencia_v1_orders,artessencia_v1_products,artessencia_v1_state');const data=clone(state);change(data);
  await db.query('INSERT INTO artessencia_v1_state VALUES($1,$2,7,now(),$3,$4)',[owner,JSON.stringify(data),'fixture','old']);
  await db.query('INSERT INTO artessencia_v1_orders VALUES($1,$2,$3,$4,now())',[oid,owner,JSON.stringify(order),order.status]);
  await db.query('INSERT INTO artessencia_v1_products VALUES($1,$2,$3,now())',[pid,owner,JSON.stringify(product)]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('SET ROLE authenticated');
 }
 async function sources(){return {orders:(await db.query('SELECT * FROM artessencia_v1_orders')).rows,products:(await db.query('SELECT * FROM artessencia_v1_products')).rows}}
 async function rpc(r=run,revision=7,src=null,version=2){const s=src||await sources();return (await db.query(`SELECT artessencia_complete_production_backoffice_v${version}($1,$2,$3,$4,$5) AS result`,[revision,JSON.stringify(r),JSON.stringify(s.orders),JSON.stringify(s.products),'fixture'])).rows[0].result}
 async function snapshot(){return {state:(await db.query('SELECT * FROM artessencia_v1_state')).rows,orders:(await db.query('SELECT * FROM artessencia_v1_orders')).rows,products:(await db.query('SELECT * FROM artessencia_v1_products')).rows}}
 async function rejects(label,mutate,pattern,change){await reset(change);const before=await snapshot(),r=clone(run);mutate(r);await assert.rejects(rpc(r),pattern);assert.deepEqual(await snapshot(),before);passed++;console.log('PASS',label)}
 await reset();const originalSources=await sources(),before=await snapshot();const result=await rpc(run,7,originalSources),actual=result.state.data;
 assert.deepEqual(actual.stock.map(x=>x.qty),[200,90,28,41,50]);assert.equal(actual.stockMoves.length,4);assert.deepEqual(actual.stockMoves[0],state.stockMoves[0]);assert.deepEqual(actual.productionRuns[0],state.productionRuns[0]);assert.deepEqual(actual.productRecipes,state.productRecipes);
 assert.deepEqual(result.orders[0].data.items,order.items);assert.deepEqual(result.orders[0].data.technicalSnapshotV1757,order.technicalSnapshotV1757);assert.equal(result.orders[0].data.total,36);assert.deepEqual((await sources()).products,before.products);
 const facts=actual.productionRuns[1].fragranceActualsV2;assert.equal(facts.length,2);assert.equal(facts[0].actualCost,4.4);assert.equal(facts[0].referenceCost,2);assert.equal(facts[0].marginImpact,-2.4);assert.equal(facts[1].actualItem,'Figo');assert.equal(facts[0].referenceCostBasis,'recipe_snapshot');assert.equal(actual.productionRuns[1].materialCostTotal,10.1);passed++;console.log('PASS two lines, frozen recipe, actual stock/cost/margin, PVP and history preservation');
 // A lost response on device A, retried by the durable journal, is the same operation.
 const replay=await rpc(run,7,originalSources);assert.equal(replay.replayed,true);assert.deepEqual(replay.state,result.state);passed++;console.log('PASS lost response retry: no second consumption');
 const conflict=clone(run);conflict.fragranceSelections[0].actualQty=21;await assert.rejects(rpc(conflict,7,originalSources),/IDEMPOTENCY_CONFLICT/);passed++;
 // Device B's stale revision cannot overwrite device A; device C reads the canonical result.
 const completed=await snapshot();await assert.rejects(rpc({...run,id:'SECOND'},7,originalSources),/cloud_revision_conflict/);await assert.rejects(rpc({...run,id:'SECOND'},8),/ORDER_NOT_IN_PRODUCTION/);assert.deepEqual(await snapshot(),completed);passed++;console.log('PASS stale device and already-completed order blocked; canonical read consistent');
 await reset(s=>s.stock[1].qty=0);const depleted=await rpc();assert.equal(depleted.state.data.stock[1].qty,0);assert.equal(depleted.state.data.stock[2].qty,28);passed++;console.log('PASS depleted reference stock does not block actual fragrance consumption');
 await rejects('missing stock',r=>{r.fragranceSelections[0].actualItem='Missing'},/FRAGRANCE_STOCK_REQUIRED/,s=>s.settings.productionFragranceStockV2.push('Missing'));
 await rejects('insufficient stock',()=>{},/INSUFFICIENT_OR_AMBIGUOUS_STOCK/,s=>s.stock[2].qty=1);
 await rejects('incompatible units',r=>{r.fragranceSelections[0].actualItem='Litros'},/FRAGRANCE_UNIT_MISMATCH/);
 await rejects('unauthorized non-fragrance',r=>{r.fragranceSelections[0].recipeIndex=0;r.fragranceSelections[0].referenceItem='Cera'},/FRAGRANCE_NOT_AUTHORIZED/);
 await rejects('duplicate substitution',r=>r.fragranceSelections.push(r.fragranceSelections[0]),/DUPLICATE_FRAGRANCE_SELECTION/);
 await rejects('nonexistent line',r=>r.fragranceSelections[0].lineIndex=9,/UNUSED_FRAGRANCE_SELECTION/);
 await rejects('invalid quantity',r=>r.fragranceSelections[0].actualQty=-1,/INVALID_FRAGRANCE_QUANTITY/);
 await rejects('altered other material',r=>r.materials.Cera=1,/MATERIAL_CONTRACT_MISMATCH/);
 await rejects('missing cost',()=>{},/FRAGRANCE_COST_REQUIRED/,s=>delete s.stock[2].unitCost);
 await reset();const src=await sources();src.products[0].data.price=1;await assert.rejects(rpc(run,7,src),/PRODUCT_CHANGED/);passed++;
 await reset();const snap=await snapshot();await db.exec("RESET ROLE;CREATE FUNCTION reject_order_test() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'SIMULATED_WRITE_FAILURE';END$$;CREATE TRIGGER reject_order BEFORE UPDATE ON artessencia_v1_orders FOR EACH ROW EXECUTE FUNCTION reject_order_test();SET ROLE authenticated;");await assert.rejects(rpc(),/SIMULATED_WRITE_FAILURE/);assert.deepEqual(await snapshot(),snap);await db.exec('RESET ROLE;DROP TRIGGER reject_order ON artessencia_v1_orders');passed++;console.log('PASS late failure rolls back all stock, moves and order changes');
 await reset();const oldRun={id:'OLD-PATH',materials:{Cera:300,'Referência':30}};const legacy=await rpc(oldRun,7,null,1);assert.equal(legacy.state.data.stock[1].qty,60);passed++;console.log('PASS untouched RPC v1');
 await reset();const v2legacy=await rpc(oldRun);assert.equal(v2legacy.state.data.stock[1].qty,60);passed++;
 await reset();const ownSources=await sources();await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(rpc(run,7,ownSources),/CANONICAL_STATE_REQUIRED/);await db.exec('RESET ROLE;SET ROLE anon');await assert.rejects(rpc(run,7,ownSources),/permission denied/);passed++;console.log('PASS ownership RLS and anonymous denial');
 await db.close();console.log(`${passed} integration checks passed on isolated PostgreSQL; no production data used.`);
})().catch(e=>{console.error(e);process.exitCode=1});
