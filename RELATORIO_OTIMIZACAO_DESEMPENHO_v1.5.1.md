# Relatório de otimização de desempenho — v1.5.1

## Gargalos removidos

- Canvas da tela de bloqueio deixou de redesenhar centenas de conexões em loop contínuo. Agora o circuito é desenhado uma única vez e somente redesenhado ao redimensionar a janela.
- Removidos `backdrop-filter` e desfoques em tempo real das superfícies principais, mantendo o mesmo visual por fundos opacos/translúcidos equivalentes.
- Removida a espera artificial de 120 ms antes de cada troca de página.
- Removidas animações individuais e atrasadas em cada linha ou card.
- Transições de `box-shadow` foram retiradas; ficaram apenas transformações e cores rápidas.
- Pesquisa global recebeu debounce curto para evitar reconstrução completa da tela a cada tecla.
- Listas longas usam renderização sob demanda fora da área visível.
- Cache e Service Worker atualizados para v1.5.1.

## Preservado

- Tema escuro e legibilidade de todas as janelas flutuantes.
- Fundo tecnológico da tela de bloqueio, agora estático e muito mais leve.
- Transições curtas de entrada de página e modal.
- Todas as funções, dados, backups e integrações existentes.
