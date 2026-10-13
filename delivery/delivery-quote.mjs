import { normalizePostalCode, validateDeliveryZones } from './zone-rules.mjs';

// Contrato puro para a futura validação de portes no servidor.
// NÃO é autorização de compra nem substitui validação SQL.
export function computeDeliveryQuote({ postalCode, shopDelivery, subtotalCents }) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new Error('invalid subtotal');
  const cfg = shopDelivery?.deliveryZoneConfig;
  if (!cfg || cfg.enabled !== true) return { eligible:false, reason:'zones_not_enabled' };
  if (shopDelivery.localDeliveryEnabled !== true) return { eligible:false, reason:'delivery_disabled' };
  const postal = normalizePostalCode(postalCode);
  if (!postal) return { eligible:false, reason:'invalid_postal_code' };
  const zones = validateDeliveryZones(cfg.zones);
  const zone = zones.find(z => z.enabled && z.postalCodes.includes(postal));
  if (!zone) return { eligible:false, reason:'outside_delivery_area' };
  const minimum = Number(shopDelivery.minOrderLocalDelivery ?? 0);
  if (!Number.isFinite(minimum) || minimum < 0 || !Number.isSafeInteger(Math.round(minimum*100))) throw new Error('invalid minimum');
  if (subtotalCents < Math.round(minimum*100)) return { eligible:false, reason:'minimum_order_not_met' };
  const totalCents = subtotalCents + zone.feeCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error('invalid total');
  return { eligible:true, locality:zone.name, postalCode:postal, feeCents:zone.feeCents, subtotalCents, totalCents };
}
