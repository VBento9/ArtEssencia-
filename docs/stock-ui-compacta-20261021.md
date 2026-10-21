# Plano seguro para Stock compacto

- Apenas interface. Não alterar Supabase, quantidades, unidades, custos, movimentos, produção, fichas técnicas, autenticação, impressão ou PWA.
- Proposta: separadores internos, pesquisa, filtros, paginação, painel de detalhe adaptativo.
- Antes de integrar, auditar todos os IDs/handlers do módulo Stock no index.html existente.
- Reutilizar funções existentes; não substituir lógica de domínio nem chamadas Cloud.
- Testar criação, edição, entradas, saídas, preços, mínimos, produção com fragrância suficiente/insuficiente, regressões de impressão e PWA.
- Confirmar em Honor Pad 9 e Honor Magic 8 Pro.
- Sem merge ou deploy de produção antes de testes reais.
- O HTML em prototypes/stock-compacto.html é apenas demonstrativo com dados fictícios; não é a aplicação real.