// ArtEssencia — auditoria estática, não cria encomendas nem modifica dados.
// Executar: node delivery/test-sql-checkout-integrity.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const v1=readFileSync(new URL('./draft-store-submit-order-with-zone-gate.NOT-APPLIED.sql',import.meta.url),'utf8');
const helper=readFileSync(new URL('./draft-checkout-zone-fee-helper.NOT-APPLIED.sql',import.meta.url),'utf8');
const checks=[
 ['configuração de zonas protegida pela flag',/v_s\s*#>>\s*'\{deliveryZoneConfig,enabled\}'\s*=\s*'true'/i],
 ['portes calculados pelo servidor',/v_fee\s*:=\s*public\.artessencia_delivery_fee_from_zones_draft/i],
 ['sem prefixos antigos quando zonas ligadas',/NOT\s*\(v_s\s*#>>\s*'\{deliveryZoneConfig,enabled\}'='true'\)\s+AND\s+jsonb_array_length/i],
 ['sem leadDays antigo quando zonas ligadas',/NOT\s*\(v_fulfillment='ENTREGA'\s+AND\s+v_s\s*#>>\s*'\{deliveryZoneConfig,enabled\}'='true'\)\s+AND\s+v_requested_date<current_date/i],
 ['fechada ou atualização bloqueadas',/lower\(coalesce\(value->>'mode',''\)\)\s+in\s*\('updating','closed'\)/i],
 ['limite quinta-feira em Lisboa',/weekly delivery cutoff/i],
 ['horário de verão/inverno inválido',/nonexistent delivery time/i],
 ['horário ambíguo',/ambiguous delivery time/i],
 ['antecedência efetiva 48 horas',/interval '48 hours'/i],
 ['cliente real preservado',/insert\s+into\s+public\.store_customers/i],
 ['linhas reais da encomenda',/insert\s+into\s+public\.store_order_items/i],
 ['idempotência preservada',/client_request_id/i],
 ['sincronização de encomenda Backoffice',/insert\s+into\s+public\.artessencia_v1_orders/i],
 ['valor final inclui os portes',/v_total\s*:=\s*round\(v_subtotal\+v_fee,2\)/i],
 ['helper não tem privilégios elevados',/SECURITY INVOKER/i]
];
for(const [name,pattern] of checks){assert.match(name.startsWith('helper')?helper:v1,pattern,name);console.log('APROVADO: '+name)}
assert.ok(v1.indexOf('artessencia_delivery_fee_from_zones_draft')<v1.indexOf('insert into public.store_orders'),'portes devem ser calculados antes do registo');
console.log('APROVADO: cálculo de portes antes de guardar encomenda');
console.log('TOTAL: '+(checks.length+1)+' verificações estáticas. NÃO equivale a teste SQL transacional.');
