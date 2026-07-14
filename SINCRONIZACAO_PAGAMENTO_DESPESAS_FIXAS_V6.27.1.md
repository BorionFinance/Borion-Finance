# Borion V6.27.1 — Status sincronizado das despesas fixas

## Objetivo
Unificar o estado Pago/Em aberto das despesas fixas entre Lançamentos e Cartões e Contas.

## Alterações
- Toda despesa fixa possui botão para marcar como paga ou voltar para em aberto, independentemente de Carteira, Conta, Reserva, Crédito ou Boleto.
- Cartões e Contas exibe uma seção com as despesas fixas ativas do mês e o mesmo controle de status.
- Compras fixas no cartão possuem baixa individual por competência.
- Fatura paga torna as compras fixas ativas daquele mês pagas; ao desfazer a fatura, elas voltam para em aberto, exceto quando houver baixa individual.
- Boletos usam o próprio histórico de pagamentos como fonte única do status.
- Dados da V6.27.0 com status global são migrados para apenas a primeira competência, evitando marcar todas as parcelas futuras como pagas.

**Versão:** 6.27.1  
**Data:** 14/07/2026
