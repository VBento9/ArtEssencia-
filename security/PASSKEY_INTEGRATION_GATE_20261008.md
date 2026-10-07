# ARTESSENCIA — Gate de segurança para autenticação biométrica
Data: 2026-10-08
Branch: feature/auth-passkeys-safe-20261008

## Verificação realizada
- Honor Magic 8 Pro e Honor Pad 9: diagnóstico WebAuthn em HTTPS com autenticador de plataforma disponível (resultados comunicados pelo utilizador).
- O Backoffice principal efetivo está concentrado em index.html; a importação de app.js não integra o ecrã principal legado.
- cloud.js: login via /auth/v1/token?grant_type=password; sessão guardada em sessionStorage; operações Cloud requerem access_token. Não existe atualmente uma troca de assertion WebAuthn por sessão Supabase.
- Diagnóstico isolado em /diagnostico-biometria.html, sem operações de autenticação ou escrita.

## Gate obrigatório antes de integrar no Backoffice
1. Confirmar no fornecedor de autenticação o fluxo suportado para Passkeys e a forma de emitir sessão Supabase legítima, sem tokens fabricados no cliente.
2. Endpoint seguro de registo e login: challenges aleatórios de uso único, expiração, vinculação ao utilizador autenticado, RP ID e origin exatos, verificação de assinatura e contador/anti-replay; credenciais públicas por utilizador e revogação.
3. Segredos exclusivamente no servidor, limites de tentativas, logging mínimo sem PII, CSRF/origin checks e HTTPS.
4. Registo de passkey apenas após autenticação existente e confirmação do utilizador. Recuperação com palavra-passe; não desativar login atual.
5. Testes de sucesso, rejeição e regressão (origem errada, challenge expirado/reutilizado, credencial de outro utilizador, sessão inválida, offline, Cloud Sync, PWA e login por palavra-passe).
6. Auditoria do index.html efetivamente utilizado, backup/rollback, preview protegida e autorização antes de merge em main.

## Estado
Compatibilidade verificada; autenticação biométrica real NÃO implementada nem ativa. Não alterar base de dados, Supabase Auth, Cloud Sync, service worker ou produção antes de cumprir os gates.
