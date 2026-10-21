# Dashboard ArtEssencia — auditoria e reorganização (21/10/2026)

## Fonte inspecionada
`index.html` de `main`, com foco no ecrã `#dashboard` e na função `renderDashboard()`.

## Situação observada no código
- 8 KPI clicáveis: Encomendado, Recebido, Por receber, Encomendas, Lucro calculado, Margem real, Pendentes e Stock baixo.
- Filtro de ano/mês com botão Atualizar.
- Centro de controlo diário, faixa operacional, lista de próximas entregas e trabalhos.
- Aviso de configuração inicial e alerta sobre backup desatualizado.
- 8 atalhos rápidos.
- Tabelas completas de encomendas pendentes, valores a receber e orçamentos a acompanhar.
- Análise de rentabilidade e tendência dos últimos 12 meses.
- `renderDashboard()` atualiza indicadores e invoca `renderSmartAlertsV1810`, `renderDashboardProfitabilityV1769`, `renderDashboardDaily`, `renderReceivables`, `renderQuotePipeline` e `renderTrend`.

## Diagnóstico
1. O painel contém indicadores úteis, mas o conjunto é demasiado vertical e repete caminhos já presentes nos módulos especializados.
2. A lista diária deveria aparecer antes dos quadros financeiros extensos.
3. Oito KPI ocupam espaço significativo no telemóvel e competem com tarefas urgentes.
4. As três tabelas ocupam espaço mesmo quando só uma é importante no momento.
5. A rentabilidade e o histórico de 12 meses não precisam estar sempre expandidos no fluxo diário.
6. Não é seguro reescrever `renderDashboard()` ou cálculos para uma reorganização visual.

## Layout a implementar depois de testes
- Linha 1: título, período e ação Atualizar.
- Linha 2: alertas realmente urgentes, sem duplicar avisos.
- Linha 3: 4 KPI prioritários (Encomendas, Pendentes, Por receber, Stock baixo). Outros 4 KPI mantidos num painel financeiro recolhível.
- Linha 4: Centro diário com produção e entregas, preservando handlers.
- Linha 5: Ações rápidas compactas.
- Linha 6: separadores internos com as tabelas **Pendentes / A receber / Orçamentos**; os três corpos continuam no DOM e continuam a receber os mesmos dados.
- Linha 7: secção recolhível de análise: rentabilidade e gráfico de 12 meses, preservando todos os dados e a renderização.

## Regras de segurança
- Apenas apresentação; não alterar `dash()`, `renderDashboard()`, `renderReceivables()`, `renderTrend()`, sincronização, loja, catálogo, contas, produção ou dados.
- Não ocultar alertas críticos nem o aviso de backup desatualizado.
- Navegação compatível com tablet e telemóvel.
- Não usar `innerHTML` para reconstruir partes com eventos existentes.
- Não reordenar elementos que dependam de índices; preferir wrappers visuais e `hidden`.
- Validar todos os KPI, filtros, atalhos, gráficos, tabelas e a atualização sem recarregar.
- Só integrar em produção após testes reais e autorização.

## Estado
Auditoria do HTML/JS e projeto visual elaborados. **Nenhuma alteração à interface ativa** nesta branch.
