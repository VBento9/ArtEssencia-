# Validação do ArtEssencia Intelligence

Base de desenvolvimento `34bc6c3`. A produção observada estava na versão 1.9.196, em `64e0f0f`. O catálogo e a loja não precisam deste SQL para funcionar.

## Circuitos disponíveis para teste isolado

A Central usa a sessão Supabase do Backoffice e o comando de proprietário `artessencia_intelligence_console_v1`. A leitura agrega as últimas 100 missões, os últimos 100 eventos, até 100 memórias e 50 documentos recentes. A vista de desempenho cobre essa janela. Ativar a equipa e escolher um modo permite registar missões. A autorização de uma missão e a execução pelo servidor são operações distintas. A falha de transporte exige atualizar a vista antes de repetir uma ordem.

A rotina privada `team_tick()` prepara missões diárias, semanais ou mensais no calendário de Lisboa. Em modo semiautomático ficam pendentes de aprovação. Em modo automático uma rotina guardada autoriza o trabalho interno previsto. O bloqueio de linhas e o período guardado impedem duplicação no mesmo período. O agendamento Vercel proposto invoca `/api/intelligence-worker` às 07:15 UTC. O servidor exige o segredo do agendador e o interruptor de infraestrutura. Um pedido manual usa o token da sessão do proprietário, o identificador da missão e a revisão esperada.

O executor usa exclusivamente comandos autorizados por uma credencial com o papel `artessencia_intelligence_worker`. O trabalhador obtém o contexto após adquirir a missão e o recibo financeiro antes de concluir o documento. Os nove departamentos têm uma missão exercitada através da mesma composição de servidor. O Diretor utiliza os relatórios dos departamentos. Stock consulta materiais, receitas e produtos relacionais. Produção usa o cálculo canónico de materiais, incluindo receitas congeladas. Financeiro usa os cálculos de custo do Backoffice e o total da encomenda relacional. Comercial usa pedidos e orçamentos, Marketing lê as edições, Inovação lê conceitos anteriores e memória, Catálogo verifica referências e Auditoria consulta a execução e as incertezas de faturação. Os testes de paridade comparam as fórmulas com a aplicação.

As decisões estruturadas da IA produzem documentos, tarefas com evidência e delegações. Uma transação conclui o documento, grava o resultado das ferramentas e cria as missões filhas. Cada departamento recebe no máximo uma filha por missão do Diretor. Em automático, o executor pode registar até seis tarefas internas no Planeamento. A prova integrada exercita uma delegação e duas tarefas persistidas. Execuções abandonadas bloqueiam a missão. Um custo incerto conserva a reserva e suspende a despesa partilhada.

A ação de aprovação para Planeamento lê a proposta persistente, grava em `artessencia_cloud_records` com entidade `operational_tasks_v1` e confirma o identificador gravado. Repetições preservam o estado da tarefa. A memória profissional pertence ao departamento, exige uma missão concluída como evidência, tem prazo e admite correção, revogação e eliminação explícita após revogação.

## Reprodução isolada

- Executar `node scripts/test_intelligence_all.cjs`.
- Instalar as versões de PGlite, pg e Playwright indicadas em `.github/workflows/intelligence-isolated.yml` num diretório temporário.
- Executar `scripts/test_intelligence_count_sql.cjs` com PGlite e também com `--postgres` numa base descartável vazia chamada `intelligence_fixture`, em loopback na porta 55433. O teste recusa uma ligação remota.
- Executar os dois testes de navegador do workflow. A Central usa o mesmo comando SQL numa base PGlite partilhada pelas três sessões Chromium com larguras de 390, 820 e 1440 píxeis.

## Ativação e reversão

