# Revisão de autorização — não aplicado

A função isolada `artessencia_quote_zone_fee_draft(text,jsonb)` recebe uma configuração JSON do chamador. Por isso NÃO deve ser acessível como RPC pública. Em PostgreSQL, novas funções podem herdar autorização de execução para PUBLIC se não houver revogação explícita. Uma futura instalação terá de definir os privilégios no mesmo procedimento transacional e auditar os papéis `anon` e `authenticated`, sem publicar a função diretamente.

Antes da implementação, conferir os privilégios reais através do catálogo do PostgreSQL e demonstrar que só o código de encomendas autorizado usa uma configuração lida no servidor. O cliente nunca pode fornecer taxas, zonas ou o total da encomenda como valor de confiança.

Não executar nem instalar SQL na produção. Não conceder direitos de execução até concluir testes em PostgreSQL isolado.
