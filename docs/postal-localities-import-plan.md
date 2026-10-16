# ArtEssencia — preparação da referência postal (sem publicação)

A referência de códigos postais não pode ser inferida pelo prefixo de 4 dígitos. O objetivo é importar uma fonte com proveniência, licença, data e correspondência CP7-localidade, validada antes da utilização.

## Contrato de importação
CSV UTF-8: postal_code,locality,source_name,source_version,verified_at

- postal_code: formato NNNN-NNN.
- locality: designação exata normalizada, não concelho.
- Rejeitar linhas sem origem ou versão.
- Rejeitar CP7 com localidades diferentes; enviar para revisão de morada.
- Não apagar correspondências existentes sem auditoria e confirmação.
- Importar inicialmente para staging, nunca diretamente para tabela ativa.
- Validar amostra manualmente, contar erros e comparar com versão anterior.
- Publicar apenas após testes positivos/negativos do cálculo de portes e do checkout.

## Estado confirmado
- A tabela artessencia_postal_locality_reference existe, mas estava vazia na última verificação.
- A função de portes recusa CP7 sem correspondência.
- A gestão de zonas v2 aceita zonas sem listas manuais de CP7.
- Não ativar a loja antes de completar os testes.

## Testes mínimos
1. Fundão + CP7 confirmado de Fundão: aceite, tarifa correta.
2. Fundão + CP7 confirmado de Castelejo: recusado.
3. Castelejo + CP7 confirmado de Castelejo: aceite, tarifa correta.
4. CP7 desconhecido, ambíguo ou inválido: recusado.
5. Localidade inativa: recusada.
6. Tarifa alterada: refletida no orçamento e no checkout.
7. Pedido enviado diretamente para store_submit_order_v2 com CP7 errado: recusado, sem criar encomenda.
8. Regressão: descontos, clientes, horários e encomendas anteriores intactos.
