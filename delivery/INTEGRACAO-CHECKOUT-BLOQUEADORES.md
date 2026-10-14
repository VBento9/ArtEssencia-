# ArtEssencia — integração das zonas no checkout (bloqueador confirmado)

**Não aplicar à produção.** Consulta de leitura ao Supabase em 2026-10-14.

## Factos confirmados

- A Loja chama `store_fulfillment_options_v1` para obter datas e taxas preexistentes.
- `store_fulfillment_options_v1` devolve `delivery_fee` global e `postal_prefixes`; não calcula `deliveryZoneConfig`.
- `store_submit_order_v2` valida promoção e delega a criação de encomendas em `store_submit_order_v1`.
- `store_submit_order_v1` valida entrega pelo prefixo do código postal e cobra `localDeliveryFee`, não a tarifa específica da localidade.
- A nova cotação de zonas é informativa: **não basta ligá-la à Loja**. Sem validação transacional no `store_submit_order_v1`, um comprador poderá enviar diretamente um pedido com tarifa diferente da cotação, ou com zona não autorizada.

## Plano mínimo seguro (por completar)

1. Manter `deliveryZoneConfig.enabled=false` até todo o caminho transacional estar pronto.
2. Validar server-side `postalCode` completo, zona ativa, tarifa, mínimo, domingo/segunda, corte de quinta, antecedência real >=48h, capacidade, estado `updating/closed` e idempotência de `request_id`.
3. Recalcular a taxa a partir de configuração confiável **na mesma transação da criação do pedido**, antes de inserir cliente/encomenda.
4. Aplicar desconto ao total com taxa correta e refletir montantes na encomenda do Backoffice. Não aceitar `feeCents` ou `deliveryZoneConfig` do navegador.
5. Preservar `store_submit_order_v2` e os fluxos já funcionais de vouchers e clientes; rever todas as alterações propostas com os RPC completos e testes de regressão.
6. Só então integrar cotação/slots na UI de `artessencia-loja-` em ramo isolado, testar em condições reais sem criar encomendas de produção e autorizar publicação.

## Estado

- Implementado em ramo isolado: rascunho `draft-server-trusted-quote.NOT-APPLIED.sql`.
- **Não implementado**: alteração transacional de `store_submit_order_v1`, migração de configuração Cloud e integração da interface pública.
- Sem alterações ou ativação de produção.
