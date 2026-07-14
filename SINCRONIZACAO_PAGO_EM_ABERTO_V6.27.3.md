# Borion Finance V6.27.3 — Pago/Em aberto sincronizado em Cartões e Contas

**Data:** 14/07/2026  
**Base utilizada:** V6.27.2 — auditoria de integridade  
**Resultado:** 80/80 testes regressivos e 214/214 verificações estruturais aprovados.

## Pedido aplicado

A tela **Cartões e Contas** agora possui os mesmos controles de pagamento usados nas despesas: **Pago** e **Em aberto**. O estado não é uma cópia visual; ele usa o mesmo registro financeiro de **Lançamentos**.

## O que foi alterado

### 1. Compras no cartão

- Toda compra marcada para aparecer em Despesas mostra os botões **Pago** e **Em aberto** no mês da parcela.
- Funciona para **Despesa fixa** e **Despesa variável**.
- Alterar o status na compra atualiza o lançamento correspondente.
- Alterar o status em Lançamentos atualiza a compra quando a tela é redesenhada.
- Se a fatura inteira estiver paga, a despesa não pode ser colocada em aberto até o pagamento da fatura ser desfeito.

### 2. Pagamento e estorno da fatura

- Ao pagar a fatura, as despesas variáveis vinculadas às parcelas daquele mês passam para **Pago** em Lançamentos.
- Antes da baixa, o Borion salva o estado individual de cada lançamento.
- Ao desfazer a fatura, cada lançamento volta exatamente ao estado anterior: o que já era Pago continua Pago e o que estava Em aberto volta para Em aberto.
- O débito bancário continua ocorrendo somente no pagamento da fatura, sem descontar cada compra de crédito separadamente.

### 3. Boletos

- Boletos vinculados a Despesas também exibem **Pago** e **Em aberto**.
- Marcar Pago abre o fluxo real de pagamento do boleto, solicita a conta e desconta o saldo uma única vez.
- Marcar Em aberto desfaz o pagamento, devolve o valor à conta e reabre o lançamento.
- O mês do lançamento é respeitado mesmo quando o usuário está visualizando um período filtrado diferente do mês atual.

### 4. Despesas vinculadas às contas

Foi criada a seção **Despesas vinculadas às contas** dentro de Cartões e Contas. Ela mostra, no mês selecionado:

- Despesas fixas pagas por conta, Carteira ou Reserva.
- Despesas variáveis pagas por conta, Carteira ou Reserva.
- Valor, vencimento/data, status e os dois botões de ação.

Compras de cartão e boletos não são repetidos nessa seção, porque já aparecem em seus próprios blocos.

### 5. Preservação do histórico mensal

Ao editar uma compra parcelada ou um boleto, o Borion preserva o status Pago/Em aberto de cada competência existente. A reconstrução do vínculo não transforma todas as parcelas em Pago nem apaga o estado dos meses anteriores.

### 6. Segurança contra duplicidade

- O botão correspondente ao estado atual fica desativado.
- As rotinas continuam idempotentes: clicar novamente não desconta nem devolve valores duas vezes.
- Cartão, boleto, despesa fixa, despesa variável e conta utilizam funções centrais de alteração de status.

## Arquivos principais modificados

- `js/05-calculations-charts.js`
- `js/07-budget.js`
- `js/10-cards-accounts.js`
- `css/styles.css`
- `js/13-settings.js`
- `js/02-backup-local.js`
- `index.html`
- `sw.js`
- `tests/borion-regression-tests.js`
- `tests/regression-results.json`
- `CHANGELOG.md`

## Testes novos adicionados

1. Despesa variável do cartão sincroniza nos dois sentidos.
2. Despesa variável de conta aplica e estorna o saldo uma única vez.
3. Boleto variável sincroniza lançamento, pagamento e saldo bancário.
4. Pagar e desfazer fatura restaura o status individual anterior de cada compra.

## Resultado final

- **80/80 testes regressivos aprovados**
- **214/214 verificações de integridade aprovadas**
- Todos os JavaScript passaram na validação sintática.
- Todos os handlers de botões encontrados continuam resolvidos.
- Todos os módulos carregados continuam presentes no cache offline.
