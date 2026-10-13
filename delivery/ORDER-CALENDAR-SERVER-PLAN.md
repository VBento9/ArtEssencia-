# ArtEssencia — plano de validação do calendário no servidor

**Estado: especificação apenas; não aplicada.**

O fluxo de encomendas existente usa store_submit_order_v2 e store_submit_order_v1. Esta última confirma a data, a antecedência configurada, o dia da semana, as exceções e a disponibilidade antes da gravação.

## Critérios de validação futura

- Aplicar o fuso Europe/Lisbon usando um instante obtido no servidor, não o relógio do dispositivo.
- Permitir exclusivamente entrega, ao domingo ou segunda-feira.
- Aplicar o prazo semanal de quinta-feira às 23h59m59s para o domingo e segunda-feira seguintes.
- Exigir pelo menos 48 horas reais de preparação; artigos personalizados podem exigir mais.
- Rejeitar horas locais inexistentes ou ambíguas na mudança de hora.
- Preservar os mecanismos de exceções, capacidade, idempotência, vouchers, associação de clientes e encomendas existentes.
- Aplicar tarifas por localidade e código postal completo no servidor antes de confirmar a encomenda.
- Não ativar funcionalidades comerciais com base apenas em filtros do navegador.

## Bloqueadores

Não há ambiente PostgreSQL isolado disponível sem custos adicionais aprovados. As funções propostas ainda não foram compiladas num motor PostgreSQL. A Loja e o Supabase publicados não devem ser alterados nem ativados enquanto estes testes estiverem pendentes.
