# Testes — Borion V6.30.0

Execute na raiz do projeto:

```bash
node tests/borion-regression-tests.js
node tests/smart-interconnections-tests.js
node tests/system-integrity-audit.js
```

Resultados atuais:

- `regression-results.json`: 88/88 testes regressivos.
- `smart-interconnections-results.json`: 10/10 testes da integração inteligente.
- Auditoria estrutural: 223/223 verificações.

A suíte específica de integrações valida conversão por Vínculos, lançamento nativo/editável, preservação de alterações locais, antiduplicidade após edição, as duas formas de exclusão, preservação após tombstone da origem e descoberta automática dos campos externos.
