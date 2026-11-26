'use strict';
// Synthetic local PGlite fixture only. Never connect to production.
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const db=new PGlite();
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
 await db.exec('RESET ROLE; GRANT EXECUTE ON FUNCTION public.artessencia_intelligence_count_v1(bigint,uuid,jsonb,text) TO authenticated; SET ROLE authenticated');
 const before=await read();
 await assert.rejects(rpc(6),/cloud_revision_conflict/);assert.deepEqual(await read(),before);
 await assert.rejects(rpc(7,[lines[0],{...lines[1],before:9}]),/STOCK_CHANGED/);assert.deepEqual(await read(),before);
 await assert.rejects(rpc(7,[lines[0],lines[0]]),/DUPLICATE_LINE/);
 await assert.rejects(rpc(7,[{...lines[1],after:1.5}]),/INVALID_QUANTITY/);
 await assert.rejects(rpc(7,[{...lines[0],unit:'ml'}]),/STOCK_CHANGED/);
 const result=await rpc();assert.equal(result.state.revision,8);assert.equal(result.state.data.stock[0].qty,1000);assert.equal(result.state.data.stock[1].qty,0);assert.equal(result.state.data.stockMoves.length,2);assert.equal(result.state.data.stock[0].unitCost,.02);assert.deepEqual(result.state.data.productRecipes,original.productRecipes);assert.deepEqual(result.state.data.purchases,original.purchases);
 const replay=await rpc(7,[...lines].reverse());assert.equal(replay.replayed,true);assert.equal(replay.state.data.stockMoves.length,2);
 await assert.rejects(rpc(7,[{...lines[0],after:999},lines[1]]),/IDEMPOTENCY_CONFLICT/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);await assert.rejects(rpc(),/OWNER_REQUIRED/);
 await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(rpc(),/permission denied/);
 await db.close();console.log('PASS: intelligence count fixture');
})().catch(e=>{console.error(e);process.exitCode=1});
