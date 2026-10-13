import assert from 'node:assert/strict';
import {makeZoneCloudSnapshot,planZoneCloudSave} from './zone-cloud-plan.mjs';

const current={localDeliveryFee:3,postalPrefixes:['6230'],allowedWeekdays:[0,1],dateExceptions:[],deliveryZoneConfig:{enabled:false,headquarters:'Castelejo',zones:[]}};
const snapshot=makeZoneCloudSnapshot(current);
const draft={enabled:false,headquarters:'Castelejo',zones:[{name:'Donas',enabled:true,feeCents:300,postalCodes:['6230-170']}]};
const proposed=planZoneCloudSave(current,snapshot,draft);
assert.equal(proposed.localDeliveryFee,3);
assert.deepEqual(proposed.postalPrefixes,['6230']);
assert.deepEqual(proposed.allowedWeekdays,[0,1]);
assert.equal(proposed.deliveryZoneConfig.enabled,false);
assert.equal(proposed.deliveryZoneConfig.zones[0].feeCents,300);
assert.deepEqual(current.deliveryZoneConfig.zones,[]);
assert.throws(()=>planZoneCloudSave({...current,localDeliveryFee:4},snapshot,draft),/remote settings changed/);
const active={...current,deliveryZoneConfig:{enabled:true,headquarters:'Castelejo',zones:[]}};
assert.throws(()=>planZoneCloudSave(active,makeZoneCloudSnapshot(active),draft),/already active/);
assert.throws(()=>planZoneCloudSave(current,snapshot,{enabled:false,zones:[{name:'Donas',enabled:true,feeCents:-10,postalCodes:['6230-170']}]}));
console.log('Compatibilidade e conflitos: OK (sem escrita remota)');
