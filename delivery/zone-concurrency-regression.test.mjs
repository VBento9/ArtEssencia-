import assert from 'node:assert/strict';
import { makeZoneCloudSnapshot,planZoneCloudSave } from './zone-cloud-plan.mjs';

// Simula dois dispositivos com versões da mesma configuração: a Cloud só
// pode aceitar atualização de zonas se o estado de partida continuar atual.
const base={localDeliveryFee:3,allowedWeekdays:[0,1],deliveryZoneConfig:{enabled:false,headquarters:'Castelejo',zones:[]}};
const snapshot=makeZoneCloudSnapshot(base);
const draft={enabled:false,headquarters:'Castelejo',zones:[{name:'Donas',enabled:true,feeCents:300,postalCodes:['6230-170']}]};
const updated=planZoneCloudSave(base,snapshot,draft);
assert.equal(updated.deliveryZoneConfig.zones.length,1);
assert.throws(()=>planZoneCloudSave(updated,snapshot,draft),/remote settings changed/);

// Documenta a falha a prevenir: full-state push, mesmo com controlo de revisão,
// pode enviar uma fotografia sem a nova chave se ignorar a revisão recebida.
const staleFullState={settings:{shopDelivery:base}};
const currentFullState={settings:{shopDelivery:updated}};
assert.equal(staleFullState.settings.shopDelivery.deliveryZoneConfig.zones.length,0);
assert.equal(currentFullState.settings.shopDelivery.deliveryZoneConfig.zones.length,1);
assert.notDeepEqual(staleFullState,currentFullState);
// Critério de integração: cloud push tem de rejeitar a revisão antiga e
// reidratar a versão nova antes de voltar a escrever.
console.log('Cenário de dois dispositivos documentado; testes SQL reais pendentes');
