# Testes do importador v6.35.0

Executar na raiz do projeto:

```bash
node tests/test_importacao_prints_core.js
node tests/test_importador_legado.js
```

O primeiro teste cobre o cenário de sete movimentações do Mercado Pago, matemática de Conta/Reservas, reimportação e rollback. O segundo cobre regressão básica de CSV, OFX e TXT.
