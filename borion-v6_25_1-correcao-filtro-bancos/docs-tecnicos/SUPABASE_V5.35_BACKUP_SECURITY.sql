-- IMPORTANTE: rode este arquivo inteiro no Supabase > SQL Editor.
-- Ele é seguro para reexecutar e corrige tabelas antigas que foram criadas antes dos perfis.
create extension if not exists pgcrypto;

-- Borion V5.34.8 — Cloud Foundation (RLS + grants + profile passwords)
-- Rode este SQL no Supabase > SQL Editor antes de usar a V5.34.
-- Pode rodar em cima de um banco que já tinha a V5.34 original: os "drop policy if exists"
-- e "create table if not exists" tornam este script seguro para reexecutar.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Perfil principal',
  avatar_color text default '#1f8a5b',
  avatar_image text default '',
  password_hash text default null,
  password_salt text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists name text not null default 'Perfil principal';
alter table public.profiles add column if not exists avatar_color text default '#1f8a5b';
alter table public.profiles add column if not exists avatar_image text default '';
alter table public.profiles add column if not exists password_hash text default null;
alter table public.profiles add column if not exists password_salt text default null;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.borion_profile_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  sync_version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique(profile_id)
);

alter table public.borion_profile_data add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.borion_profile_data add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
alter table public.borion_profile_data add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.borion_profile_data add column if not exists sync_version bigint not null default 1;
alter table public.borion_profile_data add column if not exists updated_at timestamptz not null default now();

-- Remove restos inválidos e duplicados antigos antes de criar a garantia de 1 linha por perfil.
delete from public.borion_profile_data where user_id is null or profile_id is null;
with ranked as (
  select id,
         row_number() over (partition by profile_id order by updated_at desc nulls last, id desc) as rn
  from public.borion_profile_data
)
delete from public.borion_profile_data d
using ranked r
where d.id = r.id and r.rn > 1;

alter table public.borion_profile_data alter column user_id set not null;
alter table public.borion_profile_data alter column profile_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'borion_profile_data_profile_id_key'
      and conrelid = 'public.borion_profile_data'::regclass
  ) then
    alter table public.borion_profile_data
      add constraint borion_profile_data_profile_id_key unique (profile_id);
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.borion_profile_data enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: cada linha só pode ser vista/alterada pelo dono (auth.uid() = user_id)
-- ---------------------------------------------------------------------------
drop policy if exists "Borion profiles select own" on public.profiles;
drop policy if exists "Borion profiles insert own" on public.profiles;
drop policy if exists "Borion profiles update own" on public.profiles;
drop policy if exists "Borion profiles delete own" on public.profiles;

create policy "Borion profiles select own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "Borion profiles insert own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "Borion profiles update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Borion profiles delete own" on public.profiles
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- borion_profile_data: reforço V5.34.1
-- Antes, a policy só conferia auth.uid() = user_id na própria linha. Isso não
-- impedia que alguém tentasse gravar um profile_id que não é dele (ex.: um ID
-- de perfil de outra conta, adivinhado ou vazado). Agora, além de checar o
-- dono da linha, cada policy também exige que exista um profiles.id = profile_id
-- cujo user_id seja o mesmo usuário autenticado — ou seja, profile_id precisa
-- pertencer ao mesmo usuário dono da linha em borion_profile_data.
-- ---------------------------------------------------------------------------
drop policy if exists "Borion data select own" on public.borion_profile_data;
drop policy if exists "Borion data insert own" on public.borion_profile_data;
drop policy if exists "Borion data update own" on public.borion_profile_data;
drop policy if exists "Borion data delete own" on public.borion_profile_data;

create policy "Borion data select own" on public.borion_profile_data
  for select using (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = borion_profile_data.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "Borion data insert own" on public.borion_profile_data
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "Borion data update own" on public.borion_profile_data
  for update using (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = borion_profile_data.profile_id
        and p.user_id = auth.uid()
    )
  ) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.user_id = auth.uid()
    )
  );

create policy "Borion data delete own" on public.borion_profile_data
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = borion_profile_data.profile_id
        and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Defesa em profundidade: mesmo que uma policy futura seja alterada por engano,
-- este trigger bloqueia no nível do banco qualquer INSERT/UPDATE em
-- borion_profile_data onde user_id e o dono de profile_id não batam.
-- ---------------------------------------------------------------------------
create or replace function public.borion_check_profile_owner()
returns trigger as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.profile_id
      and p.user_id = new.user_id
  ) then
    raise exception 'profile_id não pertence ao user_id informado (borion_profile_data).';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists borion_profile_data_owner_check on public.borion_profile_data;
create trigger borion_profile_data_owner_check
  before insert or update on public.borion_profile_data
  for each row execute function public.borion_check_profile_owner();

create index if not exists idx_borion_profiles_user on public.profiles(user_id);
create index if not exists idx_borion_profile_data_user_profile on public.borion_profile_data(user_id, profile_id);


-- Grants necessários para o PostgREST/Supabase API acessar as tabelas pelo usuário autenticado.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.borion_profile_data to authenticated;

-- Recarrega o schema cache do PostgREST para as colunas novas aparecerem imediatamente.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Borion V5.35.1 — Backup Security Foundation
-- Snapshots completos ficam em public.borion_backups.
-- Dados vivos continuam em public.profiles e public.borion_profile_data.
-- ---------------------------------------------------------------------------
create table if not exists public.borion_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_type text not null default 'manual',
  app_version text default '',
  profile_count integer not null default 0,
  backup_json jsonb not null default '{}'::jsonb,
  reason text default '',
  source text default 'app',
  checksum text default '',
  created_at timestamptz not null default now()
);

alter table public.borion_backups add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.borion_backups add column if not exists backup_type text not null default 'manual';
alter table public.borion_backups add column if not exists app_version text default '';
alter table public.borion_backups add column if not exists profile_count integer not null default 0;
alter table public.borion_backups add column if not exists backup_json jsonb not null default '{}'::jsonb;
alter table public.borion_backups add column if not exists reason text default '';
alter table public.borion_backups add column if not exists source text default 'app';
alter table public.borion_backups add column if not exists checksum text default '';
alter table public.borion_backups add column if not exists created_at timestamptz not null default now();

alter table public.borion_backups enable row level security;

drop policy if exists "Borion backups select own" on public.borion_backups;
drop policy if exists "Borion backups insert own" on public.borion_backups;
drop policy if exists "Borion backups delete own" on public.borion_backups;

create policy "Borion backups select own" on public.borion_backups
  for select using (auth.uid() = user_id);
create policy "Borion backups insert own" on public.borion_backups
  for insert with check (auth.uid() = user_id);
create policy "Borion backups delete own" on public.borion_backups
  for delete using (auth.uid() = user_id);

create index if not exists idx_borion_backups_user_created on public.borion_backups(user_id, created_at desc);

grant select, insert, delete on table public.borion_backups to authenticated;

-- Mantém no máximo 30 backups automáticos comuns por usuário, sem apagar backups manuais
-- nem backups gerados antes de ação perigosa. Executar manualmente quando quiser limpar:
-- delete from public.borion_backups b
-- using (
--   select id, row_number() over (partition by user_id, backup_type order by created_at desc) rn
--   from public.borion_backups
--   where backup_type in ('auto_daily','auto_local')
-- ) r
-- where b.id = r.id and r.rn > 30;

notify pgrst, 'reload schema';
