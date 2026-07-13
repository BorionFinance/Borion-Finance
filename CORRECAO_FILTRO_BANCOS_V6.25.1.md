# Borion V6.25.1 — Correção do filtro de bancos

O filtro global passa a representar instituições financeiras, e não todos os registros da tela Cartões e Contas.

## Regras
- Exclui Carteira/dinheiro físico.
- Une nomes iguais sem diferenciar maiúsculas/minúsculas.
- Mantém uma única opção para cada banco, mesmo existindo conta e cartão da mesma instituição.
- Preserva a filtragem dos lançamentos pela instituição selecionada.
