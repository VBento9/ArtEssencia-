# ArtEssencia — controlo de migrações 30 outubro 2026

Estado: proposta de integração. Nenhuma alteração em produção por este ficheiro.

## Regra obrigatória para cada CREATE TABLE novo
1. Identificar o proprietário dos dados, a app consumidora e o método (RPC ou consulta direta).
2. Definir RLS e políticas específicas antes de disponibilizar a tabela à API.
3. GRANT explícito apenas para operações e papéis estritamente necessários; nunca dar ALL a anon.
4. Confirmar acesso negado a outros utilizadores e operações proibidas.
5. Ensaio de migração numa base isolada, incluindo db reset, antes da aplicação à produção.

## Bloqueios para publicar
- Não alterar os privilégios DEFAULT globais antes de auditar todas as migrações pendentes.
- Não revogar EXECUTE indiscriminadamente às RPCs públicas do Catálogo e da Loja.
- Não tocar na integridade do stock com SQL corretivo sem demonstrar o fluxo de movimentos.
- Não abrir a Loja Online.

## Dados confirmados 22 outubro
- Tabela de backup de clientes: RLS já ativo (migração 20261021235652).
- 10 avisos de RLS sem policy (podem ser intencionais).
- 15 avisos sobre RPCs SECURITY DEFINER executáveis por anon.
- 19 avisos sobre RPCs SECURITY DEFINER executáveis por authenticated.
- Função de pedidos de orçamento pública: rever limitação de frequência antes de alterar.
- Default grants atuais em public continuam amplos para tabelas novas nos papéis postgres e supabase_admin.

## Critérios de aprovação
- Encomendas, stock, ficha técnica, produção, impressão, biometria, vouchers, Catálogo, zonas de entrega e Loja fechada continuam funcionais.
- Testes de controlo de acesso anon/authenticated/service_role aprovados.
- Backup restaurável comprovado.
- Só então integrar e publicar.
