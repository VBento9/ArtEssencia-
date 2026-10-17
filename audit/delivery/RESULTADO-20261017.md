# Entregas por localidade — resultado e limitações

Base Backoffice: c162ec2 (produção V1.9.7). A branch 82b9852 contém ajustes antigos não presentes nesse deployment; foram aproveitadas as regras compatíveis, preservando o editor por campos separados. Base Loja: main 19c35a0; reutilizada a integração de checkout da branch feature/entregas-seguras-2026-10-16 (951d4872), sem publicar os seus antigos rascunhos SQL.

## Implementado
- Backoffice V1.9.8: localidade, portes editáveis, estado, cartões existentes, edição e eliminação com confirmação. Não exige CP manuais; preserva eventuais restrições existentes. Não usa preço obrigatório pré-preenchido. Alterar nome no modo de edição renomeia a zona, sem deixar uma cópia anterior.
- Taxa geral e prefixos legados apenas informativos. Sem levantamento. Regras visíveis: domingo/segunda, 48h e corte de sexta em Europe/Lisbon. Guardar configurações alinha os campos legados explicitamente; renderizar não modifica dados reais.
- Supabase: alteradas seis funções existentes, mesmas assinaturas/permissões. Sem novas tabelas/RPC. Global desativado prevalece sempre sobre exceções. Cotação respeita o global. Leitura do proprietário informa contagem postal; ativação de localidade sem referência é recusada. Calendário inclui localidades ativas com referência e horários calculados no servidor.
- Loja: seletor obtém localidades da Cloud; cotação por localidade+CP7, sem confiar na taxa global; alteração de morada invalida cotação; nova cotação no envio obriga a rever total se preço mudou. Encomenda envia localidade. Horários gerados no servidor.
- Preservados vouchers e cálculo definitivo de portes no servidor; não se aceita do navegador o valor usado no cálculo. PWA Backoffice mantém manifesto/identidade/armazenamento; release alinha HTML/version.json/cache.

## Segurança e testes
- 32 verificações PostgreSQL isoladas (PGlite). Executam definições reais exportadas com tabelas e dados fictícios; apenas elegibilidade de voucher e rate limiting são stubs. Aritmética e idempotência de store_submit_order_v2 são as existentes. Incluem reprodução do bug global/exceção antes da correção e confirmação depois, propriedade, preços, prefixo insuficiente, localidade incompatível, inatividade, quantidades, levantamento, encerramentos, horários, mínimo, capacidade, desconto e duplicação.
- Oito cenários de datas executados em SELECT sobre a função real no Supabase: quinta, corte de sexta, semana seguinte, inverno, menos de 48h, terça, mudança de hora de outono e primavera. Todos aprovados.
- Chromium isolado, rede externa bloqueada: arranque e navegação de nove módulos; gravação e falhas simuladas; campos antigos bloqueados. Loja: seletor, preço correto, invalidação postal, remoção da localidade e slots do servidor. Sem erros de página.
- Testes PWA/worker existentes aprovados. Sintaxe dos scripts conferida.
- Após migração real: estado da Loja preservado (updating, enabled=false, accepting_orders=false), entrega desativada, Castelejo inativa com tarifa 300 cêntimos preservada, referência postal com zero registos, zero datas/localidades públicas disponíveis; cotação recusada; permissões internas e de proprietário mantidas.
- Não foram criadas encomendas nem clientes de teste em produção. Não foram alterados produtos, stocks, encomendas, clientes, tarifas reais ou configurações reais da loja.

## Bloqueio postal e alcance real
A tabela artessencia_postal_locality_reference tem zero registos. Nenhuma localidade está autorizada a entregar apenas por ter sido introduzida pelo administrador. Guardar como inativa é permitido; ativar exige referência com origem, versão e data de verificação. Isto evita prometer cobertura inexistente.

Uma tabela com chave única CP7 não representa CP7 partilhados por várias localidades. Esses casos têm de continuar recusados até existir validação suficiente por morada/artéria; não atribuir arbitrariamente o CP7 a uma localidade. «Aldeia Nova» exige identificar a localidade concreta.

Foi encontrado um endereço oficial CTT com Castelejo/6230-152 no PDF de horas limite (https://www.ctt.pt/application/themes/pdfs/hora%20limite%20de%20envio%20na%20rede%20ctt.pdf). Serve de associação pontual para fixture de teste, não prova cobertura de toda a localidade. Nada foi importado em produção.

Falta uma fonte postal oficial/contratualmente autorizada, atual e suficientemente detalhada, que permita verificar cobertura por localidade e casos ambíguos. O ZIP histórico previamente fornecido não foi promovido a referência oficial. Conferir CP7/localidade não comprova por si só que rua/número e texto livre da morada são verdadeiros; a validação integral da morada precisa de uma fonte que inclua esse detalhe ou revisão manual. Não declarar esse requisito concluído.

A loja permanece fechada. Não abrir antes da validação postal, ensaio de checkout num ambiente de staging com dados de teste e confirmação dos dispositivos. Alterar preços/localidades depois de publicar não exige republicar a Loja: vêm da Cloud.
