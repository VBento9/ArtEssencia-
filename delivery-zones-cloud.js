// ArtEssencia: owner-only delivery zones Cloud API.
// No local fallback: failed reads must never overwrite existing zones.
import * as cloud from './cloud.js';

export async function loadDeliveryZones() {
  const session = await cloud.ensureSession();
  if (!session?.user?.id) throw new Error('Sessão de proprietário necessária.');
  // The owner-scoped RPC must be deployed and authorization-tested before this module is wired into the Backoffice.
  return cloud.deliveryZonesRead();
}

export async function saveDeliveryZones(zones) {
  if (!Array.isArray(zones) || zones.length > 100) throw new Error('Lista de zonas inválida.');
  const names = new Set();
  const payload = zones.map(zone => {
    const locality = String(zone.locality || '').trim();
    const fee = Number(zone.fee_cents);
    if (!locality || locality.length > 100 || !Number.isInteger(fee) || fee < 0 || fee > 9999999 || typeof zone.active !== 'boolean') {
      throw new Error('Localidade, tarifa ou estado inválidos.');
    }
    const key = locality.toLocaleLowerCase('pt-PT');
    if (names.has(key)) throw new Error('Localidade duplicada.');
    names.add(key);
    return {locality, fee_cents:fee, active:zone.active, postal_codes:[]};
  });
  return cloud.deliveryZonesWrite(payload);
}
