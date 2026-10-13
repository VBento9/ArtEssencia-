# Bloqueios de segurança ainda ativos — ArtEssencia

**Não publicar. Não aplicar SQL na produção. Não criar recursos pagos.**

1. A função auxiliar de portes recebe JSON de configuração como argumento. Uma futura encomenda só pode usar definições obtidas pelo próprio servidor. Nunca conceder acesso público direto a esta função.
2. A função antiga de gravação e o Cloud push geral não participam no mesmo protocolo de bloqueio/revisão. Uma gravação concorrente pode sobrescrever zonas.
3. A proposta v2 foi corrigida para preservar campos adicionais de `store_settings.fulfillment`, mas essa alteração ainda carece de compilação e teste num PostgreSQL isolado.
4. Atualizações aninhadas via `jsonb_set` devem exigir que o objeto intermédio `settings` exista. `create_missing=true` não cria todos os níveis intermédios.
5. Revisar permissões EXECUTE, RLS e a função que confirma encomendas. Manter idempotência, preços, vouchers, capacidade e histórico.

Estado: propostas em `.NOT-APPLIED.sql`; validação estática não equivale a testes transacionais. Loja e Backoffice publicados inalterados.
