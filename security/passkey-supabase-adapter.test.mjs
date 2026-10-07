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
  getUser:async()=>({data:{user:{id:'u'}}}),
  registerPasskey:async()=>{invoked=true;return {data:{id:'p'}}},
  signInWithPasskey:async()=>({})
 }})});
 await assert.rejects(a.register(),/conta confirmada/);assert.equal(invoked,false);
});
