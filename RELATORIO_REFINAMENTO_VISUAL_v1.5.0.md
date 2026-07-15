# Relatório de refinamento visual — v1.5.0

## Alterações realizadas

- Unificação visual de todas as janelas flutuantes em uma superfície azul-escura legível.
- Correção dos fundos brancos em formulários, seções, listas, tabelas, campos, arquivos, botões, abas, avisos e rodapés dos modais.
- Contraste revisado para títulos, rótulos, textos auxiliares, placeholders, opções de seleção e estados semânticos.
- Entrada e saída de modais refeitas com `transform` e `opacity`, evitando animações que forçam layout.
- Navegação entre páginas com deslocamentos menores, tempos consistentes e curva de aceleração mais suave.
- Indicador do menu lateral convertido de animação de altura para `scaleY`, reduzindo recálculos de layout.
- Canvas da tela de bloqueio otimizado com limite de DPR, cálculo de distância ao quadrado, menos pontos, atualização baseada no tempo e pausa em aba oculta.
- Rolagem do painel ao fundo bloqueada enquanto qualquer janela flutuante estiver aberta.
- Service Worker e cache atualizados para v1.5.0, impedindo reaproveitamento visual da versão anterior.

## Resultado esperado

Interface mais consistente, sem áreas brancas fora da estética, melhor leitura e animações mais estáveis em telas de 60 Hz. O desempenho real depende do navegador e do hardware, mas o caminho de renderização foi otimizado para favorecer 60 FPS.
