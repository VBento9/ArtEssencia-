'use strict';
// Guardrail for UX-only changes. Run: node scripts/test_ux_preservation.cjs
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const pages=['dashboard','sale','orders','quotes','production','costs','stock','purchases','visualCatalogs','catalogs','commercialCalendar','publication','catalogDigital','specialEditions','homepage','socialAI','campaigns','legal','settings','cash','clients','digitalStats','reports','quantityPricing','products','delivery','email','cloud','backup'];
for(const id of pages)assert.match(html,new RegExp('<section\\s+id="'+id+'"\\s+class="screen'), 'Module missing: '+id);
for(const fn of ['renderDashboard','renderOrders','renderProduction','renderProducts','renderStock','renderClients','calculateQueuedDeliveryEstimateV1911','selectDeliveryReferenceV1914','deliveryReferencesV1914','go'])assert.ok(html.includes('function '+fn+'(')||html.includes('async function '+fn+'('),'Missing function: '+fn);
for(const id of ['globalSearchV142','cloudStatus','runtimeVersion','deliveryEstimateLocalityV1911','deliveryEstimateRowsV1911'])assert.ok(html.includes('id="'+id+'"'),'Critical element missing: '+id);
assert.match(html,/const APP_VERSION='1\.9\.14'/,'Unexpected app version: baseline changes require separate release review');
const sw=fs.readFileSync('sw.js','utf8'),ver=JSON.parse(fs.readFileSync('version.json','utf8'));
assert.equal(ver.app,'1.9.14');assert.ok(sw.includes("artessencia-backoffice-1.9.14"));
console.log('UX baseline checks passed: '+pages.length+' modules, critical functions, PWA 1.9.14');
