import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const match=(pattern,label)=>assert.match(html,pattern,label);

test('biometria bloqueada por defeito',()=>{
 match(/const PASSKEY_PREVIEW_V20261008=false\s*;/,'feature flag segura');
 match(/if\(!PASSKEY_PREVIEW_V20261008\)return;/,'guarda na ação biométrica');
});
test('Passkey utiliza o cliente Cloud existente, sem novo cliente',()=>{
 const fn=html.split('async function authGatePasskeyLoginV20261008(){')[1]?.split('async function authGateLoginV1880()')[0];
 assert.ok(fn,'função de login biométrico');
 assert.match(fn,/const c=initCloudClient\(\)/);
 assert.doesNotMatch(fn,/createClient\s*\(/);
 assert.match(fn,/c\.auth\.signInWithPasskey\(\)/);
 assert.match(fn,/await cloudStartup\(\)/);
});
test('login atual e sincronização mantidos',()=>{
 match(/async function authGateLoginV1880\(\)/,'login por palavra-passe');
 match(/c\.auth\.signInWithPassword\(\{email,password\}\)/,'password auth');
 match(/async function cloudStartup\(\)/,'arranque Cloud');
 match(/async function cloudDisconnect\(\)/,'logout Cloud');
 match(/async function ensureCloudSession\(\)/,'sessão Cloud');
});
test('botão biométrico oculto e login por palavra-passe visível',()=>{
 match(/id="authGatePasskeyV20261008" class="btn hidden"/,'botão biométrico oculto');
 match(/id="authGateButtonV1880" class="btn primary"/,'botão de palavra-passe');
});
test('cliente Cloud preserva sessão persistente e refresh',()=>{
 match(/persistSession:true,autoRefreshToken:true,detectSessionInUrl:true/,'configuração original');
});

test('SDK Supabase fixado para suporte a Passkeys',()=>{
 match(/supabase-js@2[.]105[.]0\/dist\/umd\/supabase[.]min[.]js/,'SDK compatível');
});
test('registo protegido por sessão, identidade e domínio',()=>{
 const fn=html.split('async function registerCloudPasskeyV20261008(){')[1]?.split('async function authGatePasskeyLoginV20261008(){')[0];
 assert.ok(fn,'registo implementado');
 for(const pattern of [/PASSKEY_PREVIEW_V20261008/,/location[.]hostname!=='art-essencia[.]vercel[.]app'/,/initCloudClient\(\)/,/auth[.]getSession\(\)/,/auth[.]getUser\(\)/,/auth[.]registerPasskey\(\)/])assert.match(fn,pattern);
 assert.doesNotMatch(fn,/createClient\(/);
 match(/id="cloudPasskeyRegisterV20261008" class="btn hidden"/,'registo oculto');
});

test('botão de registo visível apenas com sessão, SDK e origem válidos',()=>{
 match(/passkeyEnroll[.]classList[.]toggle\('hidden',!\(PASSKEY_PREVIEW_V20261008&&!!cloudUser/,'sessão necessária');
 match(/typeof cloudClient[?][.]auth[?][.]registerPasskey==='function'/,'SDK necessário');
});
test('login biométrico bloqueado em origem de pré-visualização',()=>{
 const fn=html.split('async function authGatePasskeyLoginV20261008(){')[1]?.split('async function authGateLoginV1880()')[0];
 assert.match(fn,/location[.]hostname!=='art-essencia[.]vercel[.]app'/);
});
