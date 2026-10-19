# ArtEssencia — Programa de reestruturação global (ambiente de testes)

Base: `integration/backoffice-estrutura-global-20261019` criada a partir do PR #70 (Dashboard prioritário, CI aprovado). **Não é produção.**

## Princípios invioláveis
- Backoffice `main` é referência de regras comerciais, Cloud e dados reais.
- Não alterar Supabase, Loja ou Catálogo nesta etapa; Loja continua FECHADA.
- Não criar dados de cliente, pagamentos ou movimentos de stock em produção durante testes.
- Preservar autenticação, passkeys, impressão/PDF, PWA, encomendas, fichas técnicas, stock, vouchers, clientes, configurações e entregas.
- Não mudar APIs, identificadores, eventos, estruturas de armazenamento ou interfaces de integração sem contrato e testes.

## Estrutura-alvo
1. Dashboard operacional: prioridades reais e links para tarefas; KPIs e relatórios conservados.
2. Encomendas: lista priorizada, detalhe compacto com navegação, produção, pagamento e histórico.
3. Produção: centro de execução que reutiliza exatamente as operações atuais e não consome stock duas vezes.
4. Produtos: ficha unificada com custos/PVP, receitas, fotos e publicação; sem duplicar dados.
5. Stock: disponibilidade, necessidades previstas (sem reservas automáticas), alertas e reposição.
6. Clientes: ficha e histórico; preservar ligações aos pedidos.
7. Financeiro: Caixa, recebimentos, margem e relatórios com cálculos atuais.
8. Canais: vista de diagnóstico não destrutiva para Catálogo/Loja, sem permitir abrir a Loja por engano.
9. Áreas complementares: orçamentos, entregas, vouchers, catálogos visuais, definições, backups e funcionalidades existentes permanecem acessíveis.

## Dependências e riscos observados (19/10/2026)
- #70 Dashboard: base desta integração; CI aprovado.
- #69 detalhe de encomendas: candidata à consolidação; revisão e regressão de impressão/edição obrigatórias.
- #64 ordenação de encomendas: reporta conflito atual contra main.
- #65 previsão de materiais: depende explicitamente da branch #64; nunca integrar isoladamente.
- #66 navegação transversal: conflito atual.
- #67 acesso direto a encomendas: conflito atual.
- #68 filtro de stock: conflito atual.
- #61 UX tablet e #55 entregas: exigem avaliação dedicada, não incluem-se implicitamente.

## Matriz de aceitação — obrigatória antes de produção
| Âmbito | Testes |
|---|---|
| Inicialização | Carregamento após atualização PWA, offline/online, sem reinstalar |
| Segurança | Autenticação, passkeys, sessão, permissões owner |
| Produtos | Criar/editar em staging, fichas, margens, imagens |
| Stock | Disponibilidade, consumos únicos, movimentos e reposição |
| Encomendas | Criar/editar/anular em staging, produção, estados, histórico |
| Documentos | Impressão e PDF numa página sem regressões |
| Pagamentos | Pago/parcial, Caixa, sem duplicações |
| Integrações | Comparar contratos de produto/preço/stock, voucher e encomenda com Catálogo e Loja |
| Entregas | CP/localidade, distância rodoviária, estimativas; sem ativar checkout |
| Dispositivos | Honor Pad 9, Honor Magic 8 Pro, desktop; retrato/paisagem onde aplicável |
| Operação | Loja fechada, Catálogo funcional, sem mutação de dados reais |

## Procedimento de entrega
A) Consolidar patches um a um na branch integrada e executar CI por alteração.
B) Publicar apenas preview isolado no Vercel e testar com dados fictícios/staging.
C) Exigir aprovação visual/funcional em dispositivos reais.
D) Auditar diff da main e integração dos contratos antes de qualquer promoção.
E) Publicação em produção separada, com rollback e verificação da PWA instalada.

**Estado:** ambiente de integração criado; apenas #70 incluído até à reconciliação dos restantes PRs. Sem validação global ou autorização de publicação.
