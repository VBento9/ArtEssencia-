# ArtEssencia — Editor de Produtos compacto (UX)
Data: 2026-11-04
Base: Backoffice 1.9.120, PR #183 já integrado.

## Problema
Os cinco passos do editor ocupavam várias linhas no tablet e telemóvel, com navegação pouco clara e repetidos movimentos verticais até encontrar o próximo separador.

## Alterações
- Os cinco separadores existentes são reaproveitados, sem mexer no seu conteúdo nem nos controlos de negócio.
- Em ecrãs até 1100 px, os separadores dispõem-se numa única faixa horizontal deslocável; descrições longas permanecem num guia contextual abaixo.
- Guia compacto com "Passo X de 5", título, informação sobre o passo atual e botões "Anterior" / "Próximo".
- Os botões usam `.click()` sobre os separadores originais; não efetuam gravações automáticas nem alterações em campos.
- Estados e atributos de acessibilidade sincronizados com o passo ativo.
- Novo identificador da cache PWA para atualização na aplicação instalada.

## Restrições preservadas
Todos os controlos reais de Produtos, fichas técnicas, dados, fotos, receitas, stock, preços, Supabase, sincronização Cloud, encomendas e documentos A4/A5 permanecem intactos.

## Verificações
Validação de sintaxe JavaScript e balanceamento CSS; validação Vercel (branch e produção). Testes manuais de navegação, scroll e gestos no Honor Pad 9 e telemóvel ainda necessários.
