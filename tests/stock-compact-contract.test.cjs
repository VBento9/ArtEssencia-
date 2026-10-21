// Ensaios de contrato do componente de Stock compacto, sem acesso a dados reais.
// Executar: node --test tests/stock-compact-contract.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'stock-compact-ui.js'),'utf8');
const css=fs.readFileSync(path.join(root,'stock-compact-ui.css'),'utf8');
test('apresentação não contém chamadas de escrita ou alteração de stock',()=>{
  for(const term of ['supabase','db.stock','db.purchases','db.stockMoves','localStorage.setItem','fetch(','save(','addStock(','moveStock(','deleteStockItemV1737('])assert.equal(js.includes(term),false,'token proibido: '+term);
});
test('paginação preserva a ordem dos nós de tabela',()=>{
  assert.match(js,/Array\.from\(body\.rows\)/);
  assert.match(js,/row\.hidden=/);
  assert.doesNotMatch(js,/appendChild\(row\)|replaceChildren\(.*row|sort\(/);
});
test('não cria ações de negócio nem reatribui handlers inline',()=>{
  assert.doesNotMatch(js,/\.innerHTML\s*=|\.onclick\s*=\s*.*loadStock|\.setAttribute\(['"]onclick/);
});
test('preserva formulário de edição e botão cancelar',()=>{
  assert.match(js,/stockCancelBtnV145/);
  assert.match(js,/open\('form'\)/);
  assert.match(js,/open\(null\)/);
});
test('CSS é limitado ao ecrã Stock',()=>{
  assert.match(css,/#stock \.ae-stock-compact-controls/);
  assert.match(css,/#stock #stockBody tr\[hidden\]/);
  assert.doesNotMatch(css,/(?:^|\n)\s*(?:html|body|\.table)\s*\{/);
});

test('a interface principal carrega ambos os recursos do Stock compacto',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(index,/<link rel="stylesheet" href="\.\/stock-compact-ui\.css" id="ae-stock-compact-styles">/);
  assert.match(index,/<script defer src="\.\/stock-compact-ui\.js" id="ae-stock-compact-script"><\/script>/);
});
test('o service worker procura JavaScript e CSS na rede, sem servir versões antigas',()=>{
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.ok(sw.includes('js|css|json|webmanifest'));
  assert.ok(sw.includes("cache:'no-store'"));
});
