# ArtEssencia — bloqueadores de migração Cloud / entregas (NÃO APLICAR)

Auditoria de leitura, 2026-10-14. Ramo isolado; não altera produção.

## Evidência observada nas RPC reais

- `artessencia_save_shop_delivery_v1(p_shop_delivery jsonb)`: autentica proprietário, mas não exige revisão esperada; substitui `settings.shopDelivery` e `artessencia_shop_settings.data.delivery` completos; substitui `store_settings.fulfillment` em vez de mesclar chaves adicionais.
- `artessencia_save_shop_status_v1(p_status jsonb)`: valida proprietário e opções de levantamento/entrega, mas grava `store_status` apenas com `enabled` e `accepting_orders`, removendo `mode`, `public_message` e quaisquer outras chaves.
- `artessencia_save_box_creator_v1(p_box_creator jsonb, p_shop_packaging jsonb)` e `artessencia_patch_box_creator_extras_v1(p_patch jsonb)`: efetuam operações read-modify-write de JSON sem revisão esperada; potencial de lost update.
- `delivery/draft-general-delivery-save.NOT-APPLIED.sql`: já exige a revisão do estado principal e bloqueios `FOR UPDATE`, mas coexiste com escritores V1 que não respeitam o mesmo contrato. Não ativar ainda.

## Contrato de correção antes de implantação

1. Inventariar TODOS os chamadores do Backoffice (incluindo Cloud push geral, rotinas offline/retry e Desktop) e definir a fonte única de revisão.
2. Fazer snapshot/backup seguro das definições de produção antes de qualquer migração; nenhuma escrita de teste em produção.
3. Preservar explicitamente `mode`, `public_message`, `deliveryZoneConfig`, `fulfillment` extra e campos desconhecidos que já existam no servidor.
4. Bloquear gravações concorrentes em ordem consistente; exigir revisão esperada ou protocolo equivalente em TODOS os escritores que partilham estado. Não mascarar conflitos com last-write-wins.
5. Manter as permissões do proprietário; rever `EXECUTE`/RLS e evitar RPC privilegiada pública sem autenticação e autorização.
6. Verificar estado 'updating' sem encomendas, 'closed' sem encomendas, 'open' com configurações válidas, e preservar transições da Loja já implementadas.
7. Testes: write/write simultâneo A/B; retries; offline/online; edição de embalagens vs estado da Loja; entrega vs Cloud push; rollback; integridade de clientes/encomendas.
8. Publicar apenas após testes com as RPC efetivas e compatibilidade da versão instalada, mediante decisão explícita para produção.

## Resultados de testes locais comunicados

- Rejeição de revisão antiga (`UPDATE 0`) verificada; paralelismo real não demonstrado com registos temporizados.
- Simulações de estado updating, embalagens, zonas e campos inesperados aprovadas; terminam com ROLLBACK.
- Não constituem aprovação de RPC reais nem autorização para executar migração.

**BLOQUEADO**: ativação de zonas/portes e substituição das RPC de produção até satisfazer os pontos acima.
