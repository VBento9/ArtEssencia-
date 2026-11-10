const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const html=readFileSync('index.html','utf8');
const start=html.indexOf('async function resumeAuthenticatedCloudV19133(){');
const end=html.indexOf('function mergeRemoteRelationalRow(',start);
assert.ok(start>=0&&end>start,'O código de recuperação da sessão existe');
const source=html.slice(start,end);

function setup({session,validUser,offline=false,failSync=false}={}){
 const events=[],inputs={
  authGateEmailV1880:{value:'atelier@example.test'},
  authGatePasswordV1880:{value:'example-password'},
  authGateButtonV1880:{disabled:false,textContent:'Entrar'}
 };
 const user={id:'valid-user',email:'atelier@example.test'};
 const auth={
  getSession:async()=>{events.push('getSession');return {data:{session:session===undefined?{user,access_token:'token',expires_at:Math.floor(Date.now()/1000)+3600}:session},error:null}},
  getUser:async()=>{events.push('getUser');return {data:{user:validUser===undefined?user:validUser},error:null}},
  signInWithPassword:async()=>{events.push('signInWithPassword');return {data:{user},error:null}}
 };
 const ctx={
  console,Date,Math,Number,String,Object,Promise,
  cloudUser:null,cloudStartupDone:false,cloudHydrating:false,
  cloudValidationStartedV19129:0,cloudValidationStageV19131:'',cloudValidationFailureV19131:'',
  cloudStartup:async()=>{events.push('cloudStartup');if(failSync)throw Error('falha da receção');return true},
  cloudErrText:e=>e.message,cloudLogMsg:s=>events.push('log:'+s),
  setCloudMeta:patch=>events.push('meta:'+JSON.stringify(patch)),
  renderCloudUI:()=>events.push('renderCloudUI'),
  initCloudClient:()=>({auth}),
  attachCloudAuthListenerV19134:()=>events.push('attachAuthListener'),
  boundedCloudAuthV19134:async action=>action(),
  // Entry-lock helpers added in 1.9.135 are exercised separately in app-entry-lock-19135.
  refreshLockMethodsV19135:()=>events.push('refreshLockMethods'),
  finishAppUnlockV19135:()=>events.push('finishUnlock'),
  authGateHideV1880:()=>events.push('hide'),
  authGateShowV1880:()=>events.push('show'),
  authGateMessageV1880:()=>{},
  navigator:{onLine:!offline},
  cloudCfg:()=>({email:'atelier@example.test'}),
  localStorage:{setItem:()=>{}},CLOUD_CFG:'cfg',
  document:{getElementById:id=>inputs[id]||null}
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,events,inputs};
}
test('Recarregar com sessão válida restaura Auth e retoma a Cloud',async()=>{
 const {ctx,events}=setup();
 assert.equal(await ctx.authGateStartupV1880(),true);
 assert.equal(ctx.cloudUser.id,'valid-user');
 assert.deepEqual(events.filter(x=>['getSession','getUser','cloudStartup','hide','show'].includes(x)),['getSession','getUser','hide','cloudStartup']);
});
test('Sem sessão guardada mantém o ecrã de entrada',async()=>{
 const {ctx,events}=setup({session:null});
 assert.equal(await ctx.authGateStartupV1880(),false);
 assert.ok(events.includes('show'));
 assert.ok(!events.includes('cloudStartup'));
});
test('Identidade divergente não restaura a sessão',async()=>{
 const {ctx,events}=setup({validUser:{id:'different-user'}});
 assert.equal(await ctx.authGateStartupV1880(),false);
 assert.equal(ctx.cloudUser,null);
 assert.ok(events.includes('show'));
});
test('Sessão offline não expirada preserva acesso local sem alegar sincronização',async()=>{
 const {ctx,events}=setup({offline:true});
 assert.equal(await ctx.authGateStartupV1880(),true);
 assert.equal(ctx.cloudStartupDone,true);
 assert.ok(events.includes('hide'));
 assert.ok(!events.includes('getUser'));
 assert.ok(!events.includes('cloudStartup'));
});
test('Erro de sincronização não invalida a sessão Auth recuperada',async()=>{
 const {ctx,events}=setup({failSync:true});
 assert.equal(await ctx.authGateStartupV1880(),false);
 assert.equal(ctx.cloudUser.id,'valid-user');
 assert.ok(events.includes('hide'));
 assert.ok(!events.includes('show'));
 assert.match(ctx.cloudValidationFailureV19131,/falha da receção/);
});
test('Palavra-passe correta mantém sessão mesmo se a sincronização falhar',async()=>{
 const {ctx,events,inputs}=setup({failSync:true});
 assert.equal(await ctx.authGateLoginV1880(),false);
 assert.equal(ctx.cloudUser.id,'valid-user');
 assert.ok(events.includes('hide'));
 assert.ok(!events.includes('show'));
 assert.equal(inputs.authGateButtonV1880.disabled,false);
 assert.equal(inputs.authGatePasswordV1880.value,'');
});
