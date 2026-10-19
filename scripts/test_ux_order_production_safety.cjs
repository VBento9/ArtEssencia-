'use strict';
// Read-only regression gate for the Encomendas -> Produção workflow.
// Does not connect to the Cloud or alter records.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');

const functionSource = name => {
  const signature = 'function '+name+'(';
  const start = html.indexOf(signature);
  assert.ok(start >= 0, 'Missing '+name);
  const brace = html.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];
    if(quote){
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c===quote)quote='';
      continue;
    }
    if(c==='\''||c==='"'||c==='\x60'){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw Error('Unterminated function '+name);
};

const source=functionSource('viewOrderProductionV1915');
assert.match(source,/go\('production'\)/,'The order action must open production');
assert.match(source,/orderProductionContextV1915|orderProductionMessageV1915/,'Context must be displayed');
assert.doesNotMatch(source,/(?:supabase\.|\.from\(|\.insert\(|\.update\(|\.delete\(|saveOrder\(|saveProduction\()/i,'Navigation must not directly mutate records');
assert.match(html,/id="orderProductionContextV1915"/);
assert.match(html,/id="orderProductionMessageV1915"/);
assert.match(html,/Voltar às encomendas/);
assert.match(html,/A agenda pode incluir outras encomendas da mesma data/);
console.log('Order -> Production navigation safety checks passed (static).');
