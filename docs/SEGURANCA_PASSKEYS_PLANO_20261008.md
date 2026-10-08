# ARTESSENCIA — Plano de autenticação segura (não ativado)

Base: main @ 4484b060acfe32f90ca555b0d5ccd2fae7ecead6
Âmbito: exclusivamente VBento9/ArtEssencia-
Estado: investigação; nenhuma alteração funcional.

## Constatações verificadas
- app.js inicializa a interface e IndexedDB sem exigir login.
- db.js guarda dados de negócio em IndexedDB; não existe controlo de acesso por utilizador na camada local.
- cloud.js utiliza Supabase Auth por password, sessionStorage e refresh_token.
- sw.js faz cache da aplicação e permite utilização offline.
- APIs social-ai e social-meta-publish verificam identidade e proprietário no servidor.
- Não há evidência de infraestrutura WebAuthn/Passkeys nem de testes automáticos de autenticação no repositório.

## Requisitos de segurança para uma implementação futura
1. Não confundir desbloqueio biométrico local com autenticação no servidor: uma Passkey só autentica se existir verificação WebAuthn no backend, com challenge de utilização única, origem e RP ID verificados.
2. Definir modelo de acesso offline e de proteção de IndexedDB, incluindo o que acontece após logout, expiração de sessão, mudança de utilizador e recuperação do dispositivo.
3. Nunca guardar chaves privadas, PIN, biometria, service_role ou segredos em código cliente ou IndexedDB.
4. Manter login atual até verificar recuperação em dispositivos reais.
5. Não ativar bloqueio da interface antes de haver recuperação testada e backup exportado.
6. Testar PWA instalada no Honor Magic 8 Pro, Honor Pad 9 e Mac, incluindo perda de rede, cache antigo e sessão expirada.
7. Validar autorização no servidor para cada operação sensível; esconder interface não é controlo de acesso.
8. Criar testes de regressão para produtos, encomendas, custos, catálogos visuais, estatísticas, sincronização e redes sociais.
9. Publicar apenas após revisão, testes e autorização explícita; não alterar main, Vercel ou Supabase nesta fase.

## Critério de aprovação
- Sem perda de dados nem bloqueio de acesso.
- Autenticação forte validada pelo servidor e fallback funcional.
- Política offline definida e testada.
- Regressões automatizadas e testes manuais documentados.
- Rollback testado.

Este documento não implementa autenticação e não deve ser interpretado como aprovação para produção.
