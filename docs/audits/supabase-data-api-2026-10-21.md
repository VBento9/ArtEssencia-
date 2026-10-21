# Supabase Data API — auditoria preventiva (21-10-2026)

Estado: **preparação em branch isolada; não aplicado a produção**.

## Alteração anunciada para 30-10-2026
Tabelas novas criadas em `public` deixam de receber automaticamente permissões para a Data API. Tabelas existentes conservam privilégios atuais. Cada migração futura que crie tabelas expostas deve declarar apenas os `GRANT` necessários e as políticas RLS adequadas.

Documentação: https://supabase.com/docs/guides/api/securing-your-api

## Verificação read-only ao projeto ihtsonqnnlrxvorfrarl
- Projeto ACTIVE_HEALTHY.
- 36 tabelas em `public`, 35 com RLS ligado.
- As tabelas principais do Backoffice possuem permissões de leitura para `authenticated`; nenhuma das 36 apresentou `SELECT` concedido diretamente a `anon` na consulta realizada.
- Privilégios *default* atuais em `public` incluem concessões automáticas amplas a `anon`, `authenticated` e `service_role` para tabelas, funções e sequências. Não revogar às cegas; verificar criador/migrações.
- `public.artessencia_client_misclassified_backup_20261013`: 7 linhas, RLS desligado; grants diretos detetados apenas para `postgres` e `service_role`. Não há policies. Dependências do catálogo examinadas são objetos internos (tipo, TOAST, PK, índice e defaults). Atenção: isso não exclui referências por SQL dinâmico ou código de aplicação.
- Advisors também avisam sobre funções SECURITY DEFINER executáveis por clientes; cada uma exige revisão de finalidade/autorização antes de qualquer revogação.

## Correção proposta para tabela de backup — NÃO EXECUTAR SEM PRÉ-VALIDAÇÃO
Confirmar previamente que nenhum fluxo cliente usa o backup; preservar cópia e plano de reversão. Depois, migração controlada:

```sql
ALTER TABLE public.artessencia_client_misclassified_backup_20261013
  ENABLE ROW LEVEL SECURITY;
```

Nenhuma política para `anon` ou `authenticated` deve ser adicionada por omissão. Confirmar que só processos administrativos/servidor autorizados necessitam do backup. Verificar após alteração RLS, contagem de 7 registos pelo administrador e comportamento dos serviços.

## Padrão de futuras migrações
Exemplo **ilustrativo** de tabela de leitura pública, NÃO aplicar a tabelas de clientes, stocks, encomendas, dados pessoais ou administrativas:

```sql
CREATE TABLE public.example_public_items (
  id bigint generated always as identity primary key,
  title text not null
);
ALTER TABLE public.example_public_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.example_public_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.example_public_items TO service_role;
CREATE POLICY example_public_items_read ON public.example_public_items
  FOR SELECT TO anon, authenticated USING (true);
```

Para tabelas internas, evitar `GRANT` a `anon`; conceder à função ou papel mínimo necessário. `GRANT` e RLS são camadas distintas. Nunca usar `service_role` no navegador.

## Plano de testes antes de merge/deploy
1. Conferir migrações e scripts de criação de tabelas nos repositórios Backoffice, Catálogo, Loja e Desktop.
2. Em base de testes, simular criação de tabela e operações permitidas/proibidas da Data API para `anon`, `authenticated`, `service_role`.
3. Confirmar CRUD Backoffice (clientes, produtos, stock, produção, encomendas), autenticação e impressão.
4. Confirmar Catálogo e Loja (mantendo Loja fechada), RPCs públicos, vouchers e cálculo dos portes.
5. Validar advisor de segurança e comparar privilégios antes/depois.
6. Só então integrar migrações revistas; sem alterações automáticas a produção.
