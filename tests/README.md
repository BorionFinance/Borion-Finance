# Testes do Borion Finance 6.42.0 — Boot e sincronização otimizados

Executar toda a suíte na raiz do projeto:

```bash
node tests/run_all.js
```

Verificar a sintaxe de todos os JavaScript:

```bash
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
```

## Cobertura específica da versão 6.42.0

- `test_boot_progress_v642.js`: primeira tela estática, etapas reais, acessibilidade, estados de lentidão, erro e recuperação, sem espera artificial.
- `test_boot_fast_path_v642.js`: modo de armazenamento lido antes dos serviços remotos e preparação paralela do boot.
- `test_google_lazy_load_v642.js`: Supabase sob demanda; Google Identity separado do Picker.
- `test_current_file_cache_v642.js`: reutilização direta do ID persistido do `current.json`.
- `test_drive_call_count_v642.js`: topologia canônica em cache sem redescoberta no caminho normal.
- `test_journal_skip_applied_v642.js`: 5.000 operações aplicadas e duas pendentes; somente duas leituras de conteúdo.
- `test_journal_archive_v642.js`: arquivamento somente após snapshot relido, checksum válido e `operationId` confirmado.
- `test_journal_legacy_applied_folder_v642.js`: compatibilidade gradual com estruturas 6.40/6.41 sem pasta `applied`.
- `test_live_sync_adaptive_v642.js`: agendamento por `setTimeout` em 2 s, 4,5 s e 12 s, sem chamadas sobrepostas.
- `test_remote_update_queue_v642.js`: formulário sujo preservado, espera da confirmação local e aplicação remota segura.
- `test_live_update.js`: integração da fila remota, exclusão de perfil e campo de pesquisa focado sem bloqueio indevido.
- `test_request_timeout_v642.js`: cancelamento real com `AbortController` e erro específico de timeout.
- `test_service_worker_fast_cache_v642.js`: HTML network-first com timeout, arquivos estáticos SWR e APIs externas fora do cache.

## Proteções mantidas

A suíte anterior continua cobrindo aplicação atômica, backup bruto pré-migração, paginação, fila durável, journal, merge de três vias, tombstones, exclusão de perfil entre dispositivos, múltiplas abas, detecção de base suspeita, importadores e integração MIT.

## Limites do ambiente automatizado

A API do Google Drive é simulada deterministicamente nos testes de segurança, paginação, concorrência, falhas e desempenho estrutural. O fluxo visual foi carregado em Chromium headless com os 36 scripts locais e sem erros JavaScript. OAuth real, latência pública do Google e dois aparelhos físicos exigem credenciais e ambiente de publicação; por isso não são declarados como testados neste pacote.
