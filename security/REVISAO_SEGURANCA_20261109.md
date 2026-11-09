# Revisao de seguranca - 09/11/2026

Este PR nao altera dados reais nem aplica SQL automaticamente em producao.

- Endpoints Vercel /api/ recebem Cache-Control no-store e CSP apenas nas respostas API.
- Script SQL preserva a RPC anon e introduz limites: 180 eventos/visitante/hora,
  120 eventos/origem/minuto, 6000 eventos/origem/24h, com bloqueio transacional.
- O limite antigo de 250 eventos/sessao/hora continua. Novo indice para visitante.
- Testes de contrato e CI incluidos.

Antes de aplicar SQL: testar em Supabase clone, medir concorrencia, confirmar
permissoes e consultar Security Advisor. Os UUID sao fornecidos pelo cliente.
Este controlo reduz abuso volumetrico, mas nao prova autenticidade de eventos.
Recomenda-se rate limiting por IP numa fronteira API controlada.

Pendencias: protecao de passwords expostas (Supabase Auth), CSP da PWA,
auditoria completa das funcoes privilegiadas, armazenamento offline e passkeys.
