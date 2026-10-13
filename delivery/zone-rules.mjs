// ArtEssencia — núcleo isolado de zonas de entrega.
// Não ligado ao Backoffice nem à Loja. Não modifica configurações existentes.
// Entradas monetárias expressas em cêntimos para evitar arredondamentos de ponto flutuante.

function validISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function normalizePostalCode(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  return /^\d{7}$/.test(digits) ? digits.slice(0, 4) + '-' + digits.slice(4) : null;
}

export function validateDeliveryZones(zones) {
  if (!Array.isArray(zones)) throw new Error('invalid zones');
  const used = new Set();
  return zones.map((zone) => {
    if (!zone || typeof zone.name !== 'string' || !zone.name.trim()) throw new Error('invalid locality');
    if (typeof zone.enabled !== 'boolean') throw new Error('invalid zone status');
    if (!Number.isSafeInteger(zone.feeCents) || zone.feeCents < 0) throw new Error('invalid delivery fee');
    if (!Array.isArray(zone.postalCodes) || !zone.postalCodes.length) throw new Error('postal codes required');
    const codes = zone.postalCodes.map(normalizePostalCode);
    if (codes.some(code => !code)) throw new Error('invalid postal code');
    if (new Set(codes).size !== codes.length) throw new Error('duplicate code in zone');
    for (const code of codes) {
      if (used.has(code)) throw new Error('postal code assigned to multiple zones');
      used.add(code);
    }
    return { name: zone.name.trim(), enabled: zone.enabled, feeCents: zone.feeCents, postalCodes: codes };
  });
}

// Fail closed: nenhuma zona elegível significa entrega indisponível.
// Nenhum prefixo 6230 nem tarifa geral são usados como fallback.
export function resolveLocalDelivery(postalCode, zones) {
  const postal = normalizePostalCode(postalCode);
  if (!postal) return { eligible: false, reason: 'invalid_postal_code' };
  const match = validateDeliveryZones(zones).find(z => z.enabled && z.postalCodes.includes(postal));
  if (!match) return { eligible: false, reason: 'outside_delivery_area' };
  return { eligible: true, locality: match.name, feeCents: match.feeCents, postalCode: postal };
}

// A semana comercial encerra à quinta-feira 23:59:59 (hora de Lisboa).
// Recebe o dia/hora LOCAL validado pelo servidor, YYYY-MM-DD e HH:mm:ss,
// para não confiar no relógio do browser.
export function firstEligibleDeliveryDate(localDate, localTime) {
  if (!validISODate(localDate) || !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(localTime)) throw new Error('invalid local date/time');
  const d = new Date(localDate + 'T12:00:00Z');
  const dow = d.getUTCDay();
  const afterCutoff = dow >= 5; // sexta e sábado
  // Quinta-feira até 23:59:59 pertence à semana corrente; domingo após corte também à seguinte.
  const daysUntilSunday = (7 - dow) % 7;
  const offset = afterCutoff || dow === 0 ? daysUntilSunday + 7 : daysUntilSunday;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0,10);
}

export function isEligibleDeliveryDay(dateISO, firstSundayISO) {
  if (!validISODate(dateISO) || !validISODate(firstSundayISO)) return false;
  const d = new Date(dateISO + 'T12:00:00Z');
  const first = new Date(firstSundayISO + 'T12:00:00Z');
  if (first.getUTCDay() !== 0) return false;
  return d.getTime() >= first.getTime() && (d.getUTCDay() === 0 || d.getUTCDay() === 1);
}
