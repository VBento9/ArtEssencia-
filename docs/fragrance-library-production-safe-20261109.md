# Biblioteca Técnica de Fragrâncias — Fase 1 e correção de consumo (09/11/2026)

## Fase 1 — incluída nesta branch
- Página independente `Biblioteca Técnica` no Backoffice real (`index.html`).
- Fichas de referência de fragrâncias em `db.settings.technicalFragrancesV1`, com criação, edição, pesquisa, classificação, arquivo e CSV.
- Importação explícita do recibo 67827 (15 fragrâncias, idempotente, sem stock e sem custos).
- Integração pelo `save('settings')` existente; nenhuma nova tabela, nenhum material ou compra.
- Nomes comerciais originais preservados; `Manzana & Canela` e `Cinnamon Apple` distintos.

## Causa confirmada da divergência de fragrâncias (Fase 2)
`productionOrderNeedsV12632` obtém os consumos de `productionRecipeForOrderLineV1757`.
A função Cloud `public.artessencia_complete_production_backoffice_v1` recalcula os consumos a partir das receitas históricas e exige `MATERIAL_CONTRACT_MISMATCH` quando diferem.
Portanto um seletor visual sem validação no servidor seria ineficaz, e alterar a receita para forçar consumo adulteraria custo/histórico.

## Contrato obrigatório da Fase 2 (ainda não ativada)
1. Precificação: quantidade e custo **de referência**, sem atribuir a fragrância consumida.
2. Encomenda: opções escolhidas pelo cliente são apenas pedido; podem ser pré-preenchidas na produção, mas não confirmam consumo.
3. Produção: escolha da fragrância **real** por linha de encomenda e da quantidade consumida na unidade original; receitas históricas e restantes matérias são imutáveis.
4. O servidor valida as substituições explicitamente permitidas (apenas linhas de fragrância), unidades compatíveis, stock real suficiente, snapshots de produto/encomenda, revisão e ausência de duplicados.
5. Uma **nova RPC versionada v2** valida e executa numa única transação o desconto, movimento, associação à encomenda e conclusão. A RPC v1 permanece inalterada para os fluxos antigos.
6. O preço histórico de venda e o custo estimado ficam congelados; registar custo real da fragrância e desvio separadamente no lote.
7. Produções já concluídas ou pendentes nunca migram automaticamente; falha de rede retoma com o mesmo ID sem segundo desconto.
8. Ativação por controlo funcional apenas após testes de integração na Cloud com dados artificiais e verificação multidispositivo; rollback não pode reverter consumos reais.

**Não ativar uma substituição apenas no browser sem alterar e testar a validação da RPC.**
