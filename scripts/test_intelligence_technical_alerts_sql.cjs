'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {fixture}=require('./test_intelligence_meetings_sql.cjs');
const ns='artessencia_intelligence_private',owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function run(){
 const {db,login}=await fixture({postgres:process.argv.includes('--postgres')});
 const rpc=async()=>(await db.query('SELECT public.artessencia_intelligence_technical_alerts_v1() data')).rows[0].data;
 try{
  await db.exec('RESET ROLE');
  // A minimal canonical products fixture if the existing test harness does not define it.
  await db.exec("CREATE TABLE IF NOT EXISTS public.artessencia_v1_products(id uuid PRIMARY KEY,user_id uuid,data jsonb,updated_at timestamptz DEFAULT now());");
  await db.exec(fs.readFileSync('sql/intelligence-technical-alerts-v1.sql','utf8'));
  await db.query(`UPDATE ${ns}.team_controls SET enabled=true,modes=jsonb_set(jsonb_set(modes,'{producao}','"semi"'),'{director}','"semi"') WHERE user_id=$1`,[owner]);
  const examples=[['A','Vela aromática','Velas em recipiente'],['B','Vela sem fragrância','Velas em molde'],['C','Vela','Velas em molde'],['D','Vela aromática','Velas em molde'],['E','Vela','Velas em molde'],['F','Wax melt','Wax melts'],['G','Resina','Resina Acrílica'],['H','Vela aromática','Velas em molde']];
  for(let i=0;i<examples.length;i++){
   const [code,name,category]=examples[i];
   await db.query('INSERT INTO public.artessencia_v1_products(id,user_id,data,updated_at) VALUES($1,$2,$3,now())',[id(100+i),owner,JSON.stringify({code,name,category,manufactured:true,archivedV1803:code==='H'})]);
  }
  const wax=[{item:'Cera soja',qty:100}],scent=[...wax,{item:'Fragrância Artficium',qty:8}],invalid=[...wax,{item:'Fragrância Artficium',qty:0}];
  const recipes={A:wax,B:wax,C:wax,D:scent,E:[],F:invalid,G:[],H:wax};
  await db.query("UPDATE public.artessencia_v1_state SET data=jsonb_set(data,'{productRecipes}',$2::jsonb,true) WHERE user_id=$1",[owner,JSON.stringify(recipes)]);
  const before=(await db.query("SELECT data,revision FROM public.artessencia_v1_state WHERE user_id=$1",[owner])).rows;
  const ledger=(await db.query(`SELECT * FROM ${ns}.ai_budget_control`)).rows;
  await login(other);await assert.rejects(rpc(),/OWNER_REQUIRED/);await login();
  const result=await rpc();assert.equal(result.status,'ready');assert.equal(result.checked,6);assert.equal(result.total,4);
  assert.deepEqual(Object.fromEntries(result.alerts.map(x=>[x.code,x.kind])),{A:'probable_missing_fragrance',C:'confirm_unscented_intent',E:'missing_recipe',F:'invalid_fragrance_quantity'});
  assert.ok(result.alerts.every(x=>x.requiresApproval&&x.agent==='producao'&&x.coordinator==='director'));
  await db.exec('RESET ROLE');assert.deepEqual((await db.query("SELECT data,revision FROM public.artessencia_v1_state WHERE user_id=$1",[owner])).rows,before);
  assert.deepEqual((await db.query(`SELECT * FROM ${ns}.ai_budget_control`)).rows,ledger);
  recipes.A=scent;await db.query("UPDATE public.artessencia_v1_state SET data=jsonb_set(data,'{productRecipes}',$2::jsonb,true) WHERE user_id=$1",[owner,JSON.stringify(recipes)]);
  await login();assert.equal((await rpc()).total,3);
  console.log('PASS: scented missing material, unscented intent, blank recipe, invalid quantity, archived exclusion, correction recheck, owner scope and no writes');
 }finally{await db.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
