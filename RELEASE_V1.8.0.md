# ArtEssencia Backoffice V1.8.0

Consumíveis rápidos na Ficha Técnica por produto (tablet).

- Adiciona “Consumíveis rápidos” em Custos → Ficha técnica por produto.
- Usa diretamente `db.productRecipes`; não cria uma estrutura de custos paralela.
- Sugere apenas materiais reais existentes no Stock com unidade base `un`.
- Ordena sugestões por frequência de utilização, produtos da mesma categoria e nomes prioritários (cartão de visita, saco, autocolante, etiqueta, caixa e fita).
- Um toque adiciona 1 unidade.
- Materiais já existentes ficam assinalados e não são duplicados.
- “Adicionar todos” acrescenta apenas os consumíveis em falta.
- Mantém pesquisa e formulário normal de materiais.
- Mantém cálculos, stock, produção e sincronização Cloud no fluxo existente.
- Não altera Supabase nem fórmulas.
- Layout: 1 coluna em ecrãs pequenos, 2 colunas no tablet, 3 colunas em ecrãs largos.
- Cache PWA: `artessencia-v1-8-0`.
