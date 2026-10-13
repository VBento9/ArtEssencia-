import { evaluateDeliveryDateTime } from './delivery-calendar.mjs';

// Adaptador de pré-visualização de disponibilidade. NÃO substitui a resposta da RPC.
// Para a Loja pública, a mesma regra precisa de ser imposta na base de dados.
export function previewDeliverySlots({ rows, nowISO, preparationHours = 48, slotMinutes = 30 }) {
  if (!Array.isArray(rows)) throw new Error('invalid fulfillment rows');
  if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 120) throw new Error('invalid slot interval');
  return rows.filter(row => row && row.delivery_enabled === true && !row.closed && !row.full).map(row => {
    const start = String(row.delivery_start || '').slice(0,5);
    const end = String(row.delivery_end || '').slice(0,5);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)) return null;
    const toMinutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3));
    const slots = [];
    for (let minute = toMinutes(start); minute <= toMinutes(end); minute+=slotMinutes) {
      const time = String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
      const decision = evaluateDeliveryDateTime({nowISO,deliveryDate:row.date,deliveryTime:time,leadHours:preparationHours});
      if (decision.eligible) slots.push(time);
    }
    return slots.length ? {date:row.date, slots} : null;
  }).filter(Boolean);
}
