# Executor remoto Intelligence — 27/11/2026

## Âmbito

O workflow `.github/workflows/intelligence-remote.yml`, instalado em `main`, valida código fixado por SHA. O job gratuito usa dados fictícios, PostgreSQL 17, PGlite e Chromium. Não recebe segredos. O job `execute` só é admitido por `workflow_dispatch` em `main`, depois da validação, no ambiente `intelligence-isolated`. Não contém operações de publicação. Há exclusão mútua entre execuções e prazos de 10 minutos para validação e 4 para uma missão. Não há repetição automática de uma chamada paga.

O código continua na branch Intelligence. Não foi integrado o PR #276 em produção. `vercel.json` ignora apenas o commit com o assunto exato `ci(intelligence): install remote executor without app deployment`; os commits normais continuam elegíveis para build. Confirmada a tentativa Vercel `dpl_4rn4y1JR9WXAM9QqEERZ8fTfmPRn` como CANCELED, sem substituir a versão instalada.

## Configuração confidencial indispensável

O ambiente GitHub `intelligence-isolated` foi criado e limitado à branch `main`. A configuração simplificada usa a variável `INTELLIGENCE_REMOTE_PUBLIC_CONFIG` com `publishableKey`, `serviceId` e `serviceEmail`, e dois segredos separados: `INTELLIGENCE_SERVICE_PASSWORD` e `INTELLIGENCE_OPENAI_API_KEY`. O proprietário introduz apenas a palavra-passe da conta de teste e a chave dedicada, individualmente, nos formulários GitHub. A variável `INTELLIGENCE_FINANCIAL_APPROVAL` permanece ausente até verificação das evidências; a ausência bloqueia chamadas pagas. O formato antigo `INTELLIGENCE_REMOTE_CONFIG` continua reconhecido exclusivamente quando nenhum campo novo foi configurado; configurações misturadas são recusadas. Usar exclusivamente a conta de serviço e a chave dedicada do projeto isolado. Não guardar a palavra-passe do proprietário, a chave de produção, um JWT privilegiado, anexos ou informação de clientes. Não colocar o JSON em commits, comentários, logs ou mensagens.

A aprovação financeira remota tem âmbito `isolated_remote_trial_v1`, validade máxima de duas horas e os campos conservadores existentes em `intelligence/local-trial-pricing.cjs`. A observação de consumo do fornecedor aceita consumo anterior reconciliado; exige `usageReconciled: true`. Os valores devem provir da conta API, nunca ser inventados. A autorização Cloud `trial_release` tem de estar ativa, dentro do prazo, com o teto acumulado de 1 EUR. Não aumentar o teto nem ativar faturação de produção. A existência do segredo e o acesso ao fornecedor não foram confirmados nesta intervenção: o conector não expõe gestão de segredos e o navegador GitHub estava sem sessão.

O executor não cria nem aprova missões. Recebe UUID e revisão de uma missão existente já aprovada pelo proprietário. A RPC verifica identidade, autorização e revisão sob bloqueio; o ledger reserva de forma transacional. Missões consumidas/bloqueadas não são repetidas. Falhas e interrupções mantêm os recibos e as reservas incertas para reconciliação; a recuperação existente foi exercitada nas fixtures. O prazo do job termina o processo, mas não prova ausência de cobrança no fornecedor após interrupção. Consultar sempre o ledger antes de qualquer nova tentativa.

## Estado financeiro e missão Miguel

Consulta Cloud desta intervenção: 16 recibos liquidados, dos quais 14 simulados a custo zero e dois reais. Total interno 11 490 microeuros = 0,011490 EUR; reservas pendentes 0; disponível no teto vitalício de 1 EUR: 0,988510 EUR. Não substitui a fatura/consulta de consumo do fornecedor. Esta intervenção não efetuou chamadas pagas.

A missão `aae20cec-f3d9-420f-ac24-9e1cc32ae250` está `blocked`, revisão 3, etapa `reasoning`, custo liquidado 4 208 microeuros. O registo antigo tem diagnóstico nulo; não é possível distinguir com rigor uma resposta incompleta de uma decisão inválida a partir dessa evidência. Não se libertou nem cobrou novamente a reserva de 0,424875 EUR: já tinha sido substituída pelo custo efetivo no ledger. As correções anteriores `9b50dd2` restringem o contrato de decisão e guardam diagnósticos seguros para futuras falhas. A resposta antiga não está disponível para reprodução exata. Não foi alterado o estado para fingir conclusão e não foi criada uma cópia da missão.

