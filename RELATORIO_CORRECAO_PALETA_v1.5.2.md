# Correção da paleta visual — v1.5.2

## Problema encontrado

A camada de desempenho da v1.5.1 substituiu as superfícies escuras do painel por fundos brancos em seletores globais de `topbar` e `card`. Isso quebrou a identidade visual azul-marinho, azul tecnológico e laranja da Marco Iris.

## Correções realizadas

- Topbar restaurada para azul-marinho escuro.
- Cards, KPIs e módulos restaurados para gradientes azul-escuros.
- Pesquisa, filtros, campos, tabelas, listas e caixas auxiliares padronizados na mesma paleta.
- Botões secundários, abas e seletores restaurados para tons azuis; ações principais continuam em laranja.
- Tela de bloqueio mantida na paleta aprovada.
- Janelas flutuantes preservadas exatamente com a correção escura da v1.5.0.
- Nenhum `backdrop-filter` pesado foi reativado; os ganhos de desempenho da v1.5.1 permanecem.
- Cache, Service Worker e identificadores atualizados para v1.5.2.
