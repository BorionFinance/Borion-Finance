# Testes do importador v6.35.0

Executar na raiz do projeto:

```bash
node tests/test_importacao_prints_core.js
node tests/test_importador_legado.js
```

O primeiro teste cobre o cenário de sete movimentações do Mercado Pago, matemática de Conta/Reservas, reimportação e rollback. O segundo cobre regressão básica de CSV, OFX e TXT.

## Central do Borion v6.36.0

```bash
node tests/test_help_center.js
```

Valida o carregamento do módulo de ajuda, os guias obrigatórios, a história do projeto e o inventário completo do checklist.

## Proteção de dados e Google Drive v6.37.0

```bash
node tests/test_data_guard.js
node tests/test_data_guard_integration.js
```

O primeiro testa a lógica pura de contagem de registros e detecção de queda suspeita (`js/01d-data-guard.js`), isolada, sem depender de rede. O segundo carrega o `js/01c-google-drive-provider.js` real dentro de um sandbox Node e confirma que `syncNow()`/`forceSyncNow()` realmente bloqueiam uma gravação suspeita ANTES de qualquer chamada de rede — não só a lógica de contagem em isolado.
