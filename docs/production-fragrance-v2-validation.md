# Produção: fragrância efetivamente consumida — 1.9.138

Continuação da PR #204, sobre e5fa61cacb41a57e3010a289fb48cdd7cdbb93e9.

## Funcionamento

1. Produção → Identificar fragrâncias no Stock: classificação manual dos artigos de referência e dos artigos realmente utilizados. Esta lista fica na configuração sincronizada; não cria artigos nem associa a Biblioteca Técnica por nomes.
2. Ao concluir, selecionar o artigo e quantidade total de cada linha. A preferência existente do cliente é apenas apresentada. As outras matérias-primas mantêm a receita congelada.
3. A v2 valida utilizador/RLS, revisão, snapshots de produtos/encomendas, posição na receita, classificação, unidades, quantidades e disponibilidade agregada. Grava movimentos, custos e conclusão na mesma transação.
4. O diário local conserva o identificador, payload e versão da RPC antes do envio. Respostas perdidas/reinício repetem a mesma operação. Nenhum desconto otimista.
5. Sem substituições, o circuito anterior e diários antigos continuam na RPC v1.

Os custos e impacto absoluto na margem ficam em `productionRuns[].fragranceActualsV2`, por encomenda/linha/ingrediente. Prioridade do custo estimado: custo guardado na receita, custo da precificação congelada da encomenda, custo atual do artigo de referência. A última hipótese é identificada explicitamente: não reconstrói um custo histórico desconhecido. Não há recálculo de PVP ou margens configuradas.

## Verificações executadas

- 53 testes Node: planeador, seleção efetiva, stock agregado, Biblioteca Técnica, hidratação, autenticação/bloqueio e sincronização de produtos.
- 19 verificações de integração PostgreSQL isolado, via PGlite 0.3.14: duas fragrâncias na mesma encomenda; referência sem stock; artigo inexistente; stock insuficiente; unidades incompatíveis; substituição não autorizada; duplicados; linha inexistente; quantidade inválida; alteração de outros consumos; custo em falta; produto alterado; falha tardia e rollback; resposta perdida/repetição; encomenda concluída; revisão desatualizada; v1; RLS e acesso anónimo.
- `scripts/test_production_atomic_sql.cjs`: circuito v1, rollback e idempotência, sem alterações ao SQL v1.
- `scripts/test_backoffice_integrity.cjs`: diário durável, perda de rede e reinício, RPC v2 mantida no retry, quota local e cache offline.
- `scripts/test_production_fragrance_reservations.cjs`, `scripts/test_ux_order_production_safety.cjs`, `scripts/check_pwa_release_versions.cjs` e `git diff --check`: aprovados.
- Navegador, fixture artificial sem Cloud: duas linhas do mesmo produto, Coco 22 g e Figo 9 g, custos e impacto apresentados corretamente, confirmação conserva ambas as escolhas.
- Três contextos simulados executam a receção operacional real: convergem no stock/custos, rejeitam revisão antiga e protegem alterações locais e produção pendente. Não equivale a um ensaio nos dispositivos físicos do utilizador.

O teste antigo de recuperação de sessão tinha quatro falhas também no commit inicial: faltavam os mocks das funções de bloqueio introduzidas em 1.9.135. Foram acrescentados os mocks, sem alterar o código de autenticação. Os testes próprios do bloqueio também passaram. Os gates de navegação ainda esperavam 30 módulos apesar de a Biblioteca Técnica ter sido acrescentada na PR #204; passaram a exigir os 31 identificadores únicos e a presença explícita da Biblioteca Técnica.

## Cloud

Migração `complete_production_backoffice_v2` aplicada ao projeto `ihtsonqnnlrxvorfrarl`. Corpo instalado igual ao ficheiro testado (MD5 `fd9a84c9d37da8d2625c0d2936460bb8`). SECURITY INVOKER, search_path vazio, execução anónima negada, execução authenticated permitida sujeita a auth.uid() e RLS do proprietário. Chamada sem identidade rejeitada com AUTH_REQUIRED.

Comparação antes/depois da instalação: hashes idênticos do estado operacional completo (inclui Stock, receitas e movimentos), das 195 linhas de produtos, das 9 encomendas e da definição da RPC v1. Nenhum dado real foi utilizado para testes de escrita. Advisors sem achados referentes à v2; avisos restantes pertencem a outros objetos já existentes.

## Limites de validação e utilização

- O Stock tem de ter os artigos reais, unidade g/ml e custo unitário preenchido, e o responsável tem de os identificar como fragrâncias. Não foi efetuada essa classificação nos dados reais.
- Não se converte g/ml por suposição. Artigos com unidades diferentes são bloqueados.
- A ficha histórica sem custo guardado não permite recuperar o custo antigo; a origem da estimativa fica registada.
- Ensaio físico simultâneo no computador, Honor Pad e telemóvel não efetuado nesta sessão. A evidência multidispositivo é automatizada/simulada.
- A migração instala a nova função, mas não altera a v1 nem ativa clientes antigos. Publicação e estado final da PR devem ser confirmados pelos registos GitHub/Vercel.
