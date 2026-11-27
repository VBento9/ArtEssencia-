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

A ativação financeira exige decisão específica do administrador, tarifário verificado, limites e reconciliação independente do fornecedor. Requer aprovação no controlo SQL de orçamento, `INTELLIGENCE_OPENAI_API_KEY`, `INTELLIGENCE_PAID_RELEASE`, `INTELLIGENCE_TARIFF_ID` e `INTELLIGENCE_FINANCIAL_APPROVAL`. O último contém datas de verificação e validade, modelo, referência de evidência, estado das recargas, verificação da chave dedicada, reconciliação de consumo, custo bruto mensal máximo da restante infraestrutura, fator fiscal, limite superior de câmbio e preços por milhão de tokens. Os nomes dos campos, as unidades e os limites estão em `intelligence/approved-pricing.cjs`. As tarifas do fornecedor, a cotação efetiva, os impostos e o estado da conta exigem verificação à data de ativação. Os registos de liquidação de uso do modelo representam estimativas conservadoras em euros e exigem confronto com as faturas.

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

## Comparação pública de Catálogo e Loja (candidata)

Ambos os repositórios públicos consomem store_public_catalog_v1 e store_public_content_v3; a Loja consulta ainda store_public_config_v1. O executor lê apenas esses três RPC com chave publicável do projeto configurado, sem JWT de trabalhador ou credencial de proprietário, com limites e sem seguir redirecionamentos. Uma falha de leitura não é interpretada como catálogo vazio. O relatório guarda códigos, ocorrências e cobertura, não a resposta pública bruta. Compara nome, descrição, referência de imagem, família por mapeamento público e referências de coleções; disponibilidade e divergências de exposição exigem revisão, particularmente para edições exclusivas. Verifica a configuração de encomendas sem alterá-la. O teste integrado injeta respostas fictícias. Não comprova a apresentação nos sites nem o carregamento das fotografias; essas validações permanecem pendentes.

## Modo de execução alojada simulado (candidato)

O endpoint usa composeHosted antes de qualquer operação do executor. A simulação exige VERCEL_ENV=preview, INTELLIGENCE_EXECUTION_MODE=simulation, INTELLIGENCE_SUPABASE_URL igual a INTELLIGENCE_ISOLATED_PROJECT_URL, diferente dos projetos ArtEssencia e DONART, sem chave OpenAI, aprovação financeira ou libertação paga. Exige ainda marcador privado simulation_release do proprietário, desligado por defeito. O fornecedor determinístico interno gera documentos claramente marcados [SIMULAÇÃO], com zero tokens e zero custo liquidado, exercitando reservas fictícias do mesmo ledger. A fixture autoriza o ledger apenas na base descartável. A simulação recusa tarifas reais no SQL, não autoriza os assistentes legados, e revalida o marcador antes de cada comando. Nenhuma IA externa é invocada. O modo produção não pode usar a simulação. O GET autenticado pelo CRON_SECRET pode exercitar tick e missões em pré-visualização autorizada; o cron Vercel real de produção continua por validar e não deve ser confundido com uma chamada manual ao endpoint. Não foi criado ou configurado um projeto isolado. Não ativar os marcadores em produção.

## Formação profissional versionada AE-FORM-1.0.0

Os nove perfis estão definidos em intelligence/professional-training.json. O gateway inclui as regras comuns e os procedimentos específicos nas instruções de confiança antes de cada chamada. O resultado persistente contém versão e digest da formação, área, critério de qualidade e indicação de que a competência prática não foi avaliada. A interface Funcionários apresenta módulos, procedimentos, critério e exercício; Documentos produzidos mostra a formação aplicada. Não se trata de fine-tuning nem de aprendizagem autónoma, não altera permissões e não acrescenta chamadas de IA. A memória profissional aprovada permanece separada. Os exercícios são propostas de avaliação, não certificados de desempenho. Antes da entrada em produção, avaliar respostas reais com dados fictícios após autorização financeira e aprovação de cada competência.

## Avaliação profissional pelo administrador (candidata)

