'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serviceTransport,isolatedProjectUrl}=require('../intelligence/worker-transport.cjs');
const id='00000000-0000-0000-0000-000000000001';
const sid='00000000-0000-0000-0000-000000000002';
const env={VERCEL_ENV:'preview',INTELLIGENCE_EXECUTION_MODE:'simulation',
  INTELLIGENCE_SUPABASE_URL:isolatedProjectUrl,INTELLIGENCE_ISOLATED_PROJECT_URL:isolatedProjectUrl,
  INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY:'fixture-public',INTELLIGENCE_SERVICE_EMAIL:'executor@example.invalid',
  INTELLIGENCE_SERVICE_PASSWORD:'fixture-not-secret',INTELLIGENCE_SERVICE_USER_ID:id};
function fixture(){
  let now=1700000000000,gen=0;
  const calls=[];
  const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
  function token({sessionId=sid,sub=id,refresh=true}={}){
    gen++;
    const claims={role:'authenticated',sub,session_id:sessionId,exp:Math.floor(now/1000)+120};
    return {access_token:'fixture.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fixture',
      refresh_token:refresh?'refresh-'+gen:undefined,user:{id:sub}};
  }
  let onAuth=null,onRpc=null;
  const request=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,body,auth:options.headers.Authorization});
    assert.equal(options.redirect,'error');
    if(url.includes('/auth/v1/token?'))return onAuth?onAuth(url,body):reply(200,token());
    return onRpc?onRpc(body):reply(200,{ok:true});
  };
  return {calls,reply,token,request,advance:()=>{now+=61000},now:()=>now,
    setAuth:f=>{onAuth=f},setRpc:f=>{onRpc=f}};
}
async function withFixture(fn){
  const f=fixture(),original=Date.now;Date.now=f.now;
  try{await fn(f,serviceTransport(env,f.request));}finally{Date.now=original;}
}
test('concurrent requests share initial authentication and each refresh; refresh rotates',async()=>withFixture(async(f,call)=>{
  await Promise.all([call('next'),call('status'),call('identity')]);
  assert.equal(f.calls.filter(c=>c.url.includes('grant_type=password')).length,1);
  f.advance();
  await Promise.all([call('next'),call('status'),call('identity')]);
  const refreshes=()=>f.calls.filter(c=>c.url.includes('grant_type=refresh_token'));
  assert.equal(refreshes().length,1);assert.deepEqual(refreshes()[0].body,{refresh_token:'refresh-1'});
  f.advance();await call('identity');
  assert.equal(refreshes().length,2);assert.deepEqual(refreshes()[1].body,{refresh_token:'refresh-2'});
  assert.equal(f.calls.filter(c=>c.url.includes('grant_type=password')).length,1);
}));
test('revoked refresh token blocks further requests without relogin or mutation',async()=>withFixture(async(f,call)=>{
  await call('identity');f.advance();f.setAuth(()=>f.reply(401,{}));
  const results=await Promise.allSettled([call('finish'),call('finish')]);
  assert.ok(results.every(x=>x.status==='rejected'));
  await assert.rejects(call('finish'),/bloqueada/);
  assert.equal(f.calls.filter(c=>c.body.p_action==='finish').length,0);
  assert.equal(f.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
  assert.equal(f.calls.filter(c=>c.url.includes('grant_type=password')).length,1);
}));
test('ambiguous refresh, different session, and missing rotated token fail closed',async()=>{
  for(const failure of ['network','session','missing']){
    await withFixture(async(f,call)=>{
      await call('identity');f.advance();
      f.setAuth(()=>{if(failure==='network')throw Error('timeout');
        return f.reply(200,f.token(failure==='session'?{sessionId:'other'}:{refresh:false}));});
      await assert.rejects(call('finish'),/intervenção/);
      await assert.rejects(call('finish'),/bloqueada/);
      assert.equal(f.calls.filter(c=>c.body.p_action==='finish').length,0);
      assert.equal(f.calls.filter(c=>c.url.includes('grant_type=password')).length,1);
    });
  }
});
test('RPC revocation blocks the warm executor; no mutation is retried',async()=>withFixture(async(f,call)=>{
  await call('identity');f.setRpc(()=>f.reply(403,{}));
  await assert.rejects(call('finish'),/por confirmar/);
  await assert.rejects(call('finish'),/bloqueada/);
  assert.equal(f.calls.filter(c=>c.body.p_action==='finish').length,1);
}));
test('ambiguous mutation response does not trigger an automatic replay',async()=>{
  for(const failure of ['network','server','invalid-json']){
    await withFixture(async(f,call)=>{
      await call('identity');f.setRpc(()=>{if(failure==='network')throw Error('timeout');
        if(failure==='invalid-json')return {ok:true,json:async()=>{throw Error('invalid JSON')}};
        return f.reply(503,{});});
      await assert.rejects(call('finish'));
      assert.equal(f.calls.filter(c=>c.body.p_action==='finish').length,1);
      assert.equal(f.calls.filter(c=>c.url.includes('/auth/v1/token?')).length,1);
    });
  }
});
