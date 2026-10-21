# Auditoria de reservas de fragrância — 21/10/2026

## Evidência observada
- Produção de 25/10/2026 apresenta "Fragrância Artficium: precisa 27,3 ml, disponível após compromissos 0 ml".
- Operador confirma 50 ml visíveis no módulo Stock.
- A diferença não demonstra, por si, duplicação: encomendas não concluídas podem reservar material legitimamente.

## Fonte da hipótese
No commit 14179c2, o cálculo de bloqueio era:
`needs = produção selecionada`
`committed = productionCommittedNeedsV136(d)`
`prior = max(0, committed[name] - needs[name])`
`available = max(0, stockByName(name).qty - prior)`

Se stock consultado = 50, need = 27,3 e available = 0, então prior >= 50, logo committed >= 77,3 (pressupondo que committed inclui a necessidade corrente). Se committed não incluir a necessidade corrente, esta dedução não se aplica e a fórmula pode produzir resultados incorretos.

## Hipóteses por confirmar
1. O stock mostrado no ecrã e `stockByName('Fragrância Artficium')` podem referir registos diferentes ou estados local/cloud diferentes.
2. `productionCommittedNeedsV136(d)` pode contar a encomenda alvo mais de uma vez ou contar encomendas já concluídas.
3. A receita capturada na encomenda pode guardar uma designação legada e unidade incompatível.
4. Pode haver compromissos legítimos iguais ou superiores a 50 ml.

## Risco comprovado em histórico
O commit 14179c2 introduziu `if(name==='Fragrância Artficium'&&x.unit==='g')x.unit='ml'` imediatamente antes de descontar material. Uma mudança de rótulo não constitui conversão física g↔ml. Deve ser removida/adequada após inspeção integral da versão atual, respeitando os dados históricos.

## Plano de validação sem escrita
1. Obter cópia exata de `index.html` em produção (o conector não devolveu o ficheiro completo de ~1,7 MB).
2. Inspecionar implementação atual de `productionCommittedNeedsV136`, `stockByName` e `productionOrderNeedsV12632`.
3. Num diagnóstico local sem mutações, reportar ID da encomenda, IDs únicos das reservas, quantidade por encomenda, stock identificado e unidade.
4. Reproduzir os cenários com encomenda alvo incluída/excluída da reserva; testar concluídas, canceladas, lotes múltiplos, unidades e sincronização.
5. Apenas depois corrigir o bloco funcional em branch e executar testes do Backoffice + PWA, sem mudar main antes da aprovação.

## Âmbito deste PR
O ficheiro `scripts/test_production_fragrance_reservations.cjs` adiciona cenários de contrato, **não testa a função real de produção**, e exige `index.html` para correr. O teste de unidade g→ml é intencionalmente impeditivo se o código perigoso continuar presente. Não integrar o PR nesta fase.
