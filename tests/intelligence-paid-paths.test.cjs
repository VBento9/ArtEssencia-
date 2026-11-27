'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {generate,createLegacyService}=require('../intelligence/legacy-ai.cjs');
const providerFactory=require('../intelligence/responses-provider.cjs');
const fs=require('node:fs');

test('Legacy and mission endpoints have one paid transport and release is disabled',async()=>{
  for(const [file,channel] of Object.entries({'digital-insights-ai':'insights','product-description-ai':'description','social-ai':'social'})){
    const source=fs.readFileSync('api/'+file+'.js','utf8');
    assert.ok(source.includes("legacyAi.generate('legacy_"+channel+"'"));
    assert.doesNotMatch(source,/OPENAI_API_KEY|api\.openai\.com/);
    await assert.rejects(generate('legacy_'+channel,{},randomUUID()),/suspens/);
  }
});

test('All three legacy flows settle verified usage before returning provider output',async()=>{
  const model='fixture.1',rate={model,verified:true,current:true,toolsEnabled:false,contextLimit:1000,maxInputTokens:1000,maxOutputTokens:100,inputRate:2e6,outputRate:4e6,grossBps:12300};
  const events=[];
  let reservation;
  const run=createLegacyService({pricing:async()=>rate,permitted:async agent=>['marketing','catalogo'].includes(agent),
    ledger:{reserve:async r=>{events.push(r.channel);reservation=r;return {...r,status:'reserved'};},
      claim:async()=>({...reservation,status:'inflight'}),settle:async r=>{events.push('settled');return {...r,status:'settled',overrun:false};}},
    provider:providerFactory('synthetic',async(url,options)=>{
      assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');
      assert.equal(JSON.parse(options.body).store,false);
      return {ok:true,json:async()=>({id:randomUUID(),model,status:'completed',usage:{input_tokens:50,output_tokens:15},output:[{type:'message',content:[{type:'output_text',text:'Resposta de teste'}]}]})};})});
  for(const channel of ['legacy_insights','legacy_description','legacy_social']){
    const output=await run(channel,{max_output_tokens:90,input:'Teste'},randomUUID());
    assert.equal(output.text,'Resposta de teste');
  }
  assert.deepEqual(events,['legacy_insights','settled','legacy_description','settled','legacy_social','settled']);
});

