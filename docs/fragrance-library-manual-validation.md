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

## Bloqueio de publicação

O mecanismo existente bloqueia o rebase automático quando duas cópias alteraram settings. Testes executam a função real trySafeOperationalRebaseV19102 sem a modificar. Contudo, cloudResolveConflict('local') permite explicitamente forçar o snapshot local, e a escolha remota pode descartar movimentos locais pendentes. Esta PR não altera essas funções, conforme o âmbito autorizado. Não existe garantia absoluta de preservação do histórico através desses comandos globais. A implementação deve permanecer em desenvolvimento até essa limitação ser resolvida sem violar o âmbito pedido.

Não foram ensaiados dispositivos físicos, sessões Cloud reais ou dados reais. Nenhuma alteração foi publicada em produção nesta missão. O estado READY de um preview não equivale a aprovação funcional.
