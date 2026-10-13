import assert from 'node:assert/strict';
import { readDeliveryZoneConfig, prepareDeliveryZoneConfig } from './zone-config.mjs';

// Modela o resultado exigido à RPC v2: só confirma a gravação quando a revisão
// da Cloud é a mesma que foi lida no dispositivo.
function simulateDeliverySave(remote, expectedRevision, incoming) {
  if (remote.revision !== expectedRevision) throw new Error('cloud_revision_conflict');
  if (JSON.stringify(remote.shopDelivery) !== JSON.stringify(remote.shopSettingsDelivery))
    throw new Error('delivery sources diverged');
  const zone = remote.shopSettingsDelivery.deliveryZoneConfig;
  const merged = { ...incoming };
  delete merged.deliveryZoneConfig;
  if (zone !== undefined) merged.deliveryZoneConfig = structuredClone(zone);
  return { revision: remote.revision + 1, shopDelivery: merged, shopSettingsDelivery: structuredClone(merged) };
}

const zones = prepareDeliveryZoneConfig({
  enabled:false, headquarters:'Castelejo', zones:[
    {name:'Donas',enabled:true,feeCents:300,postalCodes:['6230-170']}
  ]
});
const before = {
  revision:12,
  shopDelivery:{pickupEnabled:false,localDeliveryFee:3,allowedWeekdays:[0,1],deliveryZoneConfig:zones},
  shopSettingsDelivery:{pickupEnabled:false,localDeliveryFee:3,allowedWeekdays:[0,1],deliveryZoneConfig:zones}
};
const oldClient = {pickupEnabled:false,localDeliveryFee:4,allowedWeekdays:[0,1]};
const after = simulateDeliverySave(before,12,oldClient);
assert.equal(after.revision,13);
assert.deepEqual(readDeliveryZoneConfig(after.shopDelivery),zones);
assert.deepEqual(after.shopDelivery,after.shopSettingsDelivery);
assert.equal(after.shopDelivery.localDeliveryFee,4);
assert.throws(()=>simulateDeliverySave(after,12,oldClient),/cloud_revision_conflict/);
assert.throws(()=>simulateDeliverySave({...before,shopSettingsDelivery:{}},12,oldClient),/sources diverged/);
assert.equal(before.shopDelivery.localDeliveryFee,3);
console.log('Contratos simulados da RPC v2: aprovados (não equivalem a testes SQL)');
