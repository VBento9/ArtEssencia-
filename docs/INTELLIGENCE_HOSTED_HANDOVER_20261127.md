# Consolidação operacional — 27/11/2026

Esta entrega é candidata; não representa ativação da equipa em produção.

## Estado confirmado antes das alterações

- Main: `812ef1a0d53ac467413085b0b5d1f51aa25c704b`.
- Intelligence: `bcf1b833bdb0505bfe11f2e6fb0267c0119edcac`.
- Reuniões: `feeeed928c8b5c9620836d4add8dec37c603a292`.
- Produção Vercel READY: `dpl_7jG42yvuMqpNhK2gkGkAqnxb3Ujy`, main 812ef1a.
- Resposta pública de `/version.json`: 1.9.196. Candidata preservada: 1.9.197.
- Supabase produção: consultas a `to_regclass` e `to_regprocedure` devolveram NULL para team_controls, ai_budget_control, worker_v1 e service_v1. A ausência do esquema operacional impede executar a equipa na produção atual.
- Supabase isolado: 17 movimentos financeiros liquidados, custo acumulado 14 677 microEUR, reserva pendente zero, saldo do ensaio 985 323 microEUR. Teto acumulado 1 EUR. Serviço e autorização temporária desligados. Miguel mantém a missão aae20cec-f3d9-420f-ac24-9e1cc32ae250 em review_ready, revisão 7. Não foi repetida.
- As variáveis Intelligence existentes na Vercel estão associadas à preview da branch Intelligence; não existe configuração equivalente em produção.

## Alterações implementadas nesta consolidação

1. Integração da branch de reuniões na branch Intelligence, preservando ambas as linhagens.
2. Pedido HTTP regista o claim transacional antes de responder 202. O trabalho fica ligado a `waitUntil` da Vercel, com máximo explícito de 300 segundos. Fechar o navegador deixa de ser o mecanismo que sustenta a execução.
3. Duplicações continuam impedidas pela revisão, claim e lease do SQL existente. Não há repetição automática de chamadas de IA perante resultado financeiro incerto.
4. Disponibilidade verifica a identidade real devolvida pela Cloud, além da configuração local. Um binding revogado não deve apresentar execução disponível.
5. Transporte de conta de serviço admite produção apenas no projeto principal, com libertação técnica explícita, sem JWT concorrente nem modo de ensaio. Login e renovação permanecem exclusivamente no servidor. A libertação técnica não autoriza despesa.
6. Migração candidata `sql/intelligence-hosted-service-v1.sql`: binding privado, sem linhas instaladas, desativado por defeito, verificação de sessão ativa e de proprietário em cada RPC, lista fechada de comandos, sem privilégios diretos de tabela para a conta de serviço. Não instalada em nenhuma Cloud nesta intervenção.
7. Dependência @vercel/functions 3.12.0 com lockfile; preservadas as dependências de OIDC e ingestão de email.
8. Workflow isolado abrange ambas as branches e inclui a fixture SQL da autenticação alojada.

## Evidência local executada

- 81 testes Node aprovados, incluindo aceitação HTTP após claim, continuação sem consumidor, falhas de claim, revogação, renovação concorrente, autenticação de produção e consulta de disponibilidade Cloud.
- Fixture SQL principal PGlite: passou; inclui composição dos nove departamentos, delegação, memória, reservas e recuperação de execução interrompida.
- Fixture SQL de ensaio: passou; limite acumulado, separação de modelos, validade e serviço desativado.
- Fixture SQL de recuperação de auditoria: passou; histórico e recibos preservados, nova aprovação obrigatória.
- Fixture SQL de serviço alojado: passou; binding desativado, sessão expirada, revogação, identidade do proprietário, impossibilidade de alteração direta das permissões e manutenção do bloqueio financeiro do worker.
- Chromium: revisão de Stock e Central com SQL passaram, incluindo 390, 820 e 1440 píxeis; preparação de reuniões sem chamadas pagas.
- PostgreSQL 17: reservado para o workflow remoto; não declarar aprovação local deste motor.

Os testes usam dados sintéticos. Os testes de continuação de HTTP injetam o servidor e o fornecedor; não equivalem a prova de IA real na Vercel com o navegador fechado. Não foram feitas chamadas pagas adicionais.

## Limites e bloqueios que permanecem

- `waitUntil` tem o mesmo limite da função; não é uma fila durável ilimitada. O claim persiste. Se a função terminar abruptamente, o tick existente recupera leases após dez minutos e bloqueia a missão para reconciliação, sem voltar a gastar. O cron configurado é diário às 07:15 UTC, não um serviço contínuo com recuperação imediata.
- A autenticação de produção está implementada e testada em fixture, mas ainda exige instalar o esquema, criar uma conta técnica distinta do proprietário, configurar os segredos no servidor e ativar o binding. Não alterar a palavra-passe do proprietário.
- Não há prova de limite rígido do fornecedor. Mantém-se o bloqueio financeiro: não preencher `providerHardLimitVerified` com base em alertas ou no orçamento indicado no painel OpenAI. O saldo pré-pago em USD não equivale ao saldo interno em EUR. Nenhum teto foi aumentado.
- Não foi instalada a infraestrutura Intelligence na Cloud principal nem foi publicada a candidata no domínio principal.
- A branch executiva contém preparação de reuniões como missão de Leonor e consulta de relatórios. Não contém reuniões interativas reais multiagente, atas persistentes com revisão, acompanhamento completo de compromissos nem todo o calendário empresarial solicitado. A interface mantém essa limitação explícita.
- Os nove perfis e currículos existem e têm validação sintética. Só Leonor e Miguel têm a evidência histórica indicada de IA real no ensaio; isso não prova operação individual dos restantes sete nem operação em produção de qualquer funcionário.
- Não foi confirmada atualização das PWA nos dispositivos físicos; a versão candidata ainda não foi publicada. Sem reinstalação prevista; manter os testes de paridade e o mecanismo de atualização existentes.

