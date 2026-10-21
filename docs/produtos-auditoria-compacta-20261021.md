# ArtEssencia — Produtos, auditoria de estrutura (21 outubro 2026)

Fonte: `index.html` de `main`, bloco real `<section id="products">`.

## Confirmado no código
- O editor já utiliza quatro separadores: Essencial, Preço, Produção, Publicação (função existente `showProductPanelV1762`).
- Ficha técnica e ligação aos custos já fazem parte do primeiro separador.
- Existem pesquisa e 9 filtros/selectores incluindo categoria, grupo, época, coleção, arquivo, publicação, conjuntos e preenchimento.
- Ferramentas avançadas de recuperação em massa já estão recolhíveis.
- Resumo de produtos, formulário extenso e listagem partilham o mesmo ecrã.

## Melhorias prioritárias
1. Condensar filtros secundários numa secção recolhível, mantendo Pesquisa e tipo de produto sempre visíveis.
2. Dar acesso claro a **Novo produto** e **Ver produtos**, permitindo recolher o formulário completo sem destruir o DOM nem dados introduzidos.
3. Ao escolher **Editar** na listagem, mostrar automaticamente o editor atual.
4. Preservar os quatro separadores e a função `showProductPanelV1762`, sem duplicar a sua lógica.
5. Evitar interferência com arquivo, publicação Catálogo/Loja, ficha técnica, custos e PVP.

## Guardas de segurança
- Não modificar cálculos, `db`, Supabase, renderização/listeners de negócio, dados nem fluxo de guardar.
- Não esconder o editor enquanto está em edição; testar Cancelar e Novo produto.
- Confirmar filtros/edição no tablet e telemóvel com dados fictícios.
- Branch independente e PR draft; não publicar em produção antes de testes.

## Estado
Auditoria inicial concluída. Nenhuma alteração ao código funcional de Produtos nesta etapa.
