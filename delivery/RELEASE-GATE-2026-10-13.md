# ArtEssencia — decisão de segurança (13 outubro 2026)

**NÃO AUTORIZAR MERGE/DEPLOY OU SQL DE PRODUÇÃO.** O dono proibiu novos recursos pagos. Nenhum foi criado.

## Testes gratuitos executados
- 8 conjuntos de testes JavaScript anteriores: PASS.
- Teste local combinado de cálculo de portes + calendário + falha segura: PASS.
- Revisão estática anterior: não substitui compilação SQL.

## Bloqueadores efetivos
1. As funções SQL propostas (.NOT-APPLIED.sql) não foram compiladas ou executadas num PostgreSQL isolado. Neste ambiente local não há binários PostgreSQL disponíveis.
2. A função em produção store_submit_order_v1 ainda usa prefixos postais e tarifa geral. Não existe um contrato SQL integrado/verificado com pagamento, descontos, capacidade, idempotência e histórico.
3. A função antiga de gravação de definições e o Cloud push geral ainda podem sobrescrever deliveryZoneConfig; CAS e bloqueios têm de ser validados end-to-end.
4. O checkout da Loja não está ligado aos novos módulos; disponibilidades e confirmação do servidor precisam de concordar.
5. Códigos postais completos e portes oficiais por localidade ainda não foram aprovados; exemplos nos testes são fictícios.
6. A revisão dos privilégios EXECUTE, SECURITY DEFINER e políticas RLS é obrigatória antes de publicar funções.

## Critério para desbloquear
Executar testes transacionais SQL completos, em PostgreSQL isolado e sem dados reais, comprovar segurança e ausência de regressões; só depois preparar revisão/merge por decisão explícita e publicação controlada.

## Proteção
Nenhuma migração aplicada. Nenhum dado real alterado. Loja, Catálogo e Backoffice publicados intocados.