## Próxima operação de produção a aprovar, após revisão

Instalar de forma controlada o esquema Intelligence e a ponte de conta de serviço no Supabase principal, inicialmente com equipa e faturação desligadas, preservando dados canónicos e políticas existentes. Depois configurar a conta técnica apenas no servidor e validar autenticação sem IA. Não publicar nem ativar despesa, rotinas ou modos automáticos como efeito lateral dessa aprovação. A ativação paga depende de autorização financeira válida e dos controlos exigidos, não apenas desta instalação.

Ordem de dependências do esquema: orçamento, equipa, execução, contexto de Stock, consola de proprietário, contexto departamental, worker, recuperação de auditoria e finalmente serviço alojado. Rever individualmente os scripts antes da instalação; os ficheiros históricos têm limites e autorizações por defeito que não substituem os limites aprovados do proprietário. O SQL de contagem física é separado e não deve ser ativado por conveniência.

Loja Online permanece fechada. DONART não foi intervencionado. Dados comerciais reais não foram usados para testes de escrita.

## Instalação autorizada em produção — 27/11/2026, 23:25 UTC

Após autorização expressa do proprietário, foi aplicada a migração `20261127232542_intelligence_production_disabled_foundation_v1` no projeto `ihtsonqnnlrxvorfrarl`. O SQL exato está em `sql/deploy/intelligence-production-disabled-v1.sql`, incluindo preflight, dependências e postflight numa única transação. A instalação integral passou previamente em PGlite, com leitura da consola e rejeição do serviço sem binding.

Estado confirmado diretamente depois da instalação:
- Uma configuração de equipa para o proprietário existente; equipa desativada e nove modos off.
- Orçamento de produção: limite 0 microEUR, congelado, release_enabled=false. Esta decisão não altera o teto de 1 EUR do ensaio nem concede despesa em produção.
- Zero missões, rotinas, bindings de serviço ou movimentos financeiros no novo esquema de produção.
- Todas as novas tabelas privadas com RLS; zero privilégios diretos de tabela para anon/authenticated.
- RPCs Intelligence inacessíveis a anon. Worker inacessível diretamente a authenticated; ponte de serviço exige binding, sessão e proprietário válidos. Funções SECURITY DEFINER com search_path vazio.
- Prova administrativa transacional: sem identidade, consola e ponte recusaram acesso; teste terminado com ROLLBACK, sem criar missões ou dados de teste. Isto verifica rejeição, não um login real do executor.
- Advisor de saúde sem avisos. Avisos de RLS sem políticas nas tabelas privadas representam negação por defeito; os acessos autorizados passam pelas RPCs. Não foram alteradas as funções públicas do Catálogo ou da Loja para eliminar avisos preexistentes.

Ainda não há conta técnica de produção criada ou segredo de executor configurado. O conector Supabase não dispõe de administração de utilizadores Auth; a alternativa de navegador chegou à página de início de sessão, sem sessão administrativa ativa. Não criar utilizadores mediante escrita direta nas tabelas internas Auth nem alterar a palavra-passe do proprietário. A próxima dependência é autenticação administrativa segura para preparar a conta técnica. Nenhuma chamada OpenAI, publicação de frontend, ativação de equipa, automatismo ou despesa foi efetuada nesta instalação. A aplicação pública permanece 1.9.196; candidata 1.9.197.

## Preparação da publicação controlada — 28/11/2026

O proprietário autorizou a publicação da candidata 1.9.197 com a equipa e a faturação desligadas. A conta técnica foi criada pelo proprietário e confirmada, sem estatuto de proprietário; o binding mantém-se desativado. As variáveis de produção foram preparadas e a palavra-passe foi introduzida pelo proprietário diretamente na Vercel, como Secret. O valor não foi lido nem registado.

A verificação `intelligence/deployment-auth-check.cjs`, integrada no build, valida apenas a configuração técnica de produção autorizada: autentica a conta, confirma a identidade via Auth, confirma que não é proprietária, exige rejeição pela ponte de execução desativada e termina a sessão temporária com scope=local. Não importa o fornecedor de IA nem cria missões. Qualquer falha interrompe o build antes da promoção do deployment. Os testes locais cobrem credenciais incorretas, identidade divergente, privilégios de proprietário, binding ativo, falha de logout e ausência de repetições. Nesta candidata, ativar o executor requer revisão deste bloqueio de publicação e autorização financeira independente; não basta alterar uma variável.

84 testes Node passaram antes da publicação. A evidência de autenticação real só poderá ser declarada depois do build de produção. Versão de recuperação preservada: deployment dpl_7jG42yvuMqpNhK2gkGkAqnxb3Ujy, main 812ef1a, aplicação 1.9.196.
