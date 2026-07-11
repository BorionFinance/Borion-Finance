# Supabase — código por e-mail é opcional

Na V5.39.6, a exclusão de conta voltou a ter confirmação por e-mail, mas usando o link mágico padrão do Supabase. O e-mail aparecerá como "Your sign-in link" e o usuário deve clicar em "Sign in" para voltar ao Borion.

Código numérico só será necessário se, no futuro, você configurar SMTP próprio e editar o template com `{{ .Token }}`.

---

# Borion Finance — Código por e-mail no Supabase (opcional)

Na V5.39.5, o fluxo de excluir conta não trava mais pedindo código OTP, porque o Supabase Auth costuma mandar um link mágico por padrão.

Se futuramente você quiser voltar a usar código numérico no e-mail, faça no Supabase:

1. Acesse Authentication > Email Templates.
2. Abra o template de Magic Link.
3. Coloque no corpo do e-mail algo como:

Seu código de confirmação do Borion é: {{ .Token }}

Ou mantenha também o link:

Clique para confirmar: {{ .ConfirmationURL }}

4. Em Authentication > URL Configuration, configure:

Site URL:
https://borionfinance.github.io/Borion-Finance/

Additional Redirect URLs:
https://borionfinance.github.io/Borion-Finance/**

Sem essa configuração, o Supabase pode redirecionar para https://borionfinance.github.io/ e cair no erro 404 do GitHub Pages.
