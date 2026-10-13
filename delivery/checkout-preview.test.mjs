import assert from 'node:assert/strict';
import {previewDeliverySlots} from './checkout-preview.mjs';
const rows=[
 {date:'2026-10-18',delivery_enabled:true,closed:false,full:false,delivery_start:'11:00',delivery_end:'12:00'},
 {date:'2026-10-19',delivery_enabled:true,closed:false,full:false,delivery_start:'11:00',delivery_end:'12:00'},
 {date:'2026-10-20',delivery_enabled:true,closed:false,full:false,delivery_start:'11:00',delivery_end:'12:00'},
 {date:'2026-10-25',delivery_enabled:true,closed:true,full:false,delivery_start:'11:00',delivery_end:'12:00'},
];
const before=previewDeliverySlots({rows,nowISO:'2026-10-15T22:59:59Z'});
assert.deepEqual(before.map(x=>x.date),['2026-10-18','2026-10-19']);
assert.deepEqual(before[0].slots,['11:00','11:30','12:00']);
const after=previewDeliverySlots({rows,nowISO:'2026-10-15T23:00:00Z'});
assert.deepEqual(after,[]);
assert.deepEqual(previewDeliverySlots({rows,nowISO:'2026-10-15T22:59:59Z',preparationHours:96}),[]);
assert.deepEqual(rows.map(x=>x.date),['2026-10-18','2026-10-19','2026-10-20','2026-10-25']);
console.log('Pré-visualização de horários: OK');
