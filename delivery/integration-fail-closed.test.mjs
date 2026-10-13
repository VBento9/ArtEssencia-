import assert from 'node:assert/strict';
import {computeDeliveryQuote} from './delivery-quote.mjs';
import {previewDeliverySlots} from './checkout-preview.mjs';
// Teste de integração puramente local: não simula a segurança de PostgreSQL.
// Todos os números/localidades abaixo são FICTÍCIOS e NÃO são configuração real.
const zone={enabled:true,zones:[{name:'Zona de ensaio',enabled:true,feeCents:275,postalCodes:['1234-567']}]};
const settings={localDeliveryEnabled:true,minOrderLocalDelivery:20,deliveryZoneConfig:zone};
const rows=[{date:'2026-10-18',delivery_enabled:true,closed:false,full:false,delivery_start:'12:00',delivery_end:'13:00'}];
const quote=computeDeliveryQuote({postalCode:'1234-567',shopDelivery:settings,subtotalCents:2500});
assert.equal(quote.eligible,true);
assert.equal(quote.feeCents,275);
assert.equal(quote.totalCents,2775);
assert.deepEqual(previewDeliverySlots({rows,nowISO:'2026-10-15T22:59:59Z'})[0].slots,['12:00','12:30','13:00']);
assert.deepEqual(previewDeliverySlots({rows,nowISO:'2026-10-15T23:00:00Z'}),[]);
assert.equal(computeDeliveryQuote({postalCode:'1234-568',shopDelivery:settings,subtotalCents:2500}).eligible,false);
assert.equal(computeDeliveryQuote({postalCode:'1234-567',shopDelivery:{...settings,deliveryZoneConfig:{...zone,enabled:false}},subtotalCents:2500}).eligible,false);
assert.equal(computeDeliveryQuote({postalCode:'1234-567',shopDelivery:settings,subtotalCents:1999}).eligible,false);
console.log('Integração local de consulta de preços e calendário: OK');
