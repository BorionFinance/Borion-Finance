# Borion V6.24.5 — Correção do Force Save

## Causa do aviso falso
O módulo `Settings` era declarado com `const Settings = {...}`. Em scripts clássicos, uma variável global declarada com `const` não vira automaticamente `window.Settings`.

Os botões internos de Configurações funcionavam porque chamavam `Settings.manualBackup()` diretamente. Já o Ctrl+S e o botão fixo testavam `window.Settings`, recebiam `undefined` e exibiam a mensagem de falha mesmo com Drive e pasta local conectados.

## Correção
- `Settings` agora é exportado explicitamente como `window.Settings`.
- O Ctrl+S usa a rotina central `forceManualSave()`.
- O botão fixo do Modo Pro chama diretamente `forceManualSave()`, ou seja, é o mesmo comando do Ctrl+S.
- Não há mais uma implementação paralela para o botão fixo.

## O que o Force Save faz
- salva o estado atual;
- atualiza `current.json` no Google Drive;
- cria um slot rotativo `forcesave`;
- cria o backup manual protegido no Drive;
- cria o backup local interno;
- grava o JSON na pasta local autorizada ou baixa pelo navegador como fallback.

## Informações
- Versão: 6.24.5
- Lançamento: 07/07/2026
- Desenvolvido por Pedro Bardella
- © 2026 Pedro Bardella. Todos os direitos reservados.
