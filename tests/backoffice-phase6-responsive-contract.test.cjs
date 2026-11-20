'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'backoffice-visual.css'),'utf8');
test('Fase 6: regras dedicadas aos cinco módulos',()=>{
 for(const id of ['catalogDigital','delivery','campaigns','commercialCalendar','email'])
  assert.ok(css.includes('.app #'+id),id);
 for(const token of [
  'catalog-center-kpis','catalog-center-workflow','capacity-calendar-pro{min-width:650px}',
  'deliveryZonesFormV197','campaign-links-v1856','commercial-list-v1850',
  'email177-toolbar','email177-row b','@container (max-width: 1090px)',
  '@container (max-width: 475px)'])
  assert.ok(css.includes(token),token);
});
test('Fase 6: sem quebras arbitrárias nem alterações de sincronização',()=>{
 assert.doesNotMatch(css,/word-break:\s*break-all/);
 const js=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const id of ['catalogDigital','delivery','campaigns','commercialCalendar','email'])
  assert.ok(js.includes('<section id="'+id+'"'),id);
 for(const name of ['saveDeliveryZoneV197','sendCampaignV12626','sendNewEmailV1715'])
  assert.ok(js.includes(name),name);
});
test('Fase 6: balanceamento da folha',()=>{
 const s=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
 assert.equal((s.match(/\{/g)||[]).length,(s.match(/\}/g)||[]).length);
});
