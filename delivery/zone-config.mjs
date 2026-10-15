import { normalizePostalCode, validateDeliveryZones, resolveLocalDelivery } from './zone-rules.mjs';

// Modelo de configuração separado da tarifa antiga.
// Enquanto enabled=false, nenhuma encomenda usa estas zonas.
export const DEFAULT_DELIVERY_ZONE_CONFIG = Object.freeze({
  enabled: false,
  headquarters: 'Castelejo',
  deliveryStart: null,
  deliveryEnd: null,
  zones: []
});

export function readDeliveryZoneConfig(shopDelivery) {
  const raw = shopDelivery?.deliveryZoneConfig;
  if (!raw || typeof raw !== 'object') return { enabled: false, headquarters: 'Castelejo', deliveryStart: null, deliveryEnd: null, zones: [] };
  return {
    enabled: raw.enabled === true,
    headquarters: typeof raw.headquarters === 'string' && raw.headquarters.trim() ? raw.headquarters.trim() : 'Castelejo',
    deliveryStart: raw.deliveryStart ?? null,
    deliveryEnd: raw.deliveryEnd ?? null,
    zones: Array.isArray(raw.zones) ? raw.zones.map(z => ({
      name: String(z?.name ?? '').trim(),
      enabled: z?.enabled === true,
      feeCents: z?.feeCents,
      postalCodes: Array.isArray(z?.postalCodes) ? [...z.postalCodes] : []
    })) : []
  };
}

export function prepareDeliveryZoneConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('invalid zone config');
  if (config.enabled !== false && config.enabled !== true) throw new Error('invalid activation flag');
  const normalized = validateDeliveryZones(config.zones);
  const names = new Set();
  for (const zone of normalized) {
    const nameKey = zone.name.toLocaleLowerCase('pt-PT');
    if (names.has(nameKey)) throw new Error('duplicate locality');
    names.add(nameKey);
  }
  if (config.enabled && !normalized.some(zone => zone.enabled)) throw new Error('no active delivery locality');
  const start=config.deliveryStart??null, end=config.deliveryEnd??null;
  const validTime=x=>typeof x==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
  if ((start!==null && !validTime(start)) || (end!==null && !validTime(end))) throw new Error('invalid delivery hours');
  if (config.enabled && (!validTime(start) || !validTime(end))) throw new Error('delivery hours required');
  if (start!==null && end!==null && start>=end) throw new Error('invalid delivery hours range');
  return { enabled: config.enabled, headquarters: 'Castelejo', deliveryStart:start, deliveryEnd:end, zones: normalized };
}

export function quoteDeliveryZone(postalCode, shopDelivery) {
  const config = readDeliveryZoneConfig(shopDelivery);
  if (!config.enabled) return { available: false, reason: 'feature_not_enabled' };
  const matched = resolveLocalDelivery(postalCode, config.zones);
  if (!matched.eligible) return { available: false, reason: matched.reason };
  return { available: true, locality: matched.locality, postalCode: matched.postalCode, feeCents: matched.feeCents };
}

// Update apenas o campo novo. Os valores antigos (dias, taxa geral, prefixos, etc.) permanecem intactos.
export function withDeliveryZoneConfig(shopDelivery, config) {
  if (!shopDelivery || typeof shopDelivery !== 'object' || Array.isArray(shopDelivery)) throw new Error('invalid settings');
  return { ...shopDelivery, deliveryZoneConfig: prepareDeliveryZoneConfig(config) };
}
