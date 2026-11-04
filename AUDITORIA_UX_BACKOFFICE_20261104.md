# ArtEssencia — Revisão UX/visual do Backoffice
Data: 2026-11-04
Base: Backoffice principal em produção, commit `038353a52696b4a02259548dc3956c3b363fcd2a`, versão 1.9.119.

## Auditoria
A interface contém módulos compactos preexistentes (Produtos, Stock, Encomendas, Produção, Clientes, Compras e outros), uma folha de apresentação transversal e várias folhas de estilo específicas. O risco principal é a sobreposição de estilos e a complexidade da navegação entre módulos; uma reconstrução integral aumentaria o risco de regressões.

## Implementado nesta intervenção
- Sistema visual transversal mais consistente: paleta sóbria, tipografia do sistema, títulos mais legíveis, cartões com menor ruído visual, sombras discretas, hierarquia de botões e foco acessível.
- Sidebar redesenhada em CSS, sem trocar elementos ou eventos de navegação.
- Cabeçalhos de tabelas, filtros e formulários com contrastes e espaçamentos harmonizados, sem alterar a apresentação de documentos impressos.
- Atalho "Ir para módulo" na barra de ações, com pesquisa sobre os botões reais do menu, teclado Ctrl/Cmd+K, setas, Enter, Escape, gestão de foco e suporte a telemóvel.
- Ajustes para os módulos compactos já existentes e redução de movimentos em acessibilidade.
- Alteração apenas de `module-search-shortcut.js`, `backoffice-visual.css` e chave de cache do `sw.js`; nenhuma modificação em encomendas, Stock, Supabase, Sync, migrações, dados de produção ou PDF.

## Verificações
- Sintaxe JS e balanceamento CSS antes de publicação.
- A verificação de preview Vercel deve estar `READY` antes de integrar.
- A interação real nos módulos, sincronização entre dispositivos, leitura de ecrã e impressão necessitam de validação física de ponta a ponta; não confundir build READY com testes de utilização.

## Próximos pontos para revisão por módulo
1. Fluxos de criação/edição de produtos e salvaguarda de rascunhos.
2. Priorização operacional no dashboard.
3. Encomendas: pesquisas/filtros/ações com menos scroll.
4. Stock: velocidade de registo, seleção de categorias e fotografias.
5. Relatórios, estatísticas digitais e orçamentos.
6. Consolidar CSS duplicado gradualmente, com testes visuais de regressão.

## Fora do âmbito
DONART, Beauty Atelier, Desktop V3, credenciais, dados reais, contratos Supabase, sincronização Cloud, abertura da loja e impressão A4/A5.
