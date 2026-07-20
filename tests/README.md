# Testes do importador v6.35.0

Executar na raiz do projeto:

```bash
node tests/test_importador_legado.js
```

Cobre regressão básica de CSV, OFX e TXT.

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

## Atualização ao vivo entre dispositivos v6.38.0

```bash
node tests/test_live_update.js
```

Testa `checkForRemoteUpdate()` (o "atualização ao vivo" que detecta quando outro dispositivo salvou algo novo e atualiza a tela sozinho, sem precisar sair e entrar de novo): nada muda quando não há nada novo; atualiza e redesenha a tela quando é seguro; nunca aplica com uma alteração local pendente; adia (não descarta) quando existe um modal aberto ou um campo em edição; lida com o perfil ativo sendo removido em outro dispositivo; e não faz nada com a aba em segundo plano.

## Correção crítica de sincronização v6.38.1

```bash
node tests/test_drive_sync_fail_safe.js
```

Testa que uma alteração pendente é preservada e reenviada ao Drive mesmo após falha (token expirado, sem internet), que o envio retoma sozinho ao voltar ao aplicativo, e que uma edição feita enquanto outra ainda está sendo enviada não se perde.