A validação Cloud requer um projeto isolado autorizado. O projeto de produção observado não continha o esquema Intelligence e não tinha branches Supabase. Usar dados fictícios e o projeto de validação tanto na sessão do Backoffice como no servidor. Aplicar por ordem os scripts de orçamento, equipa, execução, contexto de Stock, contexto departamental, consola de proprietário e executor. Cada um tem a designação `intelligence-` em `sql/`. O esquema canónico do Backoffice deve existir no projeto de validação. O SQL de contagem física permanece separado. Os planos históricos de renomeação e consolidação continuam disponíveis no código de desenvolvimento. A Central oferece as duas missões de Stock atualmente executáveis pelo trabalhador.

Configurar apenas no servidor `INTELLIGENCE_SUPABASE_URL`, `INTELLIGENCE_SUPABASE_PUBLISHABLE_KEY`, `INTELLIGENCE_WORKER_JWT` (token assinado pelo projeto, expiração e sujeito do proprietário), `CRON_SECRET` e `INTELLIGENCE_WORKER_ENABLED`. O papel do executor tem acesso à RPC do trabalhador. A revogação do token e do seu privilégio de execução interrompe esse acesso. A conta autenticada do administrador usa a RPC da consola. Manter desativado o consumo pago durante a validação.

A ativação financeira exige decisão específica do administrador, tarifário verificado, limites e reconciliação independente do fornecedor. Requer aprovação no controlo SQL de orçamento, `OPENAI_API_KEY`, `INTELLIGENCE_PAID_RELEASE`, `INTELLIGENCE_TARIFF_ID` e `INTELLIGENCE_FINANCIAL_APPROVAL`. O último contém datas de verificação e validade, modelo, referência de evidência, estado das recargas, verificação da chave dedicada, reconciliação de consumo, custo bruto mensal máximo da restante infraestrutura, fator fiscal, limite superior de câmbio e preços por milhão de tokens. Os nomes dos campos, as unidades e os limites estão em `intelligence/approved-pricing.cjs`. As tarifas do fornecedor, a cotação efetiva, os impostos e o estado da conta exigem verificação à data de ativação. Os registos de liquidação de uso do modelo representam estimativas conservadoras em euros e exigem confronto com as faturas.

Continuam por validar num ambiente publicado o transporte PostgREST com credencial real, o disparo do cron, a sincronização da PWA instalada e as quotas do plano. O Stock aceita uma lista, fotografia ou fatura por missão de auditoria ou organização. O executor verifica o formato, entrega o conteúdo ao modelo no contexto da missão e limpa o anexo ao concluir ou cancelar. O agendador limpa anexos expirados. O fornecedor simulado confirmou a passagem de um CSV. A exatidão de leitura de fotografias e faturas requer avaliação complementar. A criação e consolidação de materiais, o envio de propostas para os módulos comerciais e a verificação pública cruzada de Loja e Catálogo ainda precisam de integração específica. As tarefas podem encaminhar esses trabalhos para revisão.

Uma reversão suspende primeiro a entrada de trabalho e a faturação. Preservar as tabelas de missões, recibos e custos pendentes para reconciliação. O seguinte bloco destina-se exclusivamente a um administrador da instalação selecionada, depois de confirmada a intervenção.

```sql
BEGIN;
UPDATE artessencia_intelligence_private.ai_budget_control SET release_enabled=false;
UPDATE artessencia_intelligence_private.team_controls
SET enabled=false, revision=revision+1,
    modes=(SELECT jsonb_object_agg(key,'off'::text) FROM jsonb_object_keys(modes) AS k(key));
REVOKE EXECUTE ON FUNCTION public.artessencia_intelligence_console_v1(text,jsonb) FROM authenticated;
COMMIT;
```

Suspender quaisquer invocações programadas antes de reverter o código. A versão 1.9.196 contém chamadas diretas nos três assistentes antigos. Uma reversão para essa versão requer retirar primeiro o acesso à chave paga no ambiente de execução. Confirmar os pedidos em curso antes de restaurar o serviço. Manter a versão funcional da PWA e submeter alterações a produção e migrações a autorização específica.

## Criação de material a partir de contagem física (candidata)

