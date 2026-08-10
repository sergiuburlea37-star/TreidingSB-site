create extension if not exists pgcrypto;

create table if not exists public.trading_ideas (
  id uuid not null default gen_random_uuid(),
  schema_version text not null default '1.0',
  event_id text primary key,
  context_id text,
  created_at timestamptz not null default now(),
  symbol text,
  direction text,
  entry double precision,
  stop_loss double precision,
  take_profit double precision,
  risk_reward double precision,
  confidence text,
  execution_status text,
  fundamental_status text,
  risk_status text,
  guardrails_status text,
  ai_status text,
  ai_verdict text,
  ai_strength text,
  ai_summary text,
  outcome text,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Safe compatibility upgrade for the production legacy table.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'id'
  ) then
    alter table public.trading_ideas add column id uuid not null default gen_random_uuid();
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'schema_version'
  ) then
    alter table public.trading_ideas add column schema_version text not null default '1.0';
  else
    alter table public.trading_ideas alter column schema_version set default '1.0';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'ticker'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'symbol'
  ) then
    alter table public.trading_ideas rename column ticker to symbol;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'side'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'direction'
  ) then
    alter table public.trading_ideas rename column side to direction;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'entry'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'entry'
      and data_type <> 'double precision'
  ) then
    alter table public.trading_ideas
      alter column entry type double precision
      using (case when entry is null then null else trim(entry)::double precision end);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'stop_loss'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'stop_loss'
      and data_type <> 'double precision'
  ) then
    alter table public.trading_ideas
      alter column stop_loss type double precision
      using (case when stop_loss is null then null else trim(stop_loss)::double precision end);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'take_profit'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'take_profit'
      and data_type <> 'double precision'
  ) then
    alter table public.trading_ideas
      alter column take_profit type double precision
      using (case when take_profit is null then null else trim(take_profit)::double precision end);
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'context_id'
  ) then
    alter table public.trading_ideas add column context_id text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'risk_reward'
  ) then
    alter table public.trading_ideas add column risk_reward double precision;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'confidence'
  ) then
    alter table public.trading_ideas add column confidence text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'execution_status'
  ) then
    alter table public.trading_ideas add column execution_status text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'fundamental_status'
  ) then
    alter table public.trading_ideas add column fundamental_status text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'risk_status'
  ) then
    alter table public.trading_ideas add column risk_status text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'guardrails_status'
  ) then
    alter table public.trading_ideas add column guardrails_status text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'ai_status'
  ) then
    alter table public.trading_ideas add column ai_status text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'ai_verdict'
  ) then
    alter table public.trading_ideas add column ai_verdict text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'ai_strength'
  ) then
    alter table public.trading_ideas add column ai_strength text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'ai_summary'
  ) then
    alter table public.trading_ideas add column ai_summary text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'outcome'
  ) then
    alter table public.trading_ideas add column outcome text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'closed_at'
  ) then
    alter table public.trading_ideas add column closed_at timestamptz;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trading_ideas'
      and column_name = 'event_id'
  ) then
    alter table public.trading_ideas add column event_id text;
  end if;

  if exists (
    select 1 from public.trading_ideas where event_id is null
  ) then
    raise exception 'public.trading_ideas contains rows with NULL event_id; populate them manually before enforcing the unique key';
  end if;

  alter table public.trading_ideas
    alter column event_id set not null;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trading_ideas'::regclass
      and conname = 'trading_ideas_direction_check'
  ) then
    alter table public.trading_ideas
      add constraint trading_ideas_direction_check
      check (direction is null or direction in ('BUY', 'SELL'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trading_ideas'::regclass
      and conname = 'trading_ideas_execution_status_check'
  ) then
    alter table public.trading_ideas
      add constraint trading_ideas_execution_status_check
      check (execution_status is null or execution_status in ('APPROVED', 'BLOCKED'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trading_ideas'::regclass
      and conname = 'trading_ideas_risk_reward_check'
  ) then
    alter table public.trading_ideas
      add constraint trading_ideas_risk_reward_check
      check (risk_reward is null or risk_reward > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.trading_ideas'::regclass
      and conname = 'trading_ideas_outcome_check'
  ) then
    alter table public.trading_ideas
      add constraint trading_ideas_outcome_check
      check (
        outcome is null or outcome in (
          'OPEN',
          'TP_HIT',
          'SL_HIT',
          'BREAKEVEN',
          'MANUAL_CLOSE',
          'AMBIGUOUS',
          'UNKNOWN'
        )
      );
  end if;
end $$;

create unique index if not exists trading_ideas_event_id_key
  on public.trading_ideas (event_id);

create index if not exists trading_ideas_symbol_idx
  on public.trading_ideas (symbol);

create index if not exists trading_ideas_created_at_idx
  on public.trading_ideas (created_at);

create index if not exists trading_ideas_execution_status_idx
  on public.trading_ideas (execution_status);

create index if not exists trading_ideas_outcome_idx
  on public.trading_ideas (outcome);

alter table public.trading_ideas
enable row level security;
