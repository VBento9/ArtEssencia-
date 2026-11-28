# Intelligence Hybrid — fase 12: correção e dupla validação SQL

CI da fase 11 (45908144147): Node nativo passou, PGlite falhou com referência ambígua a request_lines na consulta de autorização. A variável PL/pgSQL foi renomeada para v_request_lines e todas as referências à variável foram ajustadas; as colunas permanecem request_lines. Não acrescentar caminho de escrita enquanto a regressão de autorização não estiver resolvida.

O mesmo teste sintético passa a poder correr em PGlite e numa instância PostgreSQL 17 isolada no GitHub Actions. Runner standard de repositório público, sem credenciais de produção ou deploy. O modo PostgreSQL usa exclusivamente loopback, porta 55433 e base intelligence_fixture; não aceita URLs externas. Testes Node, PGlite e PostgreSQL devem passar na nova execução. A sintaxe JS da fixture foi verificada na autoria, não o resultado SQL.

Continuam bloqueados: autorização de execução real, acesso a tabelas privadas, migrações, reidratação multidispositivo, reversão real e publicação. Nenhum dado real modificado. Não aplicar este SQL à produção.