test('Canonical financial formulas and production material calculation match the Backoffice',()=>{
  const html=fs.readFileSync('index.html','utf8'),finance=fs.readFileSync('intelligence/finance-context.cjs','utf8');
  for(const match of finance.matchAll(/^function (\w+)\(/gm)){
    const a=match.index,first=finance.slice(a).split('\n')[0];
    const body=first.endsWith('}')?first:finance.slice(a,finance.indexOf('\n}',a)+2);
    assert.ok(html.includes(body),match[1]);
  }
  const production=fs.readFileSync('sql/complete-production-backoffice-v1.sql','utf8');
  const part=production.slice(production.indexOf("   order_needs := '{}';"),production.indexOf('   expected_order_materials:='));
  assert.ok(part.length>1000 && fs.readFileSync('sql/intelligence-department-context-v1.sql','utf8').includes(part));
});

test('Account approval requires current tax, FX, infrastructure envelope and recharge evidence',()=>{
 const approved=require('../intelligence/approved-pricing.cjs');
 const now=new Date('2026-11-27T12:00:00Z');
 const p={model:'gpt-5.4-mini-2026-03-17',checkedAt:'2026-11-27T11:00:00Z',validUntil:'2026-11-28T11:00:00Z',evidenceRef:'fixture',autoRechargeOff:true,
  dedicatedKeyVerified:true,usageReconciled:true,infrastructureVerified:true,otherGrossMonthlyUpperMicroeur:7000000,grossBps:12300,eurPerUsdUpperPpm:1040000,inputMicroUsdPerMillion:750000,outputMicroUsdPerMillion:4500000};
 const read=over=>approved({INTELLIGENCE_FINANCIAL_APPROVAL:JSON.stringify({...p,...over})},now);
 assert.equal(read({})[p.model].outputRate,4680000);
 for(const over of [{validUntil:now.toISOString()},{inputMicroUsdPerMillion:0},{autoRechargeOff:false},{otherGrossMonthlyUpperMicroeur:7000001},{model:'other'},{usageReconciled:false}])assert.throws(()=>read(over));
});

test('Owner verification and public product photos stay in the configured worker project',async()=>{
 const w=require('../intelligence/worker-transport.cjs');
 const base='https://abcdefghijklmnopqrst.supabase.co',env={INTELLIGENCE_SUPABASE_URL:base,INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'fixture-public'};
 const id='00000000-0000-0000-0000-000000000001',urls=[];
 const request=async(url,options)=>{urls.push(url);assert.equal(options.redirect,'error');assert.equal(options.headers.apikey,'fixture-public');return {ok:true,json:async()=>url.endsWith('/user')?{id}:true};};
 assert.equal(await w.ownerSession({headers:{authorization:'Bearer fixture'}},{env,request}),id);
 assert.deepEqual(urls,[base+'/auth/v1/user',base+'/rest/v1/rpc/artessencia_is_owner_v1']);
 assert.equal(await w.ownerSession({headers:{authorization:'Bearer fixture'}},{env,request:async()=>({ok:false})}),null);
 await assert.rejects(w.ownerSession({headers:{authorization:'Bearer fixture'}},{env:{},request}),/Projeto/);
 const path='/storage/v1/object/public/artessencia-shop/photo.jpg';
 assert.equal(w.publicProductPhoto(base+path,env),base+path);
 assert.equal(w.publicProductPhoto('https://ihtsonqnnlrxvorfrarl.supabase.co'+path,env),'');
 assert.equal(w.publicProductPhoto(base+path+'?secret=1',env),'');
 assert.equal(w.publicProductPhoto('https://example.org/'+path,env),'');
 const server=require('../intelligence/server-runtime.cjs');
 assert.throws(()=>server.compose({env:{...env,VERCEL_ENV:'preview',INTELLIGENCE_PAID_RELEASE:'approved'}}),/Faturação suspensa/);
 for(const file of ['digital-insights-ai','product-description-ai','social-ai','intelligence-worker']){
  const source=fs.readFileSync('api/'+file+'.js','utf8');
  assert.ok(source.includes('workerTransport.ownerSession(req)'));
  assert.doesNotMatch(source,/ihtsonqnnlrxvorfrarl\.supabase\.co/);
 }
});

test('Hosted simulation is isolated and cannot activate paid model paths',async()=>{
 const server=require('../intelligence/server-runtime.cjs');
 const base='https://abcdefghijklmnopqrst.supabase.co';
 const env={VERCEL_ENV:'preview',INTELLIGENCE_EXECUTION_MODE:'simulation',INTELLIGENCE_SUPABASE_URL:base,INTELLIGENCE_ISOLATED_PROJECT_URL:base};
 assert.equal(server.hostedMode(env),'simulation');
 for(const change of [{VERCEL_ENV:'production'},{INTELLIGENCE_ISOLATED_PROJECT_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co'},
 {INTELLIGENCE_SUPABASE_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co',INTELLIGENCE_ISOLATED_PROJECT_URL:'https://ihtsonqnnlrxvorfrarl.supabase.co'},
 {INTELLIGENCE_SUPABASE_URL:'https://oosumysibccagrfbomab.supabase.co',INTELLIGENCE_ISOLATED_PROJECT_URL:'https://oosumysibccagrfbomab.supabase.co'},
 {INTELLIGENCE_PAID_RELEASE:'approved'},{OPENAI_API_KEY:'not-used'},{INTELLIGENCE_FINANCIAL_APPROVAL:'{}'}])
 assert.throws(()=>server.hostedMode({...env,...change}));
 await assert.rejects(server.composeHosted({env,call:async()=>false}),/Base de ensaio/);
 const calls=[];
 const runtime=await server.composeHosted({env,call:async(action)=>{calls.push(action);return true;}});
 assert.equal(runtime.mode,'simulation');
 assert.throws(()=>server.runLegacy(runtime,'legacy_social',{},randomUUID()),/indisponível/);
 const result=await runtime.provider({model:runtime.pricing().model,store:false,input:[{content:'Coordena departamentos e distribui trabalho.'},{content:JSON.stringify({context:JSON.stringify({evidenceIds:['fixture']})})}]});
 assert.deepEqual(result.usage,{input_tokens:0,output_tokens:0});
 assert.equal(JSON.parse(result.text).delegations[0].agent,'stock');
 assert.deepEqual(calls,['simulation_identity']);
});
