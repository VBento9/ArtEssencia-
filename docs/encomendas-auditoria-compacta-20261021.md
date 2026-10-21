# Encomendas — auditoria de navegação, 21/10/2026

## Estrutura efetiva na versão principal
- Módulo `#orders` já dispõe de separadores **Ativas / Histórico** com `setOrdersModeV1882()`.
- Pesquisa por número, cliente e telefone.
- Filtro por estado, datas de início/fim, alternativa Cartões / Tabela e Limpar filtros.
- Acesso **Nova encomenda**.
- Resumo de fluxo operacional e lista de encomendas, ambos atualizados pelas funções atuais.
- Vista de tabela usa `#ordersTableWrap` e `#ordersBody`; vista de cartões usa `#ordersCards`.

## Diagnóstico
- A barra superior agrupa pesquisa, dois intervalos de datas, estado, modo visual e ações, causando densidade e scroll.
- **Não** criar novos separadores Ativas/Histórico nem substituir a alternância Cartões/Tabela; já existem.
- Prioridade: manter pesquisa, estado, modo Ativas/Histórico e Nova encomenda visíveis, recolher datas e filtros menos usados.
- A abertura/detalhe da encomenda e respetivas ações (pagamento, impressão/PDF, produção) requerem testes independentes antes de alterações estruturais.

## Plano não destrutivo
- Barra compacta de filtros secundários, sem reconstituir os formulários ou remover IDs.
- Preservar `renderOrders()`, `setOrdersModeV1882()`, `setOrdersView()` e `clearOrderFiltersV1915()`.
- Testar pesquisa, filtros, datas, mudança de vistas, navegação, impressão e abertura de detalhe.
- Não mexer no estado real de encomendas, stock, produção, custos, autenticação, Cloud ou publicações.

## Estado
Apenas auditoria documental nesta branch. Nenhuma alteração ao módulo ativo.