Documentos produzidos permite avaliar um resultado concluído com formação versionada. As cinco notas inteiras de 0 a 100 são calculadas no servidor: técnica 30%, procedimentos 25%, qualidade 20%, segurança 15%, eficiência 10%. Resultado satisfatório exige total >=85, segurança >=85 e ausência de falha crítica. Justificação obrigatória. A avaliação preserva versão/digest da formação e digest do resultado, usa o modelo registado no ledger para distinguir simulação de fornecedor por validar, e guarda histórico sem modificar avaliações anteriores. Repetição idêntica devolve recibo; conflito é recusado. Funcionários mostra última avaliação recente da versão. A avaliação mede apenas uma entrega, não certifica o agente nem altera modos, permissões ou orçamento. Os exemplos são fictícios; avaliação com IA real e trabalho supervisionado permanecem pendentes.

## Formação complementar e lições aprovadas

Uma avaliação com resultado needs_training mostra critérios abaixo de 85 e falhas críticas. O proprietário escreve e aprova separadamente uma lição geral, sem importar automaticamente o feedback ou dados fictícios. A lição usa a memória profissional já existente, é limitada ao departamento de origem e à validade de 364 dias; o executor recebe até seis memórias recentes, ativas e não expiradas. A aprovação cria um vínculo idempotente por avaliação; não altera modos nem orçamento. Correção, revogação e eliminação seguem o circuito existente. O vínculo conserva apenas identificadores, permitindo mostrar estado eliminado sem guardar uma segunda cópia do texto. Uma lição revogada ou eliminada não é recriada por repetição. A fixture verifica que a lição aparece no contexto de uma missão posterior. Não existe aprendizagem automática, certificação real ou autorização de ação decorrente desta aprovação; a reavaliação continua a exigir nova missão e análise do administrador.

## Constituição da equipa AE-EQUIPA-1.0.0

Nove identidades profissionais fixas, ligadas aos identificadores de departamento existentes, sem novas contas, fornecedores ou subscrições. O diretório inclui nomes, cargos, sugestões de primeira missão e cadência. Nenhuma rotina é criada/ativada automaticamente. O gateway inclui a identidade nas instruções da missão; a Central mostra nomes e referências de planeamento por funcionário. As nove referências somam 21 EUR e os três assistentes antigos partilham uma referência de 2 EUR, perfazendo 23 EUR; os 7 EUR restantes destinam-se à reserva de segurança e outros custos previstos. São referências indicativas, não limites individuais: o único bloqueio monetário obrigatório continua no ledger comum de 23 EUR, com reservas atómicas e suspensão por custo desconhecido. A interface consulta gastos e reservas do mesmo ledger e mostra o seu estado, sem inferir que existe autorização do fornecedor. Não ativar chamadas pagas até validação financeira e autorização expressa. Nenhum custo ou recurso externo foi criado por esta alteração.

## Validação financeira antes da primeira chamada real

