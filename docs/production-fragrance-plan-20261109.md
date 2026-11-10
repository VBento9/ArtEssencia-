# Plano preparatório de fragrância real na Produção

Este módulo é apenas um cálculo isolado e **não está ligado ao Backoffice em produção**. Não altera preços, receitas, stock ou encomendas. Exige identificação da linha, um único ingrediente de fragrância, correspondência explícita com artigo de stock, unidade compatível e quantidade disponível.

A biblioteca de fragrâncias não é stock. A integração futura deverá validar a seleção por linha de encomenda, quantidade total por unidades produzidas, preço e receita históricos congelados, percentagens de uso e custo de referência da estrutura real. A RPC Cloud v1 recusa consumos diferentes da receita: é necessária uma RPC v2 transacional, versionada, autorizada e idempotente, com testes em dados sintéticos, antes de ativar a seleção no interface. Não usar este cálculo para efetuar descontos reais.
