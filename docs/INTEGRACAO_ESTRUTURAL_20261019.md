# ArtEssencia — integração estrutural controlada (19-10-2026)

## Âmbito e limites
Branch exclusiva de validação estrutural sobre `main` do Backoffice. Sem modificações ao Catálogo, Loja, Supabase, dados reais ou produção. A Loja deve permanecer fechada. O presente documento não significa que funcionalidades estejam implementadas ou testadas em dispositivo.

## Baseline verificada
- Backoffice: `version.json` anuncia 1.9.15.
- Navegação: 29 módulos, segundo os testes de preservação já existentes.
- Testes preexistentes: `scripts/test_ux_preservation.cjs`, `scripts/test_ux_navigation.cjs`, `scripts/test_ux_mobile_audit.cjs`, `scripts/test_ux_orders_filters.cjs` e `scripts/test_ux_order_production_safety.cjs`.
- Alterações de Dashboard e detalhe de Encomendas existem em branches diferentes e devem ser revistas sem sobrepor diretamente `index.html`.
- Algumas branches estão divergentes relativamente a `main`, pelo que não devem ser integradas cegamente.

## Plano de consolidação
1. Verificar `main` e diferenças das branches, sem cherry-pick global.
2. Identificar funcionalidades já presentes em `main` para evitar duplicação.
3. Separar alterações por área (Dashboard, Encomendas, Produtos/Stock, Tablet).
4. Aplicar apenas mudanças compatíveis com a versão atual; isolar conflitos em `index.html`.
5. Executar verificações estáticas existentes e `node scripts/test_integracao_transversal_20261019.cjs`.
6. Executar testes funcionais em ambiente de preview: abertura de encomenda, impressão/PDF em uma página, regresso à listagem, fluxo de produção, cálculo de portes, produtos/fichas técnicas, Cloud e autenticação.
7. Validar em Honor Pad 9 e Honor Magic 8 Pro: layout, navegação e PWA instalada/atualização automática.
8. Verificar contratos com Catálogo e Loja sem abrir a Loja nem fazer encomendas reais.
9. Só aprovar publicação depois de testes concluídos e sem regressões.

## Critérios de bloqueio
- Alteração inadvertida de dados, schemas, endpoints ou credenciais.
- Alteração de `sw.js` ou `version.json` sem plano específico de atualização da PWA.
- Regressões em autenticação/passkeys, impressão, Cloud, encomendas, stocks, vouchers ou zonas de entrega.
- Ativação do checkout ou da Loja.
- Testes estáticos verdes usados como substituto de testes funcionais.

## Estado
Preparação e proteções estáticas. Integração de funcionalidades, validação end-to-end e publicação ainda pendentes.
