-- Borion Finance V5.36.0
-- Função para permitir que o usuário logado exclua a própria conta pelo app.
-- Rode UMA vez no SQL Editor do Supabase.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  -- Dados do Borion ligados à conta. Usa to_regclass para não quebrar caso alguma tabela ainda não exista no projeto.
  if to_regclass('public.borion_backups') is not null then
    delete from public.borion_backups where user_id = v_uid;
  end if;

  if to_regclass('public.borion_profile_data') is not null then
    delete from public.borion_profile_data where user_id = v_uid;
  end if;

  if to_regclass('public.profiles') is not null then
    delete from public.profiles where user_id = v_uid;
  end if;

  -- Conta de login do Supabase Auth.
  -- Em projetos Supabase normais, apagar auth.users remove sessões/identidades relacionadas por cascata.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
