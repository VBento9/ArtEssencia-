# Backoffice ArtEssencia — Simplificação operacional, fase 2
Data: 2026-11-04
Versão base: 1.9.120, commit `20f5d0cfbfb464e4db68e99da9b7bf743bc8ded3`

## Problemas identificados na auditoria
- Dashboard: lista resumida de indicadores determinada por textos exatos; se os nomes mudassem, poderia ficar vazia.
- Encomendas: datas aplicadas ficavam pouco evidentes após recolher os filtros.
- Stock: formulário e movimento com estados visuais e descrições pouco explícitos.
- Produtos: acesso à lista a partir da edição dependia de regressar manualmente à barra superior.

## Alterações
- Dashboard: assegurar que são apresentados até quatro KPI operacionais relevantes mesmo após alterações de títulos; navegação de separadores com setas e acessibilidade.
- Encomendas: botão «Datas ativas · Alterar» quando há campos preenchidos, atualizado ao editar as datas, sem alterar filtros.
- Stock: estados coerentes de «Novo artigo» e «Movimento rápido», identificação dos painéis e botões de página acessíveis.
- Produtos: distinção «Lista de produtos» e «Editor de produto», atalho «Ver lista sem guardar» nas ações do editor e regresso à barra de navegação.
- CSS transversal para estados ativos e ecrãs pequenos.
- Versão de cache PWA atualizada, sem limpeza de dados.

## Garantias e limites
Não foram modificados dados reais, migrações, Supabase, Cloud Sync, receitas, stocks, encomendas, PDFs ou lógica comercial. Sintaxe JS e CSS validadas, com publicação condicionada a pré-visualização da Vercel. A validação tátil de ponta a ponta nos dispositivos reais permanece pendente.

## Próxima fase
Consolidar acessibilidade e reduzir CSS duplicado gradualmente. Analisar rotinas reais de Produtores/Stock/Encomendas com observação da interface, sem reescrever a aplicação.
