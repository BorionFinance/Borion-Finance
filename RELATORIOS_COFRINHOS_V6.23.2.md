# Borion Finance V6.23.2 — Relatórios anteriores dos Cofrinhos

## O que foi adicionado

Na guia **Reserva**, foi criado um mini módulo chamado **Histórico mensal dos Cofrinhos**, com dois comandos:

- **Fechar [mês/ano]**: cria uma fotografia permanente dos Cofrinhos do perfil naquele momento.
- **Ver relatórios anteriores**: abre uma tela suspensa somente para consulta.

O relatório mensal mostra:

- total guardado no fechamento;
- total atual e evolução desde o fechamento;
- quantidade de Cofrinhos e meta total;
- valor, meta, banco, categoria e status de cada Cofrinho;
- entradas, saídas, rendimentos e quantidade de movimentações da competência;
- comparação individual entre o valor antigo e o valor atual;
- Cofrinhos criados depois do fechamento;
- Cofrinhos que existiam no mês antigo, mas não existem mais hoje.

## Somente leitura

A tela de relatório não possui campos de edição, movimentação ou exclusão. O snapshot é uma cópia desconectada dos dados atuais. Alterar depois o nome, o valor, a meta ou as movimentações de um Cofrinho não modifica o relatório já fechado.

## Integridade e persistência

Os relatórios ficam em `S.data.reservas.monthlyReports`, dentro dos dados do perfil atual. Com isso:

- cada perfil possui seu próprio histórico;
- os relatórios entram nos backups locais, Google Drive, exportações e restaurações existentes;
- nenhum relatório participa do cálculo de saldo ou patrimônio;
- o primeiro fechamento de cada competência é preservado;
- tentativas repetidas de fechar o mesmo mês retornam o relatório original;
- migrações e restaurações eliminam duplicatas da mesma competência, mantendo o fechamento mais antigo;
- a comparação entre Cofrinhos utiliza o ID, nunca apenas o nome.

## Arquivos modificados

- `index.html`
- `css/styles.css`
- `js/01-storage-data-state.js`
- `js/02-backup-local.js`
- `js/09-patrimony-goals.js`
- `js/13-settings.js`
- `sw.js`
- `CHANGELOG.md`
- `tests/borion-regression-tests.js`
- `tests/regression-results.json`

## Testes

Foram executados **23 testes**, com **23 aprovados** e **0 falhas**.

Os testes novos confirmam:

1. criação e migração de `monthlyReports`;
2. remoção defensiva de fechamentos duplicados;
3. congelamento real dos valores e movimentações do mês;
4. impossibilidade de sobrescrever o primeiro fechamento;
5. persistência após serialização/restauração;
6. comparação por ID mesmo com Cofrinhos de nomes iguais;
7. identificação de Cofrinhos criados depois ou removidos;
8. ausência de controles de edição no relatório.

As regressões financeiras da V6.23.1 também continuaram aprovadas, incluindo isolamento por `accountId`, Nubank recriada, assinaturas históricas, edição atômica e snapshot único Drive&Local.
