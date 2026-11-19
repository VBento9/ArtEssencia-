'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
test('Orçamentos: toolbar e cartões adaptam-se ao contentor',()=>{
 const css=read('quote-history-compact-v1965.css');
 for(const s of ['quotes-history-card-v1730{container-type:inline-size','@container (max-width: 820px)','@container (max-width: 540px)','qh-primary-1965 button'])assert.ok(css.includes(s),s);
 assert.ok(css.includes('word-break:normal'));
});
test('Mapa de Fundos: valores e classificação preservados nos cartões',()=>{
 const css=read('funds-ledger-v1.css');
 for(const s of ['funds-card-v1929{container-type:inline-size','fundsTableBodyV1929','fundsMovementBodyV1929','Saldo inicial','Montante','funds-dept-v1929'])assert.ok(css.includes(s),s);
});
test('Relatórios: KPIs e colunas adaptativos sem alterações de exportação',()=>{
 const css=read('backoffice-visual.css');
 for(const s of ['#reports{container-type:inline-size','@container (max-width: 960px)','reports-kpis','report-line','reports-export-card'])assert.ok(css.includes(s),s);
});
for(const name of ['quote-history-compact-v1965.css','funds-ledger-v1.css','backoffice-visual.css']){
 test(name+': sintaxe e limites visuais',()=>{
  const css=read(name);
  // Strip comments and quoted CSS strings before counting structure braces.
  const stripped=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
  assert.equal((stripped.match(/\{/g)||[]).length,(stripped.match(/\}/g)||[]).length);
  assert.doesNotMatch(css,/word-break:\s*break-all/);
 });
}
