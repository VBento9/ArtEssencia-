// Calendário isolado: o instante é fornecido pelo servidor em UTC.
// Não confiar na data/hora local do browser. Valores são decisões preliminares,
// não disponibilidades confirmadas de checkout.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

export function lisbonDateTime(nowISO) {
  const instant = new Date(nowISO);
  if (!Number.isFinite(instant.getTime())) throw new Error('invalid server timestamp');
  const parts = Object.fromEntries(formatter.formatToParts(instant).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}:${parts.second}`};
}
function calendarDay(iso) {return new Date(iso+'T12:00:00Z');}
function plusDays(iso,n) {
  const d=calendarDay(iso);
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);
}
function validISODate(value){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=calendarDay(value);
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}

// Regra semanal: encomendas de sexta a domingo passam para a semana
// seguinte; até quinta 23:59:59 podem usar domingo/segunda desta semana.
export function eligibleSundayFromInstant(nowISO) {
  const {date}=lisbonDateTime(nowISO);
  const day=calendarDay(date).getUTCDay();
  const diff=(7-day)%7;
  return plusDays(date,diff+(day>=5||day===0?7:0));
}

// leadHours mede tempo real decorrido desde a encomenda (mínimo 48h).
// deliveryLocalTime é hora de entrega desejada, não relógio do cliente.
// Evita horas ambíguas/inexistentes nas mudanças de hora, rejeitando-as.
function localTimeMatches(instant,date,time) {
  const p=lisbonDateTime(instant);
  return p.date===date&&p.time.slice(0,5)===time;
}
function deliveryInstants(date,time){
  if (!validISODate(date)|| !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const base=Date.parse(date+'T'+time+':00Z');
  return [-60,0,60].map(offset=>new Date(base+offset*60000))
    .filter(d=>localTimeMatches(d,date,time));
}

export function evaluateDeliveryDateTime({nowISO,deliveryDate,deliveryTime,leadHours=48}) {
  if (!Number.isInteger(leadHours)||leadHours<48||leadHours>24*60) throw new Error('invalid preparation hours');
  const now=new Date(nowISO);
  if (!Number.isFinite(now.getTime())) throw new Error('invalid server timestamp');
  const sunday=eligibleSundayFromInstant(nowISO);
  if (!validISODate(deliveryDate)) return {eligible:false,reason:'invalid_date'};
  const day=calendarDay(deliveryDate).getUTCDay();
  if (day!==0&&day!==1) return {eligible:false,reason:'delivery_day_unavailable'};
  if (deliveryDate<sunday) return {eligible:false,reason:'weekly_cutoff'};
  const instants=deliveryInstants(deliveryDate,deliveryTime);
  if (instants.length!==1) return {eligible:false,reason:'ambiguous_or_invalid_delivery_time'};
  if (instants[0].getTime()-now.getTime()<leadHours*3600000) return {eligible:false,reason:'preparation_time'};
  return {eligible:true,firstSunday:sunday,deliveryDate,deliveryTime};
}
