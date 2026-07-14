# Borion V6.26.0 — Atualização visual de lançamentos e reservas

## Lançamentos
- Despesas variáveis agora têm status **Pago** ou **Em aberto**, independentemente da forma de pagamento.
- Lançamentos em aberto não alteram o saldo; ao marcar como pago, o Borion aplica o desconto correto. Ao voltar para em aberto, o saldo é estornado.
- O modal de despesa variável ganhou **Local da compra** e o fluxo visual por origem: **Carteira**, **Conta**, **Reserva** ou **Crédito**.
- Carteira seleciona Dinheiro automaticamente; Conta libera Pix ou Débito e a conta de origem; Reserva seleciona o cofrinho; Crédito seleciona cartão, tipo da compra e parcelas.
- Compras no crédito registram loja, data completa da compra e o dia do mês em que entram na fatura.
- Receita ganhou a origem **Rendimento**.

## Reservas
- Botão **Gerar lembrete** cria um item na Agenda usando o nome e a data-alvo da reserva.
- Movimentar reserva ganhou **Enviar para outra reserva**, com seleção do destino.
- Cada transferência cria uma saída e uma entrada vinculadas.
- Nova aba **Entre reservas** em Lançamentos, oculta automaticamente quando o módulo Reserva estiver desativado.
- Edição e exclusão de transferências validam o saldo da reserva de destino para preservar a integridade financeira.

## Assinaturas e categorias
- Nova assinatura usa todas as categorias de despesa variável.
- Configurações → Categorias permite ordenar por A–Z, Z–A, recentes, antigas ou ordem personalizada.
- A ordem definida é usada nos seletores de lançamentos e assinaturas e permanece separada por perfil.

## Compatibilidade
- Lançamentos variáveis antigos são migrados como **Pago**, preservando os saldos já existentes.
- O cache do PWA foi atualizado para carregar a nova versão imediatamente.

**Versão:** 6.26.0  
**Lançamento:** 13/07/2026
