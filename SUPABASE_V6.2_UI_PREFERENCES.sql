-- ============================================================================
-- Borion Finance — V6.2 — Preferências de interface (organização de módulos e itens)
-- ============================================================================
-- O QUE ESTE SCRIPT FAZ:
--   Cria UMA tabela nova, "borion_ui_preferences", só para guardar a ordem que
--   cada usuário escolheu para os módulos do menu e para os itens de bancos,
--   cartões e reservas dentro de cada perfil financeiro.
--
-- O QUE ESTE SCRIPT NÃO FAZ:
--   - Não altera nenhuma tabela financeira existente (profiles, borion_profile_data,
--     borion_backups, ou qualquer outra).
--   - Não move, apaga nem duplica nenhum dado de conta, cartão, reserva ou lançamento.
--   - Não é obrigatório para o Borion funcionar: sem esta tabela (ou sem internet),
--     a organização continua funcionando 100% localmente no dispositivo.
--
-- COMO EXECUTAR:
--   Supabase → SQL Editor → cole este arquivo inteiro → Run.
--   Pode ser executado mais de uma vez sem problema (tudo usa IF NOT EXISTS).
-- ============================================================================

create table if not exists public.borion_ui_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null,
  preference_key text not null,
  preference_value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint borion_ui_preferences_unique unique (user_id, profile_id, preference_key)
);

comment on table public.borion_ui_preferences is
  'Preferências de interface do Borion (ordem de módulos e itens). Não contém dados financeiros.';
comment on column public.borion_ui_preferences.preference_key is
  'Tipo da lista organizada: modules | contas | cartoes | reservas.';
comment on column public.borion_ui_preferences.preference_value is
  'Lista de IDs (dos próprios módulos/contas/cartões/reservas já existentes) na ordem escolhida pelo usuário.';

create index if not exists idx_borion_ui_preferences_lookup
  on public.borion_ui_preferences (user_id, profile_id, preference_key);

alter table public.borion_ui_preferences enable row level security;

drop policy if exists "borion_ui_preferences_select_own" on public.borion_ui_preferences;
create policy "borion_ui_preferences_select_own"
  on public.borion_ui_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "borion_ui_preferences_insert_own" on public.borion_ui_preferences;
create policy "borion_ui_preferences_insert_own"
  on public.borion_ui_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "borion_ui_preferences_update_own" on public.borion_ui_preferences;
create policy "borion_ui_preferences_update_own"
  on public.borion_ui_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "borion_ui_preferences_delete_own" on public.borion_ui_preferences;
create policy "borion_ui_preferences_delete_own"
  on public.borion_ui_preferences for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Fim do script. Nenhuma tabela financeira foi tocada.
-- ============================================================================
