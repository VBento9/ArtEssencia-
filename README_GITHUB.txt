ARTESSENCIA ATELIER PRO V2 — FICHEIROS PARA GITHUB

Esta versão foi reconstruída como uma aplicação própria para o atelier ArtEssencia.
Não utiliza a DONART como identidade nem como estrutura visual, mas aproveita o nível
de completude e os fluxos que fazem sentido para um pequeno negócio artesanal.

Todos os ficheiros ficam juntos na raiz do repositório GitHub ArtEssencia.

Módulos:
- Hoje
- Atelier / Produção
- Encomendas e Orçamentos
- Produtos + Fichas Técnicas
- Custos & Preços
- Materiais & Stock
- Compras
- Clientes
- Caixa / Despesas / Investimentos
- Relatórios
- Loja & Coleções
  - Coleções
  - Catálogos & Kits
  - Homepage
  - Campanhas
  - Entregas
- Auditoria 360º
- Configuração + Backup

Não ligar esta versão ao Supabase DONART.
A ligação futura será ao projeto Supabase exclusivo ArtEssencia.


V2.1 — PARÂMETROS EDITÁVEIS
- Parâmetros globais do atelier são editáveis em Configuração.
- Mão de obra/hora, extras, desperdício, margem alvo, alerta de margem,
  taxa de pagamento, embalagem, custo de equipamento/h e unidades/lote.
- Estes parâmetros são usados como predefinições nos NOVOS produtos.
- Cada produto continua a poder ter os seus próprios valores manualmente.
- Produtos existentes não são reescritos ao alterar os parâmetros globais.


V3.0 — Paridade funcional ampliada com DONART V12.7.4, totalmente adaptada ao atelier ArtEssencia.


V3.1 — HOTFIX DE ARRANQUE
- Corrigido erro de sintaxe na função "Nova venda" que impedia o módulo views.js de carregar.
- Como views.js não carregava, app.js não arrancava e o ecrã mostrava apenas o HTML estático.
- Cache do Service Worker alterada para obrigar atualização dos ficheiros.
- Adicionado tratamento de erro de arranque para impedir ecrãs vazios silenciosos no futuro.
