# Auditoria estrutural — Stock (21-10-2026)

## Ficheiros efetivamente lidos
- `app.js`: navegação para `stock` e `materials`, entrada para `views.stock`.
- `views.js`: função `stockView`, `stockMoveModal`, `materialModal`, `purchasesView` e `purchaseModal`.
- `app.css`: tabela `.table`, navegação `.tabs`, formulário e estilos adaptativos.
- `index.html`: ficheiro principal muito grande (~1,7MB); o conector não devolve o conteúdo. **Não é possível garantir que o módulo modular é o que a PWA atualmente serve.**

## Constatações
1. `stockView` já tem 3 separadores: Stock, Movimentos e Alertas. Não deve introduzir-se um separador Inventário que não tem implementação.
2. As listagens Stock e Movimentos criam todas as linhas num `table(...)` sem paginação, explicando o possível scroll excessivo na versão modular.
3. As ações existentes incluem Nova matéria, Movimento manual, Registar compra, Editar e pesquisa global; devem continuar com os mesmos handlers.
4. `stockMoveModal` atualiza materiais e regista `stockMovements`. `purchaseModal` atualiza stock/custo e escreve compras/caixa.
5. `materialModal` escreve atributos de material. Não substituir nem simplificar essas operações.
6. O componente `prototypes/stock-table-controls.js` é **isolado** e apenas mostra/esconde linhas já existentes; não altera os dados nem regista handlers de negócio.
7. A auditoria de 21-10 sobre fragrâncias em `audit/production/fragrance-commitments-20261021.md` identifica um problema ainda por resolver na validação de compromissos. Reorganização visual não corrige esse problema.

## Integração condicionada
- Obter conteúdo do `index.html` realmente publicado e localizar raiz do Stock e os seus listeners.
- Garantir que pesquisa/paginação não recriam ou movem botões que tenham eventos de edição associados.
- Não acoplar tabela demonstrativa ao stock real sem identificar a arquitetura ativa.
- Ensaiar listagens de 0/1/20/21/100 registos, pesquisa com acentos, filtragem, mudança de separadores e acesso ao último registo.
- Regressões obrigatórias: entrada/saída, compra, alteração de preço, criação/edição de material, stock mínimo, produção com materiais suficientes e insuficientes, sincronização, impressão, instalação PWA.
- Não há evidência de execução de testes automatizados ou validação nos dispositivos neste momento.

## Segurança da branch
Branch `feature/stock-ui-compacta-20261021`, PR #76 em draft. Apenas ficheiros novos em `prototypes/` e `docs/`. Sem alterações a produção.
