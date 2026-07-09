# Borion Finance V5.35.1 — Backup Security Foundation

## Onde ficam os dados vivos

No Supabase, os dados em uso ficam principalmente em:

- `public.profiles` — perfis financeiros, cor, avatar e senha do perfil em hash.
- `public.borion_profile_data` — dados financeiros de cada perfil.
- `auth.users` — conta, e-mail e senha do login Supabase.

## Onde ficam os backups

A partir da V5.35.1, os snapshots ficam em:

- `public.borion_backups`

Caminho no painel:

`Supabase → Table Editor → borion_backups`

Cada linha guarda um backup completo da conta em `backup_json`, com metadados:

- `backup_type`
- `app_version`
- `profile_count`
- `reason`
- `source`
- `checksum`
- `created_at`

## Backup local no computador

Em navegadores compatíveis, como Chrome/Edge, o Borion pode salvar JSON em uma pasta escolhida pelo usuário.

O navegador exige autorização manual. O app não consegue criar uma pasta sozinho sem o usuário clicar e permitir.

A subpasta criada é:

`Backups_Borion`

Recomendação: escolher uma pasta dentro de Google Drive, OneDrive ou outro serviço sincronizado.

## Tipos de backup

- `manual` — criado manualmente na tela Configurações → Backups.
- `first_setup` — criado depois do aceite de proteção de dados.
- `auto_daily` — criado automaticamente quando o Borion está aberto e já passaram 24h desde o último snapshot.
- `before_delete_profile` — criado antes de excluir perfil.
- `before_import_replace` — criado antes de substituir dados por JSON.
- `before_import_merge` — criado antes de mesclar JSON.
- `before_restore_account` — criado antes de restaurar a conta inteira.
- `diagnostic` — criado pelo Diagnóstico Supabase e apagado em seguida.

## SQL obrigatório

Rode um destes arquivos no SQL Editor do Supabase:

- `SUPABASE_V5.34_CLOUD_FOUNDATION.sql` atualizado; ou
- `SUPABASE_V5.35_BACKUP_SECURITY.sql`

Sem isso, a tela de backups pode abrir, mas o snapshot no Supabase não será salvo.

## Restaurar em caso de problema

1. Abra o Borion.
2. Vá em Configurações → Backups.
3. Clique em “Ver backups do Supabase”.
4. Escolha um backup.
5. Clique em “Restaurar”.

Antes de restaurar, o Borion tenta criar outro backup do estado atual com tipo `before_restore_account`.
