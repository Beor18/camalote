-- El agente de Camalote (2026-10-03).
--
-- El agente compra según la regla aunque la app esté cerrada. Firma desde
-- el servidor con el permiso limitado que el usuario le da en Privy
-- (firmante de sesión con política). Acá queda:
--   - si el agente está activo en cada cuenta, con qué billetera de Privy
--     firma y en qué idioma habla;
--   - un candado, para que dos avisos seguidos no compren dos veces;
--   - la bitácora: lo que el agente hizo y le contó al usuario.

alter table public.accounts
  add column if not exists agent_enabled    boolean not null default false,
  add column if not exists agent_enabled_at timestamptz,
  add column if not exists privy_wallet_id  text,
  add column if not exists lang             text not null default 'en',
  add column if not exists agent_lock_until timestamptz,
  add column if not exists agent_last_run   timestamptz;

create index if not exists accounts_agent_enabled_idx on public.accounts (agent_enabled) where agent_enabled;

create table if not exists public.agent_events (
  id             bigint generated always as identity primary key,
  solana_address text not null references public.accounts (solana_address) on delete cascade,
  created_at     timestamptz not null default now(),
  -- set_aside | bought | waiting | error | enabled | disabled
  kind           text not null,
  -- Lo que el agente le dice al usuario, en su idioma.
  message        text not null,
  -- Quién decidió: el modelo (agent) o el plan B sin IA (rule).
  decided_by     text,
  data           jsonb not null default '{}'::jsonb
);
create index if not exists agent_events_account_idx on public.agent_events (solana_address, created_at desc);

alter table public.agent_events enable row level security;
revoke all on public.agent_events from anon, authenticated;

-- Toma el candado de una cuenta por unos segundos. Devuelve true si lo
-- consiguió (nadie más está corriendo el agente para esa cuenta).
create or replace function public.agent_try_lock(p_address text, p_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare got integer;
begin
  update public.accounts
     set agent_lock_until = now() + make_interval(secs => p_seconds),
         agent_last_run   = now()
   where solana_address = p_address
     and agent_enabled
     and (agent_lock_until is null or agent_lock_until < now());
  get diagnostics got = row_count;
  return got = 1;
end $$;

revoke all on function public.agent_try_lock(text, integer) from public, anon, authenticated;
grant execute on function public.agent_try_lock(text, integer) to service_role;
