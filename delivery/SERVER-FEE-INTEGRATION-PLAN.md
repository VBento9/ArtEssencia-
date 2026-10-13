# ArtEssencia — validação dos portes no servidor (NÃO APLICADO)

## Estado atual verificado em leitura

A função `public.store_submit_order_v1(p_payload jsonb)` calcula `v_subtotal` a partir dos produtos e `v_fee` a partir da configuração. Na modalidade de entrega utiliza atualmente os 4 dígitos de prefixo postal (`postalPrefixes`) e `localDeliveryFee` como tarifa comum. O total calculado é `round(v_subtotal+v_fee,2)` e é guardado com a encomenda. Existe devolução de encomendas repetidas por `client_request_id` antes da gravação.

## Alteração pretendida — NÃO IMPLEMENTADA

1. Manter todo o cálculo atual de preços dos produtos, promoções e idempotência.
2. Quando a configuração de zonas estiver **explicitamente** ativa e a Loja estiver autorizada a receber encomendas, rejeitar códigos postais incompletos ou malformados e exigir correspondência exata num único código postal completo da zona ativa.
3. Obter o valor de `feeCents` da zona guardada no servidor e convertê-lo em euros (`feeCents / 100`), sem usar preços ou tarifas fornecidos pelo navegador.
4. Sem zona ativa, manter o percurso antigo apenas enquanto a migração e as novas condições comerciais não forem publicadas. Não utilizar `postalPrefixes` nem `localDeliveryFee` como fallback quando o modo de zonas estiver ativo.
5. Validar encomenda mínima com subtotal calculado no servidor, antes de conceder vouchers; analisar o contrato existente para garantir política correta.
6. Manter capacidade, exceções, data, hora, tipo de entrega, reserva, notas, clientes, histórico e os dados existentes inalterados.
7. Coordenar RPC de opções/horários com RPC de gravação para evitar valores diferentes entre checkout e encomenda.
8. Validar autorização e funções SECURITY DEFINER antes de instalar qualquer SQL.

## Bloqueios

Ainda não há ambiente PostgreSQL isolado validado; as novas RPCs não foram instaladas nem compiladas. A ativação comercial permanece impedida. Este ficheiro é uma especificação de revisão, não uma migração.
