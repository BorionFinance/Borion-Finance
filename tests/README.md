# Testes de regressão — Borion V6.29.0

Execute na raiz do projeto:

```bash
node tests/borion-regression-tests.js
```

A suíte cobre os 12 cenários financeiros obrigatórios da V6.23.1, migração por `accountId`, separação entre conta e cartão, backups Drive&Local, relatórios mensais dos Cofrinhos, conversão segura de Metas em Reservas e o Smartphone Mode.

Resultado atual: consulte `regression-results.json`.

- Interface do histórico dos Cofrinhos: modal ampla, rolagem interna, valores sem quebra e acesso discreto na barra do módulo.
- Reserva desligada: metas independentes podem ser adicionadas, editadas e excluídas; metas ligadas aos Cofrinhos ficam ocultas.
- Reserva reativada: metas independentes viram Cofrinhos uma única vez, sem apagar os já existentes.
- Smartphone Mode: detecção automática no celular, início simplificado, lançamento rápido e navegação inferior.

- Botão Voltar no Smartphone Mode: fecha camada, volta ao Início e confirma antes de sair.
