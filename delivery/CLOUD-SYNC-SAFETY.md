# Sincronização das zonas — requisitos de segurança (não aplicado)

Estado: ESBOÇO. Não executar em produção até existir revisão de permissões e testes de concorrência.

## Auditoria do mecanismo existente
- `artessencia_save_shop_delivery_v1` substitui integralmente `artessencia_shop_settings.data.delivery` e `artessencia_v1_state.data.settings.shopDelivery`.
- Atualiza também `store_settings.fulfillment` e, em certas condições, `store_settings.store_status`.
- Consequência: utilizar esta função para guardar apenas as zonas é inseguro; e um novo editor com gravação paralela corre risco de ser sobrescrito pelo save geral de entregas.
- O plano em JavaScript `zone-cloud-plan.mjs` deteta alterações entre duas fotografias mas NÃO elimina a janela de corrida.

## Contrato proposto para uma operação transacional dedicada
- Identidade obrigatória: `auth.uid()` e `artessencia_is_owner_v1()`.
- Receber `expected` (revisão/fingerprint da configuração lida) e `deliveryZoneConfig` validado; nunca aceitar campos de estado da Loja.
- Bloquear a linha de configuração relevante com `SELECT ... FOR UPDATE` antes de comparar a revisão, validar e atualizar.
- Alterar apenas a chave `deliveryZoneConfig` dentro de `data.delivery` e de `settings.shopDelivery`; preservar todos os campos operacionais.
- Escrever `enabled=false` forçado no servidor enquanto o checkout e a validação postal não estiverem implementados.
- Atualizar `revision` da Cloud principal se/como exigido pelo mecanismo já existente e verificar conflitos entre as duas representações antes do commit.
- Rejeitar versões remotas desatualizadas, zonas duplicadas, portes inválidos, códigos postais incompletos e configurações que não coincidam nas duas fontes.
- Negar EXECUTE a public/anon; autorizar apenas utilizadores autenticados mais a verificação de proprietário dentro da função.
- Não escrever em `store_settings`; não aceitar encomendas nem mudar modos de funcionamento.

## Bloqueadores para implementação segura
1. Rever políticas RLS e acessos efetivos das duas tabelas, incluindo execução de funções e dono da função.
2. Verificar o comportamento de sincronização do Backoffice (`save()`, cloud push, e conflitos).
3. Corrigir `artessencia_save_shop_delivery_v1` ou a chamada do formulário para preservar `deliveryZoneConfig` após o primeiro save de rascunho, sem substituir alterações concorrentes.
4. Testar transação com duas sessões concorrentes e rollback em ambiente de teste.
5. Só depois integrar uma RPC dedicada, se demonstrado que a operação atual não consegue fornecer garantias equivalentes.

Não ativar a funcionalidade comercial nem publicar até o cálculo de portes e a validação do servidor estarem alinhados.
