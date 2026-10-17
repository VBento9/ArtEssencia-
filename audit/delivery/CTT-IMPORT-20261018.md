# Referência CTT — importação controlada em 18/10/2026

## Fonte e âmbito

Ficheiro todos_cp.zip fornecido pelo proprietário, obtido na sequência do pedido de download CTT. Membro todos_cp.txt datado de 17/10/2026; SHA-256 do ZIP: 779af4dfdff8b6a7c7f248d9abcd7e249c650733ec446594a341f078059051f6. A data do membro não é, isoladamente, certificação da atualidade de cada endereço.

330650 linhas de 17 campos, Windows-1252. O leiame antigo diz inicialmente 16 campos mas enumera 17; todas as linhas do export têm 17. Foram usados nome e identidade da localidade, nunca a designação postal como substituto.

Âmbito importado: concelho do Fundão (distrito 05/concelho 04). Comparação de ambiguidades feita contra todo o ficheiro nacional. Foram excluídos códigos partilhados entre identidades de localidades e códigos específicos de clientes. Resultado: 479 correspondências na tabela existente public.artessencia_postal_locality_reference. Nenhuma tabela, coluna, função ou permissão criada ou alterada.

## Cobertura das localidades pedidas

| Localidade | CP7 no ficheiro | CP7 importados | Estado |
|---|---:|---:|---|
| Castelejo | 1 | 1 | Cobertura postal completa neste export |
| Enxabarda | 1 | 1 | Cobertura postal completa neste export |
| Alcaide | 7 | 7 | Cobertura postal completa neste export |
| Fundão | 158 | 148 | Parcial; códigos partilhados/específicos excluídos |
| Donas | 2 | 1 | Parcial; 6230-173 partilhado com Teixugas |
| Aldeia Nova do Cabo | 1 | 0 | Bloqueada; 6230-050 partilhado |

6230-050 abrange também Quinta do Outeiro e Alcanceria. O export atual tem apenas uma linha de localidade, sem arruamentos/troços, para Aldeia Nova do Cabo; não há dados suficientes nesse código para resolver o caso por rua. Não autorizar arbitrariamente todas as moradas desse CP7.

## Verificação anterior à importação

- 19 verificações adicionais em PostgreSQL isolado: importação, todas as 479 correspondências pela função real, códigos partilhados, código antigo de Alcaide rejeitado, precedência global, estado individual e atualização de portes sem republicação.
- 32 verificações de regressão do checkout isolado aprovadas, incluindo descontos, quantidades, capacidade, datas e idempotência. As duas falhas anteriores são reproduzidas deliberadamente no início do teste para verificar as correções já publicadas.
- Script de importação é transacional e recusa qualquer tabela já preenchida. Não usa UPSERT nem sobrescreve referências anteriores.

## Verificação posterior em produção

- Contagem confirmada: 479; Castelejo 1, Enxabarda 1, Alcaide 7, Fundão 148, Donas 1, Aldeia Nova do Cabo 0.
- Função real reconhece Castelejo/6230-152 e recusa Fundão/6230-152 e Aldeia Nova do Cabo/6230-050.
- Cotação continua recusada com entrega global desativada; lista pública de zonas continua vazia.
- Hash das definições Backoffice e das definições públicas idêntico antes/depois; zona Castelejo continua inativa a 300 cêntimos. Loja enabled=false, accepting_orders=false, modo updating.
- Hash dos produtos idêntico; contagens de encomendas/clientes mantidas (6/12 no Backoffice; 0/0 na Loja). Nenhuma encomenda de teste criada em produção.
- RLS da referência continua ativa; anon continua sem SELECT direto.

## Limite funcional que permanece

A referência valida a associação entre CP7 e localidade; não prova que a rua/porta em texto livre corresponde ao CP7 ou que o cliente reside fisicamente nesse endereço. A interface atual não passa um endereço estruturado validado ao cálculo de portes. Não declarar a validação integral de morada concluída. Para o requisito de prevenção de seleção de uma zona mais barata para outra morada, é necessário um passo de validação estruturada de rua/CP/localidade, com estratégia explícita para locais sem arruamentos no export. Uma validação apenas textual não substitui estes dados ausentes.

Não foi necessária nova publicação de frontend: a versão 1.9.8 já consulta a referência na Cloud. A importação não ativa zonas nem entregas. A confirmação final na PWA e o checkout integral permanecem pendentes; a Loja deve continuar fechada.

## Reprodução

python3 scripts/prepare_ctt_reference.py /caminho/todos_cp.zip /diretorio/temporario
AE_PGLITE_MODULE=/caminho/pglite node audit/delivery/test-ctt-reference.cjs /diretorio/temporario

Os valores 425/580 cêntimos usados no teste são apenas fixtures isoladas; não são tarifas de produção. O ZIP e os seus dados completos não foram republicados no repositório.