A proposta de material novo exige confirmação do proprietário e custo unitário explícito. Cria o material com saldo zero, preserva compras, movimentos e fichas técnicas e guarda um recibo por missão e linha na mesma transação do incremento da revisão canónica. Uma repetição não duplica o material. O saldo contado exige aprovação independente. Qualquer alteração da revisão exige nova análise. Receber e validar a Cloud antes de editar noutro dispositivo. Não aplicar SQL em produção sem autorização e ensaio de sincronização.

## Isolamento de autenticação e faturação

Os quatro endpoints usam a mesma autenticação de proprietário do projeto configurado em INTELLIGENCE_SUPABASE_URL; os assistentes legados também verificam a identidade do executor antes de reservar despesa. As fotografias dos assistentes de descrição e publicações só são aceites no bucket público artessencia-shop do projeto configurado. O fornecedor pago só pode ser composto num deployment VERCEL_ENV=production ligado ao projeto de produção autorizado, além dos restantes bloqueios de faturação. Nos ensaios, o transporte e o fornecedor são injetados; ainda não existe um modo de ensaio alojado ativado. Nenhuma variável ou recurso Cloud foi alterado por este commit.

## Normalização de referências nas fichas técnicas (candidata)

A auditoria de Stock propõe referências sem correspondência exata com um único candidato por normalização de acentos, maiúsculas e espaços. Mostra código, linha, nomes, quantidade, unidade e custo unitário. A ação explícita do proprietário revalida a revisão canónica, produto, ausência de receita legada, custo, unidade e inexistência de linha duplicada. Corrige apenas item da ficha e guarda recibo idempotente. Não renomeia o material nem consolida saldos. O custo calculado de uma ficha anteriormente incompleta pode mudar. Testar em Cloud isolada e confirmar sincronização antes da publicação.

## Pré-visualização de renomeação e consolidação (candidata)

Em Documentos produzidos, uma missão de Stock concluída permite consultar o impacto de dois nomes exatos no estado canónico. A análise mostra saldo, unidade, valor simulado, referências de fichas e contagens de referências relacionais, sem devolver dados de clientes ou alterar dados. Para fusão, identidade e origem distinta dos saldos têm confirmação independente. Histórico, referências adicionais, diferenças de custo, unidade ou metadados bloqueiam a simulação. A ausência de bloqueios nesta pesquisa conservadora não constitui prova de segurança para executar uma fusão: a transação de execução e a reconciliação de histórico continuam pendentes. Não existe botão de gravação nesta pré-visualização.

## Execução transacional candidata de Stock

O circuito permanece desligado por defeito em stock_change_release e não pode ser ligado pelo proprietário nem pelo executor de IA. A fixture liga-o apenas em dados fictícios. A confirmação compara a pré-visualização completa com a análise refeita sob bloqueio canónico e bloqueios de escrita nas tabelas relacionadas (NOWAIT). Preserva os restantes campos e os movimentos; só consolida saldos físicos distintos confirmados, custos e metadados compatíveis, sem identificadores não reconciliados. Recibo e revisão são atómicos. A reversão explícita exige a mesma revisão e estado posterior, sem alterações relacionais; caso contrário é bloqueada. Referências históricas e casos complexos continuam por reconciliar. A pesquisa conservadora e os bloqueios de tabela precisam de revisão de esquema, concorrência e sincronização antes de qualquer ativação Cloud. Nenhuma alteração de produção é autorizada por este código.

## Propostas internas do Gestor Comercial (candidata)

A missão comercial lê apenas referências, estados e datas autorizadas de orçamentos abertos e pedidos novos, com impressão digital do registo. Propõe ações internas de revisão. O proprietário guarda individualmente a proposta persistente se a origem continuar válida; repetição não duplica. Em Orçamentos, o painel Gestor Comercial consulta as propostas aprovadas e assinala origens alteradas ou encerradas. Quando o identificador local coincide inequivocamente, abre o editor de orçamento existente. Não cria um orçamento com cliente, produtos, preços ou quantidades inventados, não modifica o registo comercial, não converte em encomenda e não envia comunicações. A geração de um novo orçamento completo continua a depender dos dados e da aprovação correspondentes.
