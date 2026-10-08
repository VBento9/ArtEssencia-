# ARTESSENCIA — Integração com Passkeys nativas do Supabase (preparação)
Data: 2026-10-08
Fonte: https://supabase.com/docs/guides/auth/passkeys

## Decisão de arquitetura
Utilizar exclusivamente a implementação WebAuthn/Passkeys do Supabase Auth (experimental), sem construir endpoints próprios de verificação e sem gerar tokens manualmente.

Requisitos documentados:
- supabase-js >= 2.105.0, com auth.experimental.passkey=true;
- autenticação existente e conta confirmada antes de registerPasskey();
- signInWithPasskey() devolve sessão real validada pelo Supabase Auth;
- configuração Passkeys, RP ID e origins HTTPS no Supabase Dashboard;
- RP ID estável, porque alterá-lo invalida passkeys registadas.

## Restrições específicas do Backoffice
- index.html é a interface principal e tem um cliente Supabase CDN genérico; cloud.js usa autenticação REST por palavra-passe e sessionStorage. Não ativar passkeys diretamente neste cliente sem adaptador e testes de sessão/refresh.
- Não substituir cloud.login, cloud.ensureSession ou cloud.logout sem testes de compatibilidade.
- Não alterar cloud.url, cloud.key, políticas RLS, schema, tabelas, PWA, service worker nem produção nesta fase.
- O botão de diagnóstico é independente do login real.
- Nunca registar credenciais automaticamente; exigir ação explícita do utilizador.
- Em falha de passkey, manter login atual disponível, sem invalidar sessão existente.

## Gates antes de implementação funcional
1. Verificar estado real da configuração Auth do projeto Supabase sem expor chaves.
2. Fixar versão compatível do SDK e testar isolamento de sessões no Backoffice.
3. Escolher domínio definitivo RP ID e lista de origins (não usar URL efémero de preview para registo real).
4. Implementar adaptador experimental com testes de mocks e de sessão; apenas depois inserir interface com flag desativada por defeito.
5. Testar registo, login, refresh, logout, revogação, origem inválida, erro e recuperação.
6. Rever regressões e autorizar merge/deploy separadamente.

## Estado
Arquitetura documentada. Nenhuma Passkey registada, nenhuma configuração Auth alterada, nenhum login biométrico ativo.
