ARTESSENCIA GESTÃO — AE V1.0
Base estrutural adaptada do backoffice DONART V12.6.37.

OBJETIVO
Usar a arquitetura já desenvolvida no projeto DONART como fundação da ArtEssencia e preservar desde já os módulos que mais tarde alimentarão a loja online.

ADAPTADO NESTA FASE
- Identidade ArtEssencia e PWA própria.
- Produtos sem dados DONART de demonstração.
- Categorias: Velas, Wax Melts, Jesmonite, Sabonetes, Decoração, Personalizados, Kits & Presentes e Outros.
- Stock inicial orientado a ceras, fragrâncias, pavios, pigmentos, Jesmonite, acabamento e embalagens.
- Produto com tipo de produção, peso, molde/recipiente, custo e vida útil do molde, fragrância/acabamento, percentagem de fragrância, rácio técnico, energia/equipamento, taxa de pagamento online e PVP grossista.
- Amortização do molde e energia incluídas na extensão do custo do produto.
- Ficha Técnica reaproveitada como composição de materiais por produto.
- Criador de Caixas reposicionado como Criador de Kits/Presentes.
- Edições Especiais reposicionadas como Coleções sazonais.
- Homepage, fotografia, descrição, PVP online, publicação, campanhas e entregas preservados para a futura loja.
- Namespace local e Cloud alterado para artessencia_* para não misturar dados com DONART.
- Cloud Sync/Supabase preservado como arquitetura a adaptar ao backend ArtEssencia.

IMPORTANTE
Esta é a primeira adaptação estrutural. A Cloud ArtEssencia ainda precisa do respetivo esquema Supabase/tabelas/funções com os nomes artessencia_* antes de ser ligada em produção. Não usar as credenciais/backend DONART nesta versão.

PRÓXIMAS FASES RECOMENDADAS
1. Reestruturar Ficha Técnica por tipo: vela / Jesmonite / wax melt / sabonete.
2. Tornar Produção orientada por lotes e unidades, eliminando a lógica alimentar residual interna.
3. Reestruturar Kits para composição de produtos ArtEssencia.
4. Criar esquema Supabase ArtEssencia e sincronização relacional tablet/iPhone.
5. Só depois ligar a futura loja ao mesmo Supabase.
