# ARTESSENCIA — auditoria do fluxo de autenticação efetivo (2026-10-08)

## Descoberta crítica
A aplicação instalada é executada principalmente pelo index.html monolítico. Ao contrário de cloud.js (módulo separado), o index.html tem o seu próprio `cloudClient` criado por `initCloudClient()` com `persistSession:true` e `autoRefreshToken:true`.

Fluxos encontrados:
- `authGateLoginV1880()`: login de entrada com `cloudClient.auth.signInWithPassword()`.
- `cloudConnect()`: login no painel Cloud com o mesmo cliente.
- `cloudDisconnect()`: termina sessão e apresenta o bloqueio.
- `ensureCloudSession()`: consulta sessão do cliente.
- `cloudUser`, `cloudStartupDone`, `cloudHydrating`, `cloudChannel`: estado partilhado com sincronização.

## Regras de integração
1. Não importar o adaptador independente diretamente para o ecrã de entrada como se cloud.js fosse o cliente principal.
2. Reutilizar a mesma instância de `cloudClient` para Passkeys. Não criar outra sessão paralela.
3. Antes de ativar, garantir `@supabase/supabase-js >= 2.105.0` e suporte experimental efetivo no cliente criado; não atualizar CDN sem testes de regressão.
4. Após login Passkey, aplicar o mesmo caminho de hidratação, subscrição e controlo de bloqueio do login atual; extrair fluxo comum apenas com testes.
5. Configurar RP ID no domínio permanente de produção; não registar passkeys com domínios efémeros de previews Vercel.
6. Verificar Auth Passkeys habilitado no Supabase Dashboard antes de apresentar botões.
7. Manter login por palavra-passe e saída de emergência, sem mexer no SW, PWA, tabelas, RLS ou dados.
8. Fazer testes em ambos os Honor e simular sessão expirada, dispositivo sem passkey e falha de rede.

## Estado
A correção do adaptador isolado é válida para um cliente próprio, mas NÃO está integrada na aplicação efetiva. Bloqueada a integração até confirmar a compatibilidade do SDK e o estado do Auth Passkeys no projeto.
