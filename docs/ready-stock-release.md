# Produção para stock e venda direta

A abertura do stock para uma feira começa com a contagem física. Em **Produção → Produção para stock**, selecionar o produto, data e unidades. Escolher **Descontar pela ficha técnica** quando as matérias-primas ainda estão em stock ou **Materiais já contabilizados** se o consumo já foi registado. Consultar a pré-visualização antes de confirmar. O registo é confirmado pela Cloud.

Em **Stock → Produtos acabados**, pesquisar por referência ou nome e abrir a linha para consultar os movimentos. Quebras, perdas e diferenças de contagem devem ser registadas com motivo. A data do movimento pode ser anterior à data de registo.

Em **Vendas → Venda direta**, selecionar as peças e quantidades, verificar o total e o meio de pagamento e confirmar. A finalização exige ligação à Cloud, mesmo quando o dispositivo ainda não conhece o primeiro lote registado noutro equipamento. Em **Histórico de vendas diretas**, uma anulação integral regista a devolução do dinheiro. Confirmar a reposição apenas se todas as peças regressarem em condições de venda.

## Reversão com movimentos posteriores à publicação

1. Suspender o registo de novas produções, ajustes, vendas e devoluções no ponto de venda. Identificar os dispositivos que têm transações pendentes.
2. Guardar uma cópia consistente do estado operacional e das encomendas relacionais no mesmo ponto temporal. Preservar as cópias locais dos dispositivos com confirmações pendentes.
3. Conservar os históricos, as funções de confirmação e as proteções de escrita. Antes de reabrir, consultar cada operação pendente pela mesma identidade e reconciliar produção, venda, devolução e pagamento. Uma operação confirmada pode ter perdido a resposta na rede.
4. Publicar uma correção compatível com os movimentos já gravados. Se for necessário recuar a interface, manter a venda direta suspensa em todos os dispositivos até existir uma versão compatível. Voltar a publicar a versão 1.9.190 por si só não protege o stock.
5. Conferir as unidades por referência e o saldo líquido por venda. Corrigir diferenças com movimentos identificados. A reposição de uma cópia anterior ao incidente requer a reconciliação de todas as operações posteriores.
