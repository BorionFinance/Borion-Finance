# Borion Finance V6.27.4 — Botões compactos em faturas e boletos

## Pedido corrigido

A tela **Cartões e Contas** voltou ao padrão visual simples usado em Lançamentos:

- **✔**: marcar como pago;
- **↺**: voltar para em aberto.

## Onde os botões ficaram

- Na linha da **fatura inteira de cada cartão**;
- Em cada **compra/parcela da fatura** que também aparece em Lançamentos;
- Na parcela mensal de cada **boleto**.

## Sincronização

- Alterar uma compra vinculada dentro da fatura atualiza o mesmo lançamento em **Lançamentos**;
- Alterar o lançamento em **Lançamentos** muda imediatamente o botão e o status dentro da fatura;
- O mesmo vale para boletos fixos e variáveis;
- Pagar a fatura inteira marca os lançamentos vinculados como pagos;
- Desfazer a fatura restaura o estado individual anterior de cada lançamento;
- Não é permitido reabrir uma compra isolada enquanto a fatura inteira estiver paga.

## Remoção solicitada

A seção **Despesas vinculadas às contas** foi removida por completo. Despesas pagas diretamente por Pix, dinheiro, conta ou reserva continuam sendo controladas somente em **Lançamentos**.

## Arquivos principais alterados

- `js/10-cards-accounts.js`
- `js/05-calculations-charts.js`
- `css/styles.css`
- `js/02-backup-local.js`
- `js/13-settings.js`
- `index.html`
- `sw.js`
- `tests/borion-regression-tests.js`
