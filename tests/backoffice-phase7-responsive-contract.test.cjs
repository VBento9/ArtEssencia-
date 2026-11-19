'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('fase 7: selectors limitados aos módulos e contentores',()=>{
 const c=read('backoffice-visual.css');
 for(const id of ['quantityPricing','homepage','socialAI','legal','settings','cloud','backup'])assert.ok(c.includes('.app #'+id),id);
 for(const cls of ['quantity-pricing-results-v1750','homepage-workspace-v12649','socialSuggestionsV1','legal-doc-grid-v1286','settings-grid','cloud-pro-grid','backup-pro-grid'])assert.ok(c.includes(cls),cls);
 for(const width of [1100,940,540,405])assert.ok(c.includes('@container (max-width: '+width+'px)'),width);
});
test('fase 7: permanecem os botões e funções críticas no código original',()=>{
 const h=read('index.html');
 for(const id of ['quantityPricing','homepage','socialAI','legal','settings','cloud','backup'])assert.ok(h.includes('<section id="'+id+'"'));
 for(const fn of ['cloudConnect()','saveHomepageAdminV12637()','exportBackup()','importBackup()','renderSettings()','generateSocialProposalV3()'])assert.ok(h.includes(fn),fn);
});
test('CSS sem contentores incompletos e sem quebra arbitrária',()=>{
 const c=read('backoffice-visual.css').replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
 assert.equal((c.match(/\{/g)||[]).length,(c.match(/\}/g)||[]).length);
 assert.doesNotMatch(c,/word-break:\s*break-all/);
});
