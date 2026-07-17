# RELATÓRIO DE CORREÇÃO — LAYOUT MOBILE ANDROID

## Projeto
Borion Finance v6.34.5

## Escopo desta correção
Após a correção do scroll da v6.34.4, ainda restavam problemas visuais no modo Smartphone/Android:

1. a tabela de **Lançamentos > Receita/Despesa** estava larga demais no mobile;
2. parte do conteúdo ficava “para fora” da área visível;
3. o gráfico **Composição por categoria** aparecia descentralizado/cortado;
4. a navegação por abas precisava de ajuste fino para telas pequenas.

## Causa raiz encontrada
### 1) Tabela de lançamentos com largura mínima fixa no mobile
Havia a regra:

```css
html[data-interface-mode="smartphone"] .budget-launch-table{min-width:680px}
```

Essa regra forçava a tabela a ficar maior que a largura útil do Android. Como o scroll principal foi centralizado em `#view-root` e o overflow horizontal é ocultado, o resultado visual era exatamente o relatado: a parte direita ficava “para fora”.

### 2) Componentes do card e do gráfico sem contenção suficiente no mobile
O bloco do gráfico de composição e sua legenda ainda podiam extrapolar visualmente em telas estreitas.

## Correções aplicadas
### CSS / layout mobile
- removida a largura mínima fixa de `680px` da `.budget-launch-table` no Smartphone Mode;
- tabela mobile convertida para:
  - `width: 100%`;
  - `min-width: 0`;
  - `table-layout: fixed`;
- colunas ajustadas para caberem no Android;
- coluna de **Categoria** ocultada apenas no mobile, reduzindo largura sem remover informações essenciais da tela;
- padding e quebra de linha revisados nos campos do lançamento;
- painéis mobile com `overflow: hidden` para impedir vazamento visual.

### Gráfico de composição por categoria
- `donut-wrap` limitado a `width: 100%`;
- `donut-hole-wrap` tornado responsivo com largura/altura proporcionais ao viewport;
- SVG centralizado e contido;
- legenda adaptada para grid responsivo, evitando deslocamento do card.

### Abas do orçamento
- redução leve de `gap`, padding e fonte no Smartphone Mode;
- manutenção do scroll horizontal das abas, porém com melhor encaixe visual em telas estreitas.

## Arquivos alterados
- `css/styles.css`
- `index.html`
- `sw.js`
- `manifest.json`
- `js/02-backup-local.js`
- `js/13-settings.js`
- `js/14-events-boot-pwa.js`

## Versionamento e cache
- versão dos assets: `?v=6.34.5`;
- cache do Service Worker atualizado para `6.34.5`;
- versão exibida no app: `6.34.5`.

## Revisão geral executada
Foi feito pente-fino de revisão com foco em:

1. scroll mobile (mantido funcionando);
2. largura de tabelas e painéis no Android;
3. centralização e contenção de gráficos;
4. ajuste de abas e elementos do modo Smartphone.

## Resultado esperado
No Android / modo Smartphone:

- a tela principal continua rolando normalmente;
- a área de Receita/Despesa não fica mais “para fora”;
- a tabela passa a caber visualmente na largura útil;
- o gráfico de composição fica centralizado e contido no card;
- o layout geral fica mais limpo e estável em telas pequenas.
