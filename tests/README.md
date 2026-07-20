# Testes do Borion Finance 6.40.2 — Dados e Segurança

Executar toda a suíte na raiz do projeto:

```bash
node tests/run_all.js
```

Verificar sintaxe de todos os JavaScript:

```bash
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
```

## Cobertura principal da correção 6.40.2

- `test_atomic_account_apply_v6401.js`: preparação integral em memória, rollback de quota, migração interrompida, IDs de perfil duplicados e dados órfãos.
- `test_backup_gate_v6401.js`: backup exato antes da migração, JSON malformado/snapshot truncado, checksum, releitura, idempotência e bloqueio da migração quando o backup falha.
- `test_drive_pagination_v6401.js`: 2.500 arquivos em três páginas, deduplicação, ordenação estável, limite de segurança, falha fechada em página incompleta e política de retry HTTP.
- `test_journal_v6401.js`: relógio atrasado, operação aparecendo tardiamente, duplicata, operação já aplicada, árvores duplicadas, adulteração e compactação interrompida.
- `test_migration_preservation_v6401.js`: IDs determinísticos em dois ambientes, duplicatas legítimas distintas, migração idempotente e preservação de contas com dois e cinco perfis.
- `test_merge_schema_v6401.js`: merge de categorias, configurações, módulos, cartões, ordenação, vínculos e conflitos no mesmo campo.
- `test_multitab_v6401.js`: uma única líder, delegação da aba secundária, heartbeat, expiração do lease, transferência de liderança e ausência de duplicação.
- `test_real_delete_tombstones_v6401.js`: exclusão pela ação central real, captura de remoções implícitas, tombstones por entidade e perfil, tentativa de ressurreição e edição concorrente contra exclusão.
- `test_profile_delete_propagation_v6402.js`: exclusão imediata no Drive, operationId compartilhado entre tombstone e operação, bloqueio de ressurreição de perfil e retirada automática do perfil aberto em outra aba/dispositivo.
- `test_drive_sync_fail_safe.js`: fila local, 401, retorno da rede, edição durante upload, operação protegida com consolidação falhando, persistência da migração no boot e retomada após PATCH interrompido.

A suíte também mantém os testes anteriores de importação, ajuda, Data Guard, atualização ao vivo, fila durável, checksum, merge e versionamento.

## Limites do ambiente automatizado

Os testes de Google Drive usam simulações determinísticas da API, inclusive paginação, erros 401/403/429/500 e árvores duplicadas. O teste final com credenciais reais, duas abas e dois dispositivos deve ser executado no navegador conforme `REVISAO_V6.40.2.md`.
