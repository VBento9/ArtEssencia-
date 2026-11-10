# Biblioteca de Fragrâncias manual

Base: main 94f8b15f09623cf7b1fd27a0301758f6dd83bd54. PR anterior #204 não integrada. Sem SQL, RPC ou alterações de funções operacionais.

## Implementação

- Fichas, pesquisa, famílias, arquivo, fotografia por URL opcional e CSV com movimentos.
- Importação opcional e idempotente de 15 referências do recibo 67827, sem saldos atribuídos.
- Quantidades em mililitros (até três casas decimais), armazenadas como inteiros em microlitros.
- Consumo, reposição, correção justificada e alteração justificada da capacidade; histórico não apagado.
- Tanque limitado a 100%; sem referência mostra «Capacidade por definir».
- Persistência em settings.manualFragranceLibraryV1 pelo save existente. Sem segundo sistema de sincronização.
- Guardas contra edição de ficha antiga, outra aba com versão diferente, conflito Cloud conhecido, duplo envio e erro de gravação.

## Testes executados

- node --test tests/fragrance-ledger.test.cjs tests/fragrance-library-sync.test.cjs: 8 aprovados.
- node --test tests/cloud-operational-hydration.test.cjs: 10 aprovados.
- scripts/test_ux_navigation.cjs e test_ux_mobile_audit.cjs: aprovados, 31 módulos únicos incluindo a biblioteca. Apenas contagem e nova presença ajustadas.
- scripts/test_backoffice_integrity.cjs: aprovado.
- scripts/test_pwa_update.cjs, test_pwa_update_banner.cjs e check_pwa_release_versions.cjs: aprovados.
- scripts/test_fragrance_library_browser.cjs: interações reais em Chromium isolado, 390/800/1366 px, dados artificiais, nenhuma rota para Cloud; executado no workflow Manual fragrance library. Consultar resultado da revisão atual na PR.
- Chromium local não iniciou (socket bloqueado pelo ambiente). O workflow usa Ubuntu 24.04, compatível com a versão fixada de Playwright.

## Proteção autorizada do histórico

Após autorização explícita, a substituição do histórico é bloqueada nos envios, receções e resolução forçada. O envio conserva a revisão condicional existente (CAS). A função SQL de trigger é limitada a settings.manualFragranceLibraryV1; impede também envios de clientes antigos que retirem fichas ou alterem movimentos já confirmados. Sem alterações nas RPCs de Produção ou nas políticas RLS.

Testes adicionais: 6 cenários JavaScript de envio/receção forçados, preflight, falha de ligação e ausência de impacto sem biblioteca; 9 verificações PostgreSQL isoladas. Históricos divergentes são bloqueados para resolução manual, nunca somados automaticamente (isso poderia produzir saldos negativos ou contar um consumo duas vezes).

Não foram ensaiados dispositivos físicos ou escritas em dados reais. A publicação depende da regressão completa. O estado READY de um preview não equivale a aprovação funcional.
