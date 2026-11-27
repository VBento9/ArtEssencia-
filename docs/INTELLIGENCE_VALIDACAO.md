# Validação do ArtEssencia Intelligence

Base de desenvolvimento `34bc6c3`. A produção observada estava na versão 1.9.196, em `64e0f0f`. O catálogo e a loja não precisam deste SQL para funcionar.

## Circuitos disponíveis para teste isolado

A Central usa a sessão Supabase do Backoffice e o comando de proprietário `artessencia_intelligence_console_v1`. A leitura agrega as últimas 100 missões, os últimos 100 eventos, até 100 memórias e 50 documentos recentes. A vista de desempenho cobre essa janela. Ativar a equipa e escolher um modo permite registar missões. A autorização de uma missão e a execução pelo servidor são operações distintas. A falha de transporte exige atualizar a vista antes de repetir uma ordem.

A rotina privada `team_tick()` prepara missões para funcionários em modo automático. A configuração é individual e a data de trabalho segue Europe/Lisbon. O bloqueio das linhas e o período guardado impedem duplicação no mesmo período. A instalação SQL não agenda a função. Cada missão preparada começa por aguardar revisão. O Diretor pode delegar uma missão aprovada uma vez por departamento. Cancelar a missão principal cancela as filhas ainda ativas.

O executor de revisão em `intelligence/review-worker.cjs` recebe uma ligação SQL de servidor. O circuito integrado foi exercitado para o Diretor e para a auditoria de inventário do Stock. Os testes simulam exclusivamente a resposta HTTP do fornecedor nesse circuito. O executor obtém a missão, o titular, a reserva, o contexto e o resultado através das funções SQL. Os três assistentes antigos usam agora a contabilização comum. A composição distribuída para estes endpoints suspende o consumo até existir uma configuração de faturação aprovada.

A ação de aprovação para Planeamento lê a proposta persistente, grava em `artessencia_cloud_records` com entidade `operational_tasks_v1` e confirma o identificador gravado. Repetições preservam o estado da tarefa. A memória profissional pertence ao departamento, exige uma missão concluída como evidência, tem prazo e admite correção, revogação e eliminação explícita após revogação.

## Reprodução isolada

- Executar `node scripts/test_intelligence_all.cjs`.
- Instalar as versões de PGlite, pg e Playwright indicadas em `.github/workflows/intelligence-isolated.yml` num diretório temporário.
- Executar `scripts/test_intelligence_count_sql.cjs` com PGlite e também com `--postgres` numa base descartável vazia chamada `intelligence_fixture`, em loopback na porta 55433. O teste recusa uma ligação remota.
- Executar os dois testes de navegador do workflow. A Central usa o mesmo comando SQL numa base PGlite partilhada pelas três sessões Chromium com larguras de 390, 820 e 1440 píxeis.

## Ativação e reversão

A integração completa continua em desenvolvimento. A revisão final requer os adaptadores canónicos restantes, validação individual dos departamentos, executor implantável com credenciais limitadas, integração do agendador e conciliação com faturação independente. Verificar os planos, o IVA aplicável, a taxa efetiva de câmbio, as recargas, os custos pendentes e os custos de infraestrutura antes de propor ativação paga. A configuração por defeito bloqueia as chamadas. A existência de uma chave de API é insuficiente para as autorizar.

Numa instalação de validação, aplicar as dependências SQL de orçamento, equipa, execução, contexto de stock e consola nessa ordem. Uma reversão suspende primeiro a entrada de trabalho e a faturação. Preservar as tabelas de missões, recibos e custos pendentes para reconciliação. O seguinte bloco destina-se exclusivamente a um administrador da instalação selecionada, depois de confirmada a intervenção.

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
