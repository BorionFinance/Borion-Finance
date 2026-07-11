# Borion Cloud — Supabase

Versão V5.33 Borion Cloud Pro.

## O que esta versão inclui

- Login com e-mail e senha pelo Supabase Auth.
- Criar conta.
- Recuperar senha por e-mail.
- Tela de nova senha depois do link de recuperação.
- Alterar senha em Configurações > Nuvem.
- Dados salvos na tabela `borion_data`, coluna `data`, em formato JSON.
- Cache local/offline no navegador.
- Sincronização automática rápida.
- Aviso ao fechar a página se existir dado ainda não sincronizado.
- Status de nuvem no topo do app.

## Onde ver os dados no Supabase

Supabase > Table Editor > borion_data.

Cada linha pertence a um usuário (`user_id`). Os dados financeiros ficam na coluna `data` em JSON.

## Configurações necessárias

Authentication > URL Configuration:

- Site URL: https://borionfinance.netlify.app
- Redirect URLs:
  - https://borionfinance.netlify.app
  - https://borionfinance.netlify.app/*

Durante testes, em Authentication > Sign In / Providers, deixe Confirm email desligado se quiser entrar sem confirmar e-mail.
