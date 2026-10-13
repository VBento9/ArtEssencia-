import assert from 'node:assert/strict';
import { normalizePostalCode, validateDeliveryZones, resolveLocalDelivery, firstEligibleDeliveryDate, isEligibleDeliveryDay } from './zone-rules.mjs';

const zones = [
  {name:'Castelejo',enabled:true,feeCents:150,postalCodes:['6230-151']},
  {name:'Donas',enabled:true,feeCents:300,postalCodes:['6230-170']},
  {name:'Fundão',enabled:false,feeCents:300,postalCodes:['6230-999']}
];
assert.equal(normalizePostalCode('6230 170'),'6230-170');
assert.equal(normalizePostalCode('6230'),'null' === '' ? 'x' : null);
assert.deepEqual(resolveLocalDelivery('6230170',zones),{eligible:true,locality:'Donas',feeCents:300,postalCode:'6230-170'});
assert.equal(resolveLocalDelivery('6230-999',zones).eligible,false);
assert.equal(resolveLocalDelivery('6230-777',zones).eligible,false);
assert.throws(()=>validateDeliveryZones([{...zones[0],postalCodes:['6230-151','6230-151']}]));
assert.throws(()=>validateDeliveryZones([{...zones[0]},{...zones[1],postalCodes:['6230-151']}]));
assert.equal(firstEligibleDeliveryDate('2026-10-15','23:59:59'),'2026-10-18');
assert.equal(firstEligibleDeliveryDate('2026-10-16','00:00:00'),'2026-10-25');
assert.equal(firstEligibleDeliveryDate('2026-10-17','18:00:00'),'2026-10-25');
assert.equal(firstEligibleDeliveryDate('2026-10-18','14:00:00'),'2026-10-25');
assert.equal(isEligibleDeliveryDay('2026-10-19','2026-10-18'),true);
assert.equal(isEligibleDeliveryDay('2026-10-20','2026-10-18'),false);
console.log('Testes de zonas e calendário concluídos.');
