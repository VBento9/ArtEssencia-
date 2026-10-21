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

const vm=require('node:vm');
// Executa as funções reais, extraídas do HTML, sobre dados fictícios.
// Nenhuma ligação ao Supabase, localStorage ou encomendas reais.
const start=html.indexOf('function productionActiveCommitmentOrdersV136(');
const end=html.indexOf('function productionCommittedNeedsV136(',start);
assert.ok(start>=0&&end>start,'Bloco de reservas não localizado');
const implementation=html.slice(start,end);
const mockOrders=[
 {id:'A',status:'Em produção',delivery:'2026-10-25',materialNeeds:{'Fragrância Artficium':27.3}},
 {id:'B',status:'Confirmada',delivery:'2026-10-24',materialNeeds:{'Fragrância Artficium':10}},
 {id:'C',status:'Confirmada',delivery:'2026-10-26',materialNeeds:{'Fragrância Artficium':30}},
 {id:'D',status:'Cancelado',delivery:'2026-10-23',materialNeeds:{'Fragrância Artficium':100}},
 {id:'E',status:'Pronta',delivery:'2026-10-24',materialNeeds:{'Fragrância Artficium':100}},
 {id:'F',status:'Produção',delivery:'2026-10-25',materialNeeds:{'Fragrância Artficium':5}}
];
const context={
 db:{orders:mockOrders},
 orderAlreadyProducedIds:()=>new Set(),
 productionOrderNeedsV12632:o=>o.materialNeeds,
};
vm.createContext(context);
vm.runInContext(implementation,context,{timeout:1000});
const reserved=context.productionOtherCommitmentsV20261021('2026-10-25',[mockOrders[0],mockOrders[5]]);
assert.equal(reserved['Fragrância Artficium'],10);
assert.equal(50-reserved['Fragrância Artficium']-27.3,12.7);
const onlySelected=context.productionOtherCommitmentsV20261021('2026-10-25',[mockOrders[0],mockOrders[1],mockOrders[5]]);
assert.equal(onlySelected['Fragrância Artficium']||0,0);
const notSelected=context.productionOtherCommitmentsV20261021('2026-10-25',[]);
assert.equal(notSelected['Fragrância Artficium'],42.3);
context.orderAlreadyProducedIds=()=>new Set(['B']);
const alreadyProduced=context.productionOtherCommitmentsV20261021('2026-10-25',[mockOrders[0],mockOrders[5]]);
assert.equal(alreadyProduced['Fragrância Artficium']||0,0);
console.log('Real commitment selection passed with simulated orders.');

console.log('Contratos de reservas e unidades de fragrância verificados.');
