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
    await assert.rejects(generate('legacy_'+channel,{},randomUUID()),/suspenso/);
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
