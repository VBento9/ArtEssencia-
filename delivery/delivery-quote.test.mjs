import assert from 'node:assert/strict';
import {computeDeliveryQuote} from './delivery-quote.mjs';
const deliveryZoneConfig={enabled:true,zones:[
 {name:'Donas',enabled:true,feeCents:300,postalCodes:['6230-170']},
 {name:'Castelejo',enabled:false,feeCents:150,postalCodes:['6230-151']}
]};
const settings={localDeliveryEnabled:true,minOrderLocalDelivery:10,deliveryZoneConfig};
assert.deepEqual(computeDeliveryQuote({postalCode:'6230 170',shopDelivery:settings,subtotalCents:1500}),{eligible:true,locality:'Donas',postalCode:'6230-170',feeCents:300,subtotalCents:1500,totalCents:1800});
assert.equal(computeDeliveryQuote({postalCode:'6230-170',shopDelivery:settings,subtotalCents:999}).reason,'minimum_order_not_met');
assert.equal(computeDeliveryQuote({postalCode:'6230-151',shopDelivery:settings,subtotalCents:1500}).reason,'outside_delivery_area');
assert.equal(computeDeliveryQuote({postalCode:'6230-170',shopDelivery:{...settings,localDeliveryEnabled:false},subtotalCents:1500}).reason,'delivery_disabled');
assert.equal(computeDeliveryQuote({postalCode:'6230-170',shopDelivery:{...settings,deliveryZoneConfig:{...deliveryZoneConfig,enabled:false}},subtotalCents:1500}).reason,'zones_not_enabled');
assert.throws(()=>computeDeliveryQuote({postalCode:'6230-170',shopDelivery:settings,subtotalCents:-1}));
console.log('Cálculo isolado de portes: OK');
