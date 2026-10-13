# ArtEssencia — critérios de integração SQL (13-10-2026)

## Verificação somente leitura
- As representações `artessencia_shop_settings.data.delivery` e `artessencia_v1_state.data.settings.shopDelivery` coincidem na linha associada (1 verificada, 0 divergentes).
- Nenhuma RPC proposta foi instalada.

## Bloqueadores antes de instalar
1. `artessencia_save_shop_delivery_v1` continua disponível e substitui a configuração completa; ao correr concorrentemente, não impõe a revisão esperada.
2. A sincronização geral `saveCloudStateSimple` escreve um snapshot completo protegido por revisão; após qualquer gravação de zonas a aplicação tem de reidratar a revisão e os dados novos, sem reenviar snapshots antigos.
3. `artessencia_save_shop_delivery_v2` foi proposta como função distinta; mudar o chamador necessita de validação dos erros de conflito e da atualização do estado local.
4. A RPC de rascunho não deve ser instalada antes de confirmar privilégios de EXECUTE por função, testes de segurança e transações revertidas.
5. Os códigos postais e portes dos exemplos de testes não são dados comerciais aprovados; não os copiar para a Cloud.
6. A disponibilidade do calendário e os portes finais necessitam validação do servidor antes de qualquer abertura comercial.

## Aceitação
- Guardar zonas sem alterar os restantes campos.
- Dois dispositivos: a segunda gravação com revisão antiga é rejeitada, mantendo ambas as fontes idênticas.
- Save geral subsequente preserva a chave `deliveryZoneConfig`.
- Falha de uma das operações reverte ambas as representações.
- Nenhum update em `store_settings` pelo rascunho.
- Loja continua fechada até prova end-to-end.
