# Borion V6.24.4 — Salvamento manual unificado

## Correção
Todos os comandos manuais agora usam uma única função central:
- Ctrl+S;
- SALVAR DRIVE&LOCAL em Configurações;
- botões individuais de Drive e local;
- atalho fixo no menu lateral do Modo Pro.

## Google Drive
O backup manual usa um snapshot único para atualizar `current.json`, criar um `forcesave` e registrar o backup manual na pasta de backups.

## Local
Ao abrir o Borion, a permissão da pasta salva no navegador é verificada. Se estiver autorizada, o JSON é gravado diretamente. Se a pasta não estiver conectada ou perder a permissão, o backup manual baixa o JSON pelo navegador como fallback, além de manter o histórico interno no IndexedDB.

Por segurança do Chrome/Edge, uma permissão em estado “perguntar” não pode ser concedida automaticamente durante a abertura; o Borion avisa e solicita a reconexão no próximo clique manual.

## Informações
- Versão: 6.24.4
- Lançamento: 07/07/2026
- Desenvolvido por Pedro Bardella
- © 2026 Pedro Bardella. Todos os direitos reservados.
