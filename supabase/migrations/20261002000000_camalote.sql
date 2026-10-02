-- Camalote desde cero (2026-10-02).
--
-- La base se reutiliza de un proyecto anterior: primero se borra todo lo que
-- quedó en el esquema public (tablas, vistas, funciones, tipos) y el
-- disparador típico sobre auth.users. Después se crean las tablas de
-- Camalote.
--
-- Nadie lee estas tablas desde el navegador: RLS prendido y sin políticas,
-- así la clave pública (anon) no ve nada. Solo el servidor de Camalote, con
-- la clave secreta, lee y escribe, después de verificar con Privy que la
-- cuenta de Solana es de quien la pide.

-- 1. Limpieza del proyecto anterior -----------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    if r.relkind = 'm' then
      execute format('drop materialized view if exists public.%I cascade', r.relname);
    else
      execute format('drop view if exists public.%I cascade', r.relname);
    end if;
  end loop;

  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype in ('e', 'd', 'c')
      and not exists (select 1 from pg_class c where c.reltype = t.oid and c.relkind <> 'c')
      and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e')
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

-- 2. Camalote -----------------------------------------------------------------

-- Una fila por cuenta de Solana, atada al usuario de Privy que la tiene.
create table public.accounts (
  solana_address text primary key,
  privy_user_id  text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index accounts_privy_user_id_idx on public.accounts (privy_user_id);

-- La regla tal como la usa la app (InvestRule en JSON), con las columnas que
-- sirven para contar sacadas del JSON.
create table public.rules (
  solana_address    text primary key references public.accounts (solana_address) on delete cascade,
  data              jsonb not null,
  enabled           boolean generated always as (coalesce((data ->> 'enabled')::boolean, false)) stored,
  percent           integer generated always as ((data ->> 'percent')::integer) stored,
  asset             text    generated always as (data ->> 'asset') stored,
  pending_units     numeric generated always as (coalesce((data ->> 'pendingUnits')::numeric, 0)) stored,
  client_updated_at bigint  not null default 0,
  updated_at        timestamptz not null default now()
);

-- Cada compra o venta (Purchase en JSON): por regla o a mano.
create table public.operations (
  id             text not null,
  solana_address text not null references public.accounts (solana_address) on delete cascade,
  data           jsonb not null,
  kind           text    generated always as (coalesce(data ->> 'kind', 'buy')) stored,
  source         text    generated always as (data ->> 'source') stored,
  status         text    generated always as (data ->> 'status') stored,
  asset          text    generated always as (data ->> 'asset') stored,
  usdc_units     numeric generated always as ((data ->> 'usdcUnits')::numeric) stored,
  signature      text    generated always as (data ->> 'signature') stored,
  demo           boolean generated always as (coalesce((data ->> 'demo')::boolean, false)) stored,
  created_at     timestamptz generated always as (to_timestamp(((data ->> 'createdAt')::double precision) / 1000.0)) stored,
  updated_at     timestamptz not null default now(),
  -- El id lo arma el navegador: es único dentro de cada cuenta, así nadie
  -- puede pisar la operación de otro mandando el mismo id.
  primary key (solana_address, id)
);
create index operations_account_created_idx on public.operations (solana_address, created_at desc);

-- El número feo y real: cuántos armaron su regla, cuántas compras hizo la
-- regla con plata de verdad y cuántos USDC se invirtieron.
create view public.traction with (security_invoker = true) as
select
  (select count(*) from public.accounts)                                   as accounts,
  (select count(*) from public.rules where (data ->> 'configuredAt') is not null) as rules_configured,
  (select count(*) from public.rules where enabled)                        as rules_on,
  (select count(*) from public.operations
     where kind = 'buy' and source = 'rule' and status = 'done' and not demo) as rule_buys,
  (select coalesce(sum(usdc_units), 0) / 1e6 from public.operations
     where kind = 'buy' and status = 'done' and not demo)                  as usdc_invested;

alter table public.accounts   enable row level security;
alter table public.rules      enable row level security;
alter table public.operations enable row level security;

revoke all on public.accounts, public.rules, public.operations, public.traction from anon, authenticated;
