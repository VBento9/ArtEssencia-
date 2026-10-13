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

## Auditoria adicional de funções Cloud reais (2026-10-14)

- `artessencia_state_revision_guard_v1` é uma trigger que apenas confirma que `NEW.revision = OLD.revision + 1` quando `data` muda. Não prova que o chamador trouxe uma revisão esperada; um escritor obsoleto pode calcular `revision = revision + 1` no servidor e passar a trigger.
- `artessencia_cloud_upsert_record_v1` usa `excluded.client_updated_at >= current.client_updated_at` no `ON CONFLICT`, sem versão/CAS e com relógio fornecido pelo cliente. Datas iguais podem substituir dados; relógios adiantados podem impedir atualizações legítimas.
- Antes de substituir a política de conflitos dos registos Cloud, mapear tipos de `entity`, chamadores e semântica de sincronização offline, para não afetar encomendas ou outras entidades.
- Consulta ao GitHub confirmou `delivery/draft-general-delivery-save.NOT-APPLIED.sql` isolado. A pesquisa de código GitHub não devolveu chamadas do Backoffice e os caminhos de entrada usuais examinados não revelaram implementação; o inventário de chamadores **continua incompleto**, não presumir que todos foram encontrados.

**Sem alteração de produção.**

## Inventário de dados Cloud (leitura em produção, 2026-10-14)

- `public.artessencia_cloud_records`: **0 registos**. Não foi possível observar valores efetivamente utilizados de `entity` nesta tabela; não confundir ausência de dados com ausência de chamadores no código.
- `public.artessencia_v1_state`: **1 registo**. A proteção de estado principal e respetivos escritores é prioritária.
- **Não** migrar nem limpar dados da tabela vazia, nem presumir que a sincronização está desativada. Inventariar os chamadores no código completo da aplicação antes de alterar `artessencia_cloud_upsert_record_v1`.
- A leitura efetuada não expôs dados pessoais, clientes ou encomendas.

## Dois escritores concorrentes do estado público da Loja (auditoria adicional)

- `artessencia_save_public_channel_status_admin_v1(p_channel,p_mode,p_message)` é a via que implementa explicitamente `open/updating/closed` e grava `mode`, `public_message`, `enabled` e `accepting_orders` para a Loja. Possui verificação de proprietário, mas substitui o JSON inteiro de `store_settings.store_status`.
- `artessencia_save_shop_status_v1(p_status)` escreve na **mesma chave** `store_status` apenas `enabled` e `accepting_orders`. Se for chamada depois da primeira, elimina `mode` e `public_message`.
- Portanto, não é seguro interpretar `artessencia_save_shop_status_v1` como único escritor do modo público. A correção tem de reconciliar ambas as RPC e os seus chamadores, preservar propriedades adicionais, e garantir que mudar opções de entrega não altera implicitamente `updating/closed` para `open`.
- O protocolo de revisão `artessencia_v1_state` **não protege automaticamente** `store_settings.store_status`; é outro registo/tabela e exige estratégia de concorrência própria.
- Recomenda-se desenhar primeiro um teste de regressão local com as sequências `save_public_channel_status(updating)` → `save_shop_status` e a sequência inversa, testando efeitos no checkout. Não publicar substituições até validar com o código cliente.
