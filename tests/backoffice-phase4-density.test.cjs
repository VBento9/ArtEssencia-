'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),load=p=>fs.readFileSync(path.join(root,p),'utf8');
const specs=[
 ['clients-compact-ui.css',['clients-list-card{container-type:inline-size','@container (max-width: 1040px)','client-metrics','client-actions']],
 ['production-compact-ui.css',['prod-head{container-type:inline-size','@container (max-width: 680px)','production-complete-action','ae-production-tabs']],
 ['dashboard-compact-ui.css',['dashboard-today-card{container-type:inline-size','@container (max-width: 780px)','@container (max-width: 480px)','ae-delivery-focus-actions']],
 ['digital-stats-decisions-v1966.css',['ds-dashboard-v1966,','@container (max-width: 880px)','ae-compare-grid-v1967','ae-advisor-list']],
 ['backoffice-visual.css',['publication-table-v1812{container-type:inline-size','@container (max-width: 1040px)','publication-filter-fields-v1925','publication-actions-v1812']]
];
for(const [file,required] of specs)test(file+' tem regras específicas e equilibradas',()=>{
 const css=load(file);for(const x of required)assert.ok(css.includes(x),x);
 assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
 assert.ok(!css.includes('word-break:break-all'));
});
test('sem alterações de lógica ou PWA nas regras novas',()=>{
 const html=load('index.html'),sw=load('sw.js');
 for(const id of ['clients','production','dashboard','digitalStats','publication'])assert.ok(html.includes('id="'+id+'"'));
 for(const p of ['clients-compact-ui.css','production-compact-ui.css','dashboard-compact-ui.css','digital-stats-decisions-v1966.css','backoffice-visual.css'])assert.ok(sw.includes('/'+p));
});
