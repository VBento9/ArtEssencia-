# ArtEssencia Backoffice V1.8.1

Edição direta da quantidade na Ficha Técnica por produto.

- A quantidade de cada material passa a ser editável diretamente na respetiva linha.
- Enter ou saída do campo confirma a alteração quando o valor foi modificado.
- A alteração atualiza a mesma entrada de `db.productRecipes`, sem duplicar materiais.
- O fluxo existente de `save()` e `restoreCostProductSelectionV12628()` é mantido, pelo que custos e interface são recalculados pelo mecanismo atual.
- Valores inválidos ou iguais/inferiores a zero não são gravados.
- O nome do material continua não editável; a troca de material continua a ser feita através de remover/adicionar.
- Mantém o botão “Remover”.
- Campo otimizado para toque no tablet.
- Corrige o fecho do elemento HTML da lista de materiais introduzido na V1.8.0.
- Sem alterações ao Supabase, fórmulas, estrutura de stock ou produção.
- Cache PWA: `artessencia-v1-8-1`.
