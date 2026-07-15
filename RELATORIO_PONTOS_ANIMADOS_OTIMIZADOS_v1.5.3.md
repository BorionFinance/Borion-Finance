# Marco Iris Tecnologia — v1.5.3

## Correção aplicada

A movimentação dos pontos e conexões da tela de bloqueio foi reativada sem restaurar o loop pesado da versão anterior.

## Otimizações

- 20 pontos no desktop, 15 em telas médias e 11 no celular.
- 60 FPS em equipamentos adequados e 30 FPS em dispositivos de menor capacidade.
- Resolução interna do canvas limitada para reduzir carga de GPU.
- Pausa automática ao trocar de aba ou minimizar a janela.
- Sem `shadowBlur`, filtros ou desfoques recalculados a cada quadro.
- Conexões calculadas apenas dentro de uma distância limitada.
- Onda inferior redesenhada com menos segmentos.
- Paleta e janelas flutuantes da v1.5.2 preservadas.
