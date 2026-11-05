const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('let cloudAuthListenerClientV19134=null;');
const end=html.indexOf('function cloudStateQuery()',start);
assert.ok(start>=0&&end>start,'Funções da inicialização Auth 1.9.134');
const source=html.slice(start,end);

function setup(){
 const events=[],tasks=[];
 let authListener=null;
 const client={
  auth:{onAuthStateChange:callback=>{events.push('subscribe');authListener=callback}},
  from:()=>({})
 };
 const ctx={
  window:{supabase:{createClient:()=>{events.push('create');return client}}},
  PASSKEY_PREVIEW_V20261008:false,
  cloudClient:null,cloudUser:null,cloudStartupDone:true,cloudHydrating:false,cloudChannel:null,cloudPushPending:false,
  cloudCfg:()=>({url:'https://fake.supabase.test',key:'publishable-test'}),
  cloudLogMsg:()=>{},renderCloudUI:()=>events.push('render'),
  lockNow:()=>events.push('lock'),authGateShowV1880:()=>events.push('authGate'),
  subscribeCloud:async()=>events.push('subscribeCloud'),
  cloudMeta:()=>({dirty:false,conflict:false}),
  localStorage:{getItem:()=>null},REL_DIRTY:'dirty',
  hasRestorePendingV12645:()=>false,scheduleCloudPushV1860:()=>events.push('push'),
  setTimeout:fn=>{tasks.push(fn);return tasks.length},clearTimeout:()=>{},
  Promise,Math,Date,Error,Object
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,events,client,tasks,getListener:()=>authListener};
}

test('Cliente Supabase não subscreve Auth antes de getSession/getUser',()=>{
 const {ctx,events}=setup();
 const client=ctx.initCloudClient();
 assert.ok(client);
 assert.deepEqual(events,['create']);
});

test('Listener é instalado apenas uma vez depois da validação da sessão',()=>{
 const {ctx,events,client}=setup();
 ctx.initCloudClient();
 ctx.attachCloudAuthListenerV19134(client);
 ctx.attachCloudAuthListenerV19134(client);
 assert.deepEqual(events,['create','subscribe']);
});

test('Evento Auth não renderiza nem faz chamadas Cloud dentro do callback',()=>{
 const {ctx,events,client,tasks,getListener}=setup();
 ctx.initCloudClient();
 ctx.attachCloudAuthListenerV19134(client);
 getListener()('SIGNED_IN',{user:{id:'owner'}});
 assert.deepEqual(events,['create','subscribe']);
 assert.equal(tasks.length,1);
 tasks.shift()();
 assert.equal(ctx.cloudUser.id,'owner');
 assert.ok(events.includes('render'));
 assert.ok(events.includes('subscribeCloud'));
});

test('Sem sessão, não marca utilizador autenticado no evento SIGNED_OUT',()=>{
 const {ctx,client,tasks,getListener}=setup();
 ctx.initCloudClient();
 ctx.attachCloudAuthListenerV19134(client);
 ctx.cloudUser={id:'owner'};
 getListener()('SIGNED_OUT',null);
 tasks.shift()();
 assert.equal(ctx.cloudUser,null);
 assert.ok(events.includes('lock'));
 assert.ok(events.includes('authGate'));
});
