# ArtEssencia — Plano de testes transacionais (NÃO EXECUTAR EM PRODUÇÃO)

Data: 2026-10-13.

## Pré-condições
- Branch de desenvolvimento Supabase separada, sem dados reais.
- Instalar as duas funções SQL propostas apenas nessa branch depois de rever os seus privilégios.
- Criar conta proprietária de teste e conta sem permissões, com duas sessões concorrentes.
- Não utilizar exemplos de preços/códigos postais como definições comerciais.

## Matriz de testes
| Caso | Procedimento | Resultado obrigatório |
| --- | --- | --- |
| T01 | Gravar rascunho com revisão atual | Só deliveryZoneConfig muda; revisão +1 |
| T02 | Gravar rascunho com revisão antiga | Rejeitado; nenhuma escrita |
| T03 | Gravar entrega geral v2 com revisão antiga | Rejeitado; nenhuma escrita |
| T04 | Sessões A e B leem revisão N, A grava e B tenta gravar N | A confirma; B rejeitada |
| T05 | Guardar horário na v2 após guardar zonas | Zonas preservadas |
| T06 | Guardar zonas após atualizar horário na v2 | Horário preservado |
| T07 | Código postal duplicado entre localidades | Rejeitado |
| T08 | Valor de portes inválido/negativo | Rejeitado |
| T09 | JSON incompleto ou tentativa de ativação comercial | Rejeitado |
| T10 | Utilizador anónimo ou não proprietário | Rejeitado |
| T11 | Falha após primeira UPDATE na transação | Rollback de ambas as fontes |
| T12 | Chamada v1 antiga após edição de zonas | Demonstra risco e exige migração do chamador |
| T13 | Cloud push de estado antigo após RPC de zonas | Conflito e reidratação, nunca sobrescrita |
| T14 | Guarda geral seguida de gravação de rascunho | Mesma configuração nas duas representações |
| T15 | Guardar localidades não altera store_settings/store_status | Sem efeitos laterais |

## Bloqueios
1. A função v1 atualmente publicada não exige revisão; enquanto o Backoffice a chamar, o protocolo de concorrência v2 está incompleto.
2. O cloud push geral guarda snapshots completos; a migração deve atualizar corretamente a revisão local e recarregar o estado da Cloud.
3. Testar e rever permissões EXECUTE antes de instalar novas RPC.
4. A Loja continua sem cálculo de portes por localidade nem regra do prazo semanal no servidor.

## Aceitação
A migração só pode ser considerada após testes SQL numa branch real, testes do Backoffice no navegador e validação ponta-a-ponta do checkout. Não fazer deploy nem abrir a Loja como efeito dos testes.
