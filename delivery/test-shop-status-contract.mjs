// Testes isolados do contrato de estados da Loja (sem Supabase, sem efeitos reais).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function saveLegacyStatus(current, patch) {
  if (!current || typeof current !== 'object') throw Error('missing status');
  if (Object.keys(patch).some(k => !['enabled','accepting_orders'].includes(k))) throw Error('unexpected fields');
  const enabled = patch.enabled === true, accepting = patch.accepting_orders === true;
  if (accepting && !enabled) throw Error('invalid state');
  if (['updating','closed'].includes(current.mode) && (enabled || accepting)) throw Error('blocked');
  return {...current, enabled, accepting_orders:accepting};
}
function saveChannelStatus(current, mode, message, pickupOrDelivery) {
  if (!['open','updating','closed'].includes(mode)) throw Error('invalid mode');
  if (mode === 'open' && !pickupOrDelivery) throw Error('no fulfillment');
  return {...current,mode,public_message:message,enabled:mode==='open',accepting_orders:mode==='open'};
}
function shopAllowsOrder(s) {
  return s?.enabled===true && s?.accepting_orders===true &&
     !['updating','closed'].includes(String(s?.mode??'').toLowerCase());
}
let count=0;
function check(name,fn){fn();count++;console.log('APROVADO:',name)}
const base={mode:'updating',enabled:false,accepting_orders:false,public_message:'Em atualização',tracking:'preservar',deliveryZoneConfig:{enabled:false}};
check('guardar legado sem perder mode nem mensagem',()=>{let v=saveLegacyStatus(base,{enabled:false,accepting_orders:false});assert.deepEqual(v,base)});
check('bloquear reabertura involuntária em updating',()=>assert.throws(()=>saveLegacyStatus(base,{enabled:true,accepting_orders:true})));
check('bloquear reabertura involuntária em closed',()=>assert.throws(()=>saveLegacyStatus({...base,mode:'closed'},{enabled:true,accepting_orders:false})));
check('rejeitar campos desconhecidos',()=>assert.throws(()=>saveLegacyStatus(base,{enabled:false,mode:'open'})));
check('preservar propriedades extra após transição de modo',()=>{let x=saveChannelStatus(base,'closed','Até breve',false);assert.equal(x.tracking,'preservar');assert.deepEqual(x.deliveryZoneConfig,base.deliveryZoneConfig)});
check('não abrir sem levantamento ou entrega',()=>assert.throws(()=>saveChannelStatus(base,'open','',false)));
check('abrir quando configurado',()=>assert.equal(saveChannelStatus(base,'open','',true).accepting_orders,true));
check('checkout bloqueado em updating',()=>assert.equal(shopAllowsOrder({...base,enabled:true,accepting_orders:true}),false));
check('checkout bloqueado em closed',()=>assert.equal(shopAllowsOrder({...base,mode:'closed',enabled:true,accepting_orders:true}),false));
check('checkout permitido apenas em open válido',()=>assert.equal(shopAllowsOrder(saveChannelStatus(base,'open','',true)),true));
check('estado desconhecido não aceita compras sem flags',()=>assert.equal(shopAllowsOrder({mode:'indefinido'}),false));
console.log('CONCLUIDO:',count,'testes de lógica aprovados. As RPC reais necessitam de teste PostgreSQL separado.');
