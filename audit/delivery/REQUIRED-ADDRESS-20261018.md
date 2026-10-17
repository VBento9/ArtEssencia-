# Campos obrigatórios e códigos partilhados — 18/10/2026

## Regra aceite pelo proprietário

Morada, localidade e CP completo 1234-567 são obrigatórios e separados. A localidade é a selecionada no campo próprio do checkout. CP partilhado pode ser aceite somente em associação explícita com essa localidade, se a zona estiver configurada e ativa e as entregas globalmente ativas. Não se procura o nome da localidade como substring da rua. Esta validação verifica dados declarados, não prova a residência física nem a veracidade da rua indicada.

## Alterações pequenas

- Loja 1.6.22: campos required, pattern CP4-3, bloqueio de submissão e cotação de CP malformado, payload com localidade e CP formatado. Mantém cálculo Cloud e revalidação de portes. Cache SW versionada; nenhum dado local apagado.
- Supabase: referência existente passou de PRIMARY KEY(postal_code) para PRIMARY KEY(postal_code,locality_key). Auditoria confirmou que nenhuma FK aponta para a tabela. Sem tabela ou RPC nova.
- 48 associações geográficas partilhadas importadas do mesmo ZIP CTT atual (14 CP7), total 527 referências. Códigos específicos de clientes continuam excluídos.
- store_submit_order_v1 existente exige morada/localidade não vazias, incluindo whitespace, e CP exatamente no formato 4-3; aplica cálculo e validação existente de zona. A localidade fica no JSON da encomenda Backoffice e nas notas da encomenda Loja, sem coluna adicional.
- store_submit_order_v2, vouchers, idempotência, capacidades e regras temporais preservados. Cotação conserva compatibilidade com clientes anteriores que enviavam sete dígitos sem hífen; a submissão exige formato completo.

## Validação

56 verificações em PostgreSQL isolado: os 32 cenários anteriores e 24 adicionais, incluindo códigos partilhados, endereço/localidade vazios/whitespace, seis CP malformados, rejeição de localidade não configurada, tarifa do servidor, preservação da localidade e repetição do pedido. Nenhum pedido fictício em produção.

Chromium: checkout anterior e campos obrigatórios; oito casos de campos inválidos não chamam RPC de submissão; payload válido preserva os três campos; zero erros de página. Sintaxe dos scripts inline aprovada.

Após migração em produção: 527 referências, PK composta confirmada; Donas/6230-173 e Aldeia Nova do Cabo/6230-050 reconhecidos; Castelejo/6230-173 recusado. Entrega global desativada continua a recusar cotação. RLS ativa, anon sem SELECT direto e sem EXECUTE em submit_v1. Hashes das definições públicas/Backoffice e produtos iguais aos anteriores; clientes e encomendas reais preservados (Backoffice 12/6; Loja 0 encomendas). Nenhuma zona ativada ou tarifa alterada.

## Publicação

Loja: PR #19, merge 31e8ea8bb5516b7b783a6dabb87121cc5524bff6. Backoffice mantém 1.9.8, sem necessidade de reconstrução ou reinstalação; usa a referência Cloud atualizada. Loja continua enabled=false/accepting_orders=false em modo updating. Confirmar também estado READY e conteúdo do domínio Vercel antes de declarar frontend publicado.

Este relatório substitui os bloqueios de códigos partilhados descritos nos relatórios anteriores, em resultado da regra explícita aprovada pelo proprietário. Não altera a exclusão de CP exclusivos de clientes nem certifica morada física.

## Reprodução dos testes

AE_PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite node audit/delivery/test-required-address.cjs
AE_TEST_CHROMIUM=/caminho/chromium AE_SHOP_HTML=/checkout-da-Loja/index.html node audit/delivery/test-required-address-browser.cjs

PGlite usado: 0.3.14. Todos os testes de encomenda executam em base efémera sem ligação à produção.
