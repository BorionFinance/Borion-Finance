# Testes de regressão — Borion V6.23.4

Execute na raiz do projeto:

```bash
node tests/borion-regression-tests.js
```

A suíte cobre os 12 cenários financeiros obrigatórios da V6.23.1, migração por `accountId`, separação entre conta e cartão, backups Drive&Local e os relatórios mensais somente leitura dos Cofrinhos.

Resultado atual: **25/25 testes aprovados**.

- Interface do histórico dos Cofrinhos: modal ampla, rolagem interna, valores sem quebra e acesso discreto na barra do módulo.