As delegações Comercial `dcd1d5c9-2a53-4c77-94f8-ef81e740ed23` e Marketing `34d20a10-c750-4474-a49d-53db3b09c676` continuam pendentes de revisão. A autorização da missão Miguel não autoriza automaticamente estas duas missões.

## Nove funcionários e evidência Cloud

| Funcionário | Função | Missões simuladas concluídas | Missões IA real concluídas | Observação |
|---|---|---:|---:|---|
| Leonor | Direção | 3 | 1 | Três delegações propostas pela missão real |
| Tomás | Stock | 4 | 0 | Escritas reais não validadas |
| Duarte | Produção | 1 | 0 | IA real por validar |
| Sofia | Financeiro | 1 | 0 | IA real por validar |
| Inês | Comercial | 1 | 0 | Delegação real pendente |
| Clara | Marketing | 1 | 0 | Delegação real pendente |
| Beatriz | Catálogo | 1 | 0 | Apresentação pública por validar |
| Matilde | Inovação | 1 | 0 | IA real por validar |
| Miguel | Auditoria | 1 | 0 | Uma missão real bloqueada |

Modelo do piloto: `gpt-5.4-mini-2026-03-17`. As identidades, formação e responsabilidades existentes foram preservadas. Existe uma memória Cloud persistida e cinco vínculos de delegação, mas isso não comprova memória prática e aprendizagem validada de cada funcionário. As 20 tabelas privadas no projeto isolado têm RLS ativa; não equivale a uma auditoria completa de todas as funções e permissões.

## Produção e publicação

Cloud principal `ihtsonqnnlrxvorfrarl`: esquema privado Intelligence ainda inexistente. Nenhuma migração foi aplicada em produção nesta intervenção. Backoffice de produção confirmado em `64e0f0f`, versão 1.9.196, deployment READY `dpl_5K4esNfNARZZQVYvBTeY4WSYwQmh`. O novo commit de infraestrutura em main não publica a Central. A atualização da PWA e a sincronização em dispositivos instalados não foram comprovadas. DONART não foi modificado. Não se alteraram configurações de encomendas nem dados reais.

## Validação executada nesta intervenção

- `node scripts/test_intelligence_all.cjs`: 65 entradas de teste aprovadas (inclui suites históricas com asserções internas), zero falhas.
- PGlite: fixture completa de departamentos, delegação, stock, memória, recibos, permissões e recuperação aprovada.
- Migração real do teto de ensaio na fixture descartável: aprovada, incluindo mudança de mês sem reiniciar o teto vitalício.
- Chromium/Playwright: revisão Stock, rejeição por revisão antiga, recusa de não proprietário e limpeza de bloqueios aprovadas.
- Central com SQL persistente e três larguras de dispositivo (390, 820, 1440): aprovada, incluindo nove modos, missão, aprovação, cancelamento e pré-visualização sem escrita canónica.
- GitHub Actions: execução remota `46047157913`, job validate concluído com sucesso, incluindo PostgreSQL 17; job execute corretamente ignorado na execução automática.

Os testes remotos de contrato usam fornecedor simulado. Não constituem prova de execução paga pelo GitHub nem de acesso à Cloud pelo segredo remoto. Esta distinção é obrigatória antes da entrada em produção.

## Verificação remota sem geração de IA

A operação manual `preflight` usa os dois segredos separados apenas no runner. Faz uma autenticação Supabase da conta de serviço no projeto isolado e um GET de metadados do modelo OpenAI. Não usa `/responses`, não cria missões, não reserva orçamento nem ativa o circuito pago. Os logs devolvem apenas booleanos, código HTTP e modelo fixo; não incluem tokens, chaves, palavras-passe ou corpos de erro. A chave existir no GitHub não prova que é válida nem que pertence ao projeto dedicado. Um GET de modelo aprovado também não comprova saldo ou reconciliação financeira. A autorização Cloud e a aprovação financeira mantêm-se independentes.
