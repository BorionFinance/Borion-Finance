# Borion Finance V6.23.3 — Refinamento do histórico dos Cofrinhos

## Ajustes realizados

A tela de histórico dos Cofrinhos foi ampliada e reorganizada sem alterar a lógica financeira ou os snapshots mensais.

### Causa da modal estreita

A classe específica do relatório definia uma largura maior, porém a regra global de `.modal-box` ainda aplicava `max-width: 400px`.

A V6.23.3 sobrescreve explicitamente esse limite com:

- largura máxima de 1180 px no desktop;
- altura adaptada à janela;
- cabeçalho e rodapé fixos;
- rolagem somente no conteúdo central.

### Valores e cards

- Valores monetários usam `white-space: nowrap`.
- Os quatro cards principais ficam lado a lado em telas grandes.
- Tablet e celular recebem grades responsivas.
- As linhas de comparação deixam de exigir rolagem horizontal em telas menores.

### Acesso ao histórico

O grande módulo visual foi removido da página de Reserva.

Agora o histórico aparece como uma ação secundária e discreta chamada **Histórico**, integrada à barra de ações dos Cofrinhos.

O fechamento mensal também ficou compacto:

- antes do fechamento: botão discreto **Fechar [mês]**;
- depois do fechamento: status sutil **[mês] fechado**.

## Regras preservadas

Não foram alterados:

- cálculos de Reserva;
- cálculos ou movimentações de Cofrinhos;
- snapshots mensais;
- fechamento único por competência;
- histórico somente leitura;
- backups;
- vínculos por `accountId`;
- assinaturas ou saldos bancários.

## Arquivos modificados

- `css/styles.css`
- `js/09-patrimony-goals.js`
- `js/02-backup-local.js`
- `js/13-settings.js`
- `index.html`
- `sw.js`
- `CHANGELOG.md`
- `tests/borion-regression-tests.js`
- `tests/regression-results.json`
- `tests/README.md`

## Validação

- 25 de 25 testes automatizados aprovados.
- Todos os arquivos JavaScript passaram em `node --check`.
- A folha CSS foi analisada com `tinycss2` sem erros de sintaxe.
- O cache do PWA foi atualizado para impedir que a interface antiga permaneça carregada.
