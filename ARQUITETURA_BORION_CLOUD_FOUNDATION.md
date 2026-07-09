# Borion V5.34 — Cloud Foundation

## Camadas
- Netlify: hospeda HTML, CSS, JS, PWA e service worker.
- Navegador/PWA: executa o Borion, mantém cache local/offline e mostra status real.
- Supabase: autenticação, tabela de perfis financeiros e dados por perfil.

## Conta vs perfil
- Conta = login Supabase com e-mail e senha.
- Perfil financeiro = conjunto separado de dados dentro da conta.
- Exportar/importar atua no perfil ativo por padrão.

## Tabelas
- `profiles`: id, user_id, name, avatar_color, avatar_image.
- `borion_profile_data`: user_id, profile_id, data JSON, sync_version, updated_at.

## Fluxo de salvamento
Alteração → cache local → pendência → Supabase → pendência limpa.
Se falhar, o Borion continua com dados locais e tenta sincronizar novamente.
