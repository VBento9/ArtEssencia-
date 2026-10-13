import { prepareDeliveryZoneConfig, readDeliveryZoneConfig } from './zone-config.mjs';

// Planeia a atualização, mas não escreve na Cloud.
// Se a fotografia remota tiver mudado, recusa a operação.
// Usa comparação conservadora do documento integral para evitar perda silenciosa de alterações.
function stable(value) {
  if (Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}

export function makeZoneCloudSnapshot(remoteShopDelivery) {
  if (!remoteShopDelivery || typeof remoteShopDelivery !== 'object' || Array.isArray(remoteShopDelivery)) throw new Error('invalid remote settings');
  return stable(remoteShopDelivery);
}

export function planZoneCloudSave(remoteShopDelivery, expectedSnapshot, draftConfig) {
  if (makeZoneCloudSnapshot(remoteShopDelivery) !== expectedSnapshot) throw new Error('remote settings changed; reload before saving');
  const normalized = prepareDeliveryZoneConfig({...draftConfig,enabled:false});
  const originalZoneState = readDeliveryZoneConfig(remoteShopDelivery);
  // Nunca reativar zonas por acidente.
  if (originalZoneState.enabled) throw new Error('remote zones already active; manual migration required');
  const proposed = {...remoteShopDelivery, deliveryZoneConfig: normalized};
  for (const key of Object.keys(remoteShopDelivery)) {
    if (key !== 'deliveryZoneConfig' && stable(proposed[key]) !== stable(remoteShopDelivery[key])) throw new Error('unexpected settings mutation');
  }
  return proposed;
}
