import test from 'node:test';
import assert from 'node:assert/strict';
import {createPasskeyAdapter} from './passkey-supabase-adapter.js';

const settings={url:'https://example.supabase.co',publishableKey:'public-test-key'};
test('desativado por defeito: não inicializa SDK',()=>{
 let calls=0;
 const a=createPasskeyAdapter({...settings,createClient:()=>{calls++;throw Error('unexpected')}});
 assert.equal(a.enabled,false);assert.equal(calls,0);
});
test('não aceita SDK sem suporte Passkeys',()=>{
 assert.throws(()=>createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{}})}),/sem suporte/);
});
test('rejeita sessão inválida sem criar sessão local',async()=>{
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  registerPasskey:async()=>({}),signInWithPasskey:async()=>({data:{session:{access_token:'a'},user:{id:'u'}}})
 }})});
 await assert.rejects(a.signIn(),/sessão válida/);
});
test('devolve apenas sessão validada pela resposta Supabase',async()=>{
 const session={access_token:'a',refresh_token:'r'};
 const user={id:'u'};
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  registerPasskey:async()=>({}),signInWithPasskey:async()=>({data:{session,user}})
 }})});
 assert.deepEqual(await a.signIn(),{session,user});
});
test('registo requer utilizador autenticado e confirmado',async()=>{
 let invoked=false;
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  setSession:async()=>({data:{session:{access_token:'a'}}}),
  getUser:async()=>({data:{user:{id:'u'}}}),
  registerPasskey:async()=>{invoked=true;return {data:{id:'p'}}},
  signInWithPasskey:async()=>({})
 }})});
 await assert.rejects(a.register({access_token:'a',refresh_token:'r'}),/conta confirmada/);assert.equal(invoked,false);
});

test('registo sem token existente é bloqueado',async()=>{
 let invoked=false;
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  getUser:async()=>{invoked=true;return {data:{user:{id:'u'}}}},
  registerPasskey:async()=>({}),signInWithPasskey:async()=>({})
 }})});
 await assert.rejects(a.register(),/Sessão atual obrigatória/);
 assert.equal(invoked,false);
});

test('registo estabelece sessão antes de consultar utilizador',async()=>{
 const order=[];
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  setSession:async(v)=>{order.push('session');assert.equal(v.refresh_token,'r');return {data:{session:{access_token:'a'}}}},
  getUser:async()=>{order.push('user');return {data:{user:{id:'u',email_confirmed_at:'2026-01-01'}}}},
  registerPasskey:async()=>{order.push('passkey');return {data:{id:'p'}}},signInWithPasskey:async()=>({})
 }})});
 assert.deepEqual(await a.register({access_token:'a',refresh_token:'r'}),{id:'p'});
 assert.deepEqual(order,['session','user','passkey']);
});
test('erro ao estabelecer sessão bloqueia registo',async()=>{
 let registered=false;
 const a=createPasskeyAdapter({...settings,enabled:true,createClient:()=>({auth:{
  setSession:async()=>({error:new Error('invalid')}),
  getUser:async()=>({}),registerPasskey:async()=>{registered=true;return {}},signInWithPasskey:async()=>({})
 }})});
 await assert.rejects(a.register({access_token:'a',refresh_token:'r'}),/validar a sessão/);
 assert.equal(registered,false);
});
