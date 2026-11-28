# Intelligence Hybrid — fase 3: consolidação segura (simulação)

A função existente renameStockReferencesV1737 no runtime index.html reescreve referências por nome de receitas, compras, movimentos, costMeta e produções não ready_stock. orderPackagingStockNeedV1757 resolve ainda encomendas por nome. Não executar essa função automaticamente nem fundir materiais sem validação completa.

Novo rename-planner: exige snapshot completo; contabiliza fichas, compras, movimentos, produções, embalagem de encomendas, custo e legado. Bloqueia colisões e casos com histórico/legado/metadados a reconciliar. Nos casos simples, gera plano de alteração do nome e linhas exatas de ficha, simula sobre cópia e devolve operações inversas. Não grava nada. Recalcula e compara o plano antes de simular; não substitui controlo de versão transacional. Não prova que duas matérias são equivalentes; a decisão de nomenclatura requer confirmação.

Missão stock_rename_plan disponível no núcleo mediante permissão. Testes: node tests/intelligence-rename-planner.test.cjs e node tests/intelligence-rename-mission.test.cjs. 17 verificações do planeador exercitadas no ambiente JS de autoria; integração Node ainda não executada. 

Não implementado: fusão de duplicados, classificação, atualização de histórico, adaptador autenticado, persistência, aplicação/reversão real, controlo de concorrência cloud. Nenhum dado real ou endpoint pago utilizado. A proteção do histórico é deliberadamente conservadora até existir uma estratégia verificável para todas as referências do runtime.