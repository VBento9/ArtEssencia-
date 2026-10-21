'use strict';
// Regressão ArtEssencia: auditoria sem escrita à Cloud nem aos stocks.
// Executar: node scripts/test_production_fragrance_reservations.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');

// Contrato independente da implementação: uma reserva da própria encomenda
// não pode ser subtraída duas vezes; outras reservas mantêm prioridade.
function saldoDisponivel(stock,necessidadeAtual,reservaIncluida,compromissosTotais){
 const outrasReservas=Math.max(0,compromissosTotais-(reservaIncluida?necessidadeAtual:0));
 return stock-outrasReservas;
}
assert.equal(saldoDisponivel(50,27.3,true,27.3),50);
assert.equal(saldoDisponivel(50,27.3,true,50),27.3);
assert.equal(saldoDisponivel(50,27.3,false,0),50);
assert.ok(saldoDisponivel(50,27.3,true,60)<27.3);
assert.equal(Number((50-27.3).toFixed(1)),22.7);

// Reproduz a fórmula observada no histórico para tornar explícitos os limites.
function saldoHistorico(stock,necessidade,comprometido){
 const anterior=Math.max(0,comprometido-necessidade);
 return Math.max(0,stock-anterior);
}
assert.equal(saldoHistorico(50,27.3,27.3),50);
assert.equal(saldoHistorico(50,27.3,77.3),0);
// Sem garantias sobre o que entra em 'comprometido', subtrair a necessidade
// corrente pode libertar indevidamente reservas de outras encomendas.
assert.equal(saldoHistorico(50,27.3,50),27.3);
assert.equal(saldoDisponivel(50,27.3,false,50),0);

// Exigir a função real de compromissos externos em ambos os pontos de cálculo.
assert.match(html,/function productionOtherCommitmentsV20261021\(cutoffDate,selectedOrders\)/);
assert.equal((html.match(/productionOtherCommitmentsV20261021\(d,ords\)/g)||[]).length,2);
assert.doesNotMatch(html,/Math\.max\(0,\(Number\(committed\[name\]\)\|\|0\)-\(Number\(need\)\|\|0\)\)/);
// Guardrail estrutural: não converter g em ml por mera alteração de rótulo
// no momento de concluir produção (exige conversão explícita e comprovada).
assert.doesNotMatch(
 html,
 /if\s*\(\s*name\s*===\s*['"]Fragrância Artficium['"]\s*&&\s*x\.unit\s*===\s*['"]g['"]\s*\)\s*x\.unit\s*=\s*['"]ml['"]/,
 'Conversão insegura: alterar unidade de g para ml sem converter quantidade.'
);
console.log('Contratos de reservas e unidades de fragrância verificados.');