Tarifa pública consultada em 27/11/2026: GPT-5.4 mini gpt-5.4-mini-2026-03-17, USD 0,75/M entrada e USD 4,50/M saída (https://developers.openai.com/api/docs/models/gpt-5.4-mini). Esta consulta não valida a conta. O proprietário deve confirmar projeto API exclusivamente dedicado, chave dedicada com restrições, limite rígido do fornecedor realmente aplicado (não apenas alerta), recarga automática desligada, reconciliação de uso e custos externos pendentes, impostos, limite superior cambial e infraestrutura. A autorização documentada deve corresponder ao mês de Lisboa, durar no máximo sete dias e expirar até ao início do mês seguinte. O teto do fornecedor em micro-USD, convertido com limites superiores de câmbio e encargos, não pode exceder 23 EUR brutos; a soma com outros custos mensais não pode exceder 30 EUR. O JSON de aprovação contém budgetMonth, ownerApprovalRef, exclusiveProjectVerified, providerHardLimitVerified, providerHardLimitMicroUsd, taxVerified, exchangeUpperBoundVerified, pendingExternalCostsReconciled, além dos campos anteriores. Estes campos representam evidências verificadas pelo administrador, não uma consulta automática de faturação. Não preencher com valores fictícios num deployment real. A autorização só pode ser instalada após aprovação expressa e validação Cloud. Não transmitir chaves ou credenciais por chat, GitHub ou registos. A subscrição ChatGPT não substitui a faturação API. Nenhuma chamada real nem alteração de faturação efetuada nesta intervenção.

## Credencial dedicada da equipa

O executor Intelligence e os três assistentes integrados no seu ledger usam exclusivamente INTELLIGENCE_OPENAI_API_KEY, sem fallback para OPENAI_API_KEY. Preservar as variáveis existentes da aplicação em produção. Guardar a chave nova num gestor de palavras-passe até à autorização de configuração do ambiente de produção, sem a transmitir por chat ou GitHub. Não instalar a chave em Preview/Development ou no ambiente de simulação. O modo simulado rejeita ambas as variáveis de chave. Não configurar libertação financeira nem efetuar redeploy de produção nesta fase.


## Limite financeiro interno configurável (candidato)

O limite partilhado `ai_budget_control.monthly_limit_microeur` começa em 2 000 000 microeuros (2 €) e aceita 0 a 23 000 000 microeuros. Só a administração da base pode alterá-lo; não existe RPC para aumentar o limite. A reserva e a autorização de consumo reavaliam a despesa sob o bloqueio comum. Se o limite baixar depois de uma reserva, o pedido ainda não iniciado fica bloqueado e a reserva deve ser reconciliada, sem repetir pedidos. O painel lê o limite efetivo da base; na ausência do campo, apresenta-o como por confirmar. O limite interno não substitui o controlo de saldo, a verificação de preços, o limite do fornecedor nem a faturação da infraestrutura. O esquema de simulação histórica permanece exclusivamente a custo zero; não executar migrações sobre a base de ensaio existente ou produção sem revisão e autorização. A ativação de IA real continua bloqueada.


## Separação da execução manual e programada (candidata)

O endpoint GET do agendador autentica o segredo e verifica o interruptor antes de compor o executor. Em preparação sem faturação, só prepara rotinas. O processamento programado pede uma fila explicitamente limitada aos modos semi e auto; o SQL confirma essa política e volta a validá-la sob bloqueio antes da aquisição. Uma missão Manual, mesmo aprovada, só deverá ser executada através do pedido explícito do proprietário. O servidor recusa uma versão SQL que não confirme a política de fila. O ciclo inicia no máximo nove trabalhos por chamada e não inicia outro depois do prazo de 45 segundos (prazo de admissão, não garantia de duração de um trabalho em curso). Testes isolados verificam autenticação, suspensão, limites, fila e decisões SQL; o disparo pelo alojamento e a execução com fornecedor real permanecem pendentes.


## Ensaio real isolado (candidato, autorizado até 1 EUR)

Modo `trial` exclusivo do Preview da branch Intelligence, projeto Cloud isolado e conta de serviço dedicada. Requer autorização financeira verificada, chave privada exclusiva e dupla autorização do servidor e da base; nenhuma é ativada pelo código. O novo SQL isolado exige encerramento da simulação e ausência de despesa real ou missões abertas, instala a autorização desligada, reduz o limite a 1 EUR e mantém um teto acumulado vitalício independente do mês. Autorizações podem durar no máximo 24 horas. Apenas missões explícitas do proprietário, equipa em Manual/Off, sem rotinas, sem assistentes legados, sem anexos no ensaio inicial e sem leitura externa do catálogo. Propostas de delegação continuam sujeitas a aprovação. A chave de produção, os dados reais e o modo de produção continuam excluídos. Custos desconhecidos bloqueiam novas chamadas; o consumo contabilizado internamente não substitui reconciliação externa. Não aplicar o SQL nem instalar credenciais antes dos testes e confirmação das evidências financeiras. Não reutilizar chaves expostas.


## Ensaio local no Mac (candidato)

O comando `node scripts/run_intelligence_local_trial.cjs` usa Node 22+, sem dependências adicionais, sem servidor HTTP local e sem alojamento comercial. Reutiliza a conta titular e a conta de serviço exclusivamente do projeto isolado. O modo local é distinto do ambiente Vercel e não pode entrar no endpoint alojado nem no circuito de produção. As credenciais são solicitadas no Terminal, sem eco para os segredos, e não são gravadas pelo executor. A aprovação financeira JSON continua obrigatória e não deve conter atestações falsas. O executor valida o orçamento Cloud, ausência de missões abertas e rotinas, modo manual e identidade antes de pedir confirmação para uma missão da Diretora. Não há repetição automática, execução programada nem instalação de subscrição. Após a missão, verificar o recibo e encerrar a autorização Cloud. A configuração de alojamento real comercial não fica resolvida com este ensaio. Não executar antes de validar os testes e as evidências financeiras.
