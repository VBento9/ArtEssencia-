# ArtEssencia Intelligence Hybrid — Fase 1 (isolada)

Base: main 1.9.196. Limite obrigatório pretendido: EUR 10/mês incluindo encargos; nenhuma nova subscrição, carregamento automático ou aumento de plano. Esta fase não efetua chamadas pagas.

## Descoberta
O runtime instalado em index.html usa db.stock e db.productRecipes[code] com referências por nome exato. renameStockReferencesV1737 altera também compras, movimentos, costMeta e parte das produções; lotes ready_stock mantêm o snapshot. O módulo product-technical-sheet.js contém ainda leitura de receitas por materialId em formato legado. Não assumir que nomes são simples rótulos nem fundir produtos por semelhança.

## Entrega
Motor puro de auditoria em intelligence/inventory-audit.cjs. Recebe apenas snapshot operacional explicitamente fornecido, não escreve nem faz chamadas externas. Deteta duplicados candidatos, referências ausentes/ambíguas, unidades, quantidades e custos por validar, fichas vazias/ausentes/órfãs. Candidatos de normalização não constituem autorização de fusão. Fichas sem receita podem ser legítimas; são sinalizadas para revisão. Teste: node tests/intelligence-inventory-audit.test.cjs.

## Próximos critérios de aceitação (não implementados)
1. Adaptador autenticado, apenas leitura do snapshot autorizado, sem exposição a clientes. Integrar no Backoffice sem alterar o sistema de sincronização. Testar formato legado separadamente.
2. Interruptor geral e individual persistidos na Cloud, desligados por defeito, verificados no servidor antes de cada execução e antes de qualquer escrita. Falha de validação bloqueia.
3. Importação física em rascunho, separar saldo contado de entrada por compra; não duplicar movimentos; validar unidades, custos e identidade; aprovação em lote.
4. Alterações de nomes e consolidação: plano com impacto, versão do snapshot, aprovação de fusões, transação atómica, idempotência, auditoria e reversão. Preservar quantidades, valor de inventário, preços históricos e snapshots. Nunca eliminar registos autonomamente.
5. Integrar tarefas existentes operational_tasks_v1 (sem duplicação); evitar notificações e execuções repetidas.
6. Motor IA partilhado, orçamento global de todos os endpoints incluindo existentes, reserva atómica do custo máximo estimado antes de cada pedido, reconciliar consumo, limitar tokens, parar quando moeda/impostos/preço não forem verificáveis. Margem de segurança; sem prometer garantia de faturação do fornecedor. Validar planos e limites antes de ativar.
7. Validar com dados sintéticos, testes de concorrência e regressão, preview isolado sem ligação a dados reais; sem merge ou deploy até aprovação da fase.

Não foi criada migração, integração UI, scheduler ou acesso real a inventário nesta fase.
