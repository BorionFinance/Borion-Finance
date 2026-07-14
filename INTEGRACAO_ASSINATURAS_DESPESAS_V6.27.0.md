# Borion V6.27.0 — Assinaturas e despesas integradas

## Alterações principais

### Assinaturas
- Toda assinatura por Conta gera um lançamento vinculado em **Despesa variável**.
- Antes do vencimento, o lançamento fica **Em aberto** e não altera o saldo.
- No vencimento, o lançamento muda para **Pago** e o valor é retirado uma única vez da conta escolhida.
- Assinaturas no Crédito são adicionadas imediatamente ao cartão selecionado e espelhadas em **Despesa variável**.
- O vínculo entre assinatura, cobrança, parcela e lançamento impede duplicidades ao sincronizar novamente.
- Pausar ou excluir uma assinatura remove previsões ainda não consolidadas, preservando apenas cobranças financeiras já realizadas.

### Despesa fixa
- Novo fluxo visual com **Carteira, Conta, Reserva ou Crédito**.
- Carteira seleciona Dinheiro automaticamente.
- Conta libera Pix ou Débito e a conta de origem.
- Reserva permite selecionar o cofrinho pagador.
- Crédito permite selecionar cartão, compra à vista ou parcelada.
- Novo controle **Pago/Em aberto** para o mês selecionado.
- Em aberto não altera saldos; Pago aplica o débito e permite estorno seguro.

### Parcelas e Reservas
- A categoria da parcela acompanha o tipo escolhido: variável usa categorias variáveis; fixa usa categorias fixas.
- Com Reservas desativado em Configurações, a opção Reserva não aparece nos formulários.

## Validação
- 72 testes de regressão aprovados.
- Todos os arquivos JavaScript passaram na validação sintática.
- ZIP verificado após o empacotamento.

**Versão:** 6.27.0
