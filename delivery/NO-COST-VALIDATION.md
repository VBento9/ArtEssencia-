# ArtEssencia — validação sem recursos pagos

Decisão do proprietário: não criar projetos ou branches Supabase faturáveis.

## Resultados (testes locais/simulados)
- zone-rules.test.mjs: PASS
- zone-config.test.mjs: PASS
- zone-cloud-plan.test.mjs: PASS
- zone-concurrency-regression.test.mjs: PASS
- zone-v2-contract.test.mjs: PASS

Os testes executaram as asserções das regras JavaScript; não testaram o motor PostgreSQL.

## Limites e salvaguardas
- Não executar nenhuma proposta .NOT-APPLIED.sql na base de produção.
- Não criar branches ou projetos pagos.
- Não instalar RPCs novas nem modificar contratos de RPC existentes.
- Não fundir a branch para main nem efetuar deploy da Loja ou do Backoffice.
- Nunca tratar valores de teste de códigos postais e taxas como aprovados.
- Requer validação real do cálculo de portes, da regra semanal e da segurança SQL antes da abertura comercial.

## Próximos passos gratuitos
1. Rever estaticamente as propostas SQL e reforçar os cenários de teste unitário locais.
2. Verificar a interface num navegador local, sem conexão à produção, quando existir ambiente adequado.
3. Preparar checklist de integração sem executar alterações.
