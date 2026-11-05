const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const html=readFileSync('index.html','utf8');
const start=html.indexOf('/* V1.9.135 — sessão Supabase persistida');
const end=html.indexOf("['click','touchstart','keydown'].forEach",start);
assert.ok(start>=0&&end>start,'O bloqueio local V1.9.135 está disponível');
const source=html.slice(start,end);
assert.doesNotMatch(html,/#lockScreen\s*\{\s*display\s*:\s*none\s*!important/,'O ecrã de bloqueio não pode estar oculto por CSS');
assert.match(html,/id="lockScreen"/);
assert.match(html,/id="cloudUnlockPasswordV19135"/);
assert.match(html,/id="unlockBiometricButtonV19135"/);

function setup({offline=false,identityMismatch=false,passkey=false}={}){
 const elements=new Map(),events=[],listeners={};
 function el(id){
  if(!elements.has(id))elements.set(id,{
   value:'',disabled:false,textContent:'',inert:false,
   classList:{
    entries:new Set(),
    add(x){this.entries.add(x)},
    remove(x){this.entries.delete(x)},
    contains(x){return this.entries.has(x)},
    toggle(x,force){if(force)this.entries.add(x);else this.entries.delete(x)}
   },
   focus:()=>{}
  });
  return elements.get(id);
 }
 el('authGateV1880').classList.add('hidden');
 const user={id:'account-id',email:'owner@example.test'};
 const client={auth:{
  signInWithPassword:async ({password})=>{
   events.push('password-validation');
   if(password!=='correct-password')return {data:null,error:Error('Password incorrect')};
   return {data:{user:identityMismatch?{id:'other-id'}:user},error:null};
  },
  signInWithPasskey:async()=>{
   events.push('passkey-validation');
   return {data:{user,session:{access_token:'validated-token'}},error:null};
  }
 }};
 const ctx={
  document:{getElementById:el,querySelector:s=>s==='.app'?el('app'):null,
   addEventListener:(name,callback)=>{listeners[name]=callback},visibilityState:'visible'},
  window:{addEventListener:(name,callback)=>{listeners['window:'+name]=callback}},
  navigator:{onLine:!offline},
  location:{protocol:'https:',hostname:'art-essencia.vercel.app'},
  cloudUser:user,cloudClient:client,PASSKEY_PREVIEW_V20261008:true,
  sec:()=>({pinHash:'example-hash',lockMinutes:0}),
  idleTimer:null,unlocked:true,
  setTimeout:()=>0,clearTimeout:()=>{},
  localStorage:{setItem:()=>{}},SEC:'sec',
  hashPin:async()=>'',initCloudClient:()=>client,
  boundedCloudAuthV19134:fn=>fn(),
  attachCloudAuthListenerV19134:()=>events.push('listener'),
  Date,Math,Number,String,Object,Promise,Error
 };
 vm.createContext(ctx);
 vm.runInContext(source,ctx);
 return {ctx,el,events,listeners};
}
test('A aplicação inicia bloqueada e com o conteúdo inerte',()=>{
 const {ctx,el}=setup();
 ctx.configureLock();
 assert.equal(ctx.unlocked,false);
 assert.equal(el('app').inert,true);
 assert.equal(el('lockScreen').classList.contains('hidden'),false);
});
test('Palavra-passe errada não desbloqueia',async()=>{
 const {ctx,el}=setup();
 ctx.configureLock();
 el('cloudUnlockPasswordV19135').value='wrong-password';
 assert.equal(await ctx.unlockWithCloudPasswordV19135(),false);
 assert.equal(ctx.unlocked,false);
 assert.equal(el('app').inert,true);
});
test('Palavra-passe confirmada da mesma conta desbloqueia',async()=>{
 const {ctx,el,events}=setup();
 ctx.configureLock();
 el('cloudUnlockPasswordV19135').value='correct-password';
 assert.equal(await ctx.unlockWithCloudPasswordV19135(),true);
 assert.equal(ctx.unlocked,true);
 assert.equal(el('app').inert,false);
 assert.equal(el('lockScreen').classList.contains('hidden'),true);
 assert.ok(events.includes('password-validation'));
});
test('Palavra-passe de outra conta não desbloqueia',async()=>{
 const {ctx,el}=setup({identityMismatch:true});
 ctx.configureLock();
 el('cloudUnlockPasswordV19135').value='correct-password';
 assert.equal(await ctx.unlockWithCloudPasswordV19135(),false);
 assert.equal(ctx.unlocked,false);
});
test('Sem Internet, a palavra-passe não é aceite localmente',async()=>{
 const {ctx,el,events}=setup({offline:true});
 ctx.configureLock();
 el('cloudUnlockPasswordV19135').value='correct-password';
 assert.equal(await ctx.unlockWithCloudPasswordV19135(),false);
 assert.equal(ctx.unlocked,false);
 assert.ok(!events.includes('password-validation'));
});
test('Passkey válida da mesma conta desbloqueia',async()=>{
 const {ctx,el,events}=setup();
 ctx.configureLock();
 assert.equal(await ctx.unlockWithBiometricsV19135(),true);
 assert.equal(ctx.unlocked,true);
 assert.ok(events.includes('passkey-validation'));
 assert.equal(el('lockScreen').classList.contains('hidden'),true);
});
test('Ausência prolongada volta a bloquear a interface',()=>{
 const {ctx,el,listeners}=setup();
 ctx.configureLock();
 assert.ok(listeners.visibilitychange);
 assert.ok(listeners['window:pagehide']);
 listeners['window:pagehide']();
 assert.equal(ctx.unlocked,false);
 assert.equal(el('lockScreen').classList.contains('hidden'),false);
});
