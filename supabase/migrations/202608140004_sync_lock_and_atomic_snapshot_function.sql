-- Commit atomic, fail-closed, pentru exact snapshoturile US + EU.
-- Nu se executa automat; rollout-ul este documentat in docs/eodhd-rollout.md.

begin;

create or replace function public.apply_portfolio_price_snapshot(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lock_key bigint := hashtext('portfolio_price_sync')::bigint;
  run_id uuid;
  pos jsonb;
  fx jsonb;
  perf jsonb;
  portfolio_row public.portfolios%rowtype;
  position_row public.portfolio_positions%rowtype;
  perf_count int;
  position_count int;
  active_position_count int;
  distinct_position_count int;
  updated_count int := 0;
  seen_codes text[] := array[]::text[];
  snapshot_date date;
  pending boolean;
  numeric_value numeric;
  db_basis jsonb;
begin
  if not pg_try_advisory_xact_lock(lock_key) then
    raise exception 'portfolio snapshot commit is locked';
  end if;

  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'payload must be an object';
  end if;
  run_id := nullif(payload->>'run_id', '')::uuid;
  if run_id is null or not exists (
    select 1 from public.portfolio_sync_lease
    where lease_name = 'portfolio_price_sync'
      and owner = run_id
      and expires_at > clock_timestamp()
  ) then
    raise exception 'active sync lease does not match run_id';
  end if;

  if jsonb_typeof(payload->'positions') is distinct from 'array'
     or jsonb_typeof(payload->'fx_rates') is distinct from 'array'
     or jsonb_typeof(payload->'performance_rows') is distinct from 'array'
     or jsonb_typeof(payload->'evaluation_basis') is distinct from 'object' then
    raise exception 'positions, fx_rates, performance_rows and evaluation_basis are required';
  end if;

  -- Blocheaza si compara exact baza evaluarii folosita de endpoint. O
  -- modificare admin comisa dupa read, dar inainte de RPC, produce mismatch;
  -- una concurenta dupa aceste locks asteapta commit-ul snapshotului.
  -- SHARE table locks sunt necesare si pentru INSERT-uri noi in ledger /
  -- pozitii (row locks singure nu previn phantoms).
  lock table public.portfolios,
             public.portfolio_positions,
             public.portfolio_transactions,
             public.portfolio_dividends,
             public.fx_rates in share mode;
  perform 1 from public.portfolios where code in ('US', 'EU') for update;
  perform 1 from public.portfolio_positions
    where active = true
       or id in (
         select nullif(item->>'id', '')::uuid
         from jsonb_array_elements(coalesce(payload#>'{evaluation_basis,positions}', '[]'::jsonb)) item
       )
    for update;
  perform 1 from public.portfolio_transactions
    where portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
    for update;
  perform 1 from public.portfolio_dividends
    where portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
    for update;
  perform 1 from public.fx_rates for update;

  if exists (
    select 1 from public.portfolio_positions
    where active = true and (
      quantity::text in ('NaN', 'Infinity', '-Infinity') or quantity < 0
      or avg_price::text in ('NaN', 'Infinity', '-Infinity') or avg_price < 0
      or (quantity > 0 and avg_price <= 0)
      or (current_price is not null and (
        current_price::text in ('NaN', 'Infinity', '-Infinity') or current_price <= 0
      ))
    )
  ) then raise exception 'position financial domain is invalid'; end if;

  if exists (
    select 1 from public.portfolio_transactions
    where portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
      and (
        amount::text in ('NaN', 'Infinity', '-Infinity') or amount <= 0
        or fee_amount::text in ('NaN', 'Infinity', '-Infinity') or fee_amount < 0
        or (quantity is not null and (quantity::text in ('NaN', 'Infinity', '-Infinity') or quantity <= 0))
        or (price is not null and (price::text in ('NaN', 'Infinity', '-Infinity') or price <= 0))
        or (type in ('BUY', 'SELL') and (quantity is null or price is null))
      )
  ) then raise exception 'transaction financial domain is invalid'; end if;

  if exists (
    select 1 from public.portfolio_dividends
    where portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
      and (amount::text in ('NaN', 'Infinity', '-Infinity') or amount <= 0)
  ) then raise exception 'dividend financial domain is invalid'; end if;

  if exists (
    select 1 from public.fx_rates
    where rate::text in ('NaN', 'Infinity', '-Infinity') or rate <= 0
  ) then raise exception 'existing FX financial domain is invalid'; end if;

  select jsonb_build_object(
    'portfolios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'base_currency', p.base_currency,
        'founded_date', p.founded_date
      ) order by p.id)
      from public.portfolios p where p.code in ('US', 'EU')
    ), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pp.id,
        'portfolio_id', pp.portfolio_id,
        'active', pp.active,
        'instrument_currency', pp.instrument_currency,
        'quantity', pp.quantity,
        'avg_price', pp.avg_price,
        'current_price', pp.current_price,
        'price_updated_at', case when pp.price_updated_at is null then null else
          to_char(pp.price_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'price_source', pp.price_source,
        'provider_symbol', pp.provider_symbol,
        'provider_price_multiplier', pp.provider_price_multiplier
      ) order by pp.id)
      from public.portfolio_positions pp where pp.active = true
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'portfolio_id', t.portfolio_id,
        'type', t.type,
        'amount', t.amount,
        'quantity', t.quantity,
        'price', t.price,
        'fee_amount', t.fee_amount,
        'currency', t.currency,
        'executed_date', to_char(t.executed_at at time zone 'UTC', 'YYYY-MM-DD')
      ) order by t.id)
      from public.portfolio_transactions t
      where t.portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
    ), '[]'::jsonb),
    'dividends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'portfolio_id', d.portfolio_id,
        'amount', d.amount,
        'currency', d.currency
      ) order by d.id)
      from public.portfolio_dividends d
      where d.portfolio_id in (select id from public.portfolios where code in ('US', 'EU'))
    ), '[]'::jsonb),
    'fx_rates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'base_currency', f.base_currency,
        'quote_currency', f.quote_currency,
        'rate', f.rate,
        'as_of_date', f.as_of_date,
        'source', f.source,
        'provider_fetched_at', case when f.provider_fetched_at is null then null else
          to_char(f.provider_fetched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
      ) order by f.id)
      from public.fx_rates f
    ), '[]'::jsonb)
  ) into db_basis;

  if db_basis <> payload->'evaluation_basis' then
    insert into public.portfolio_sync_runs (
      id, finished_at, applied, reason, problems,
      provider_call_units, provider_symbols_requested, quota_limit, quota_projected
    ) values (
      run_id, now(), false, 'state_changed',
      '[{"status":"evaluation_basis_changed"}]'::jsonb,
      coalesce((payload#>>'{quota,provider_call_units}')::int, 0),
      coalesce((payload#>>'{quota,provider_symbols_requested}')::int, 0),
      nullif(payload#>>'{quota,quota_limit}', '')::int,
      nullif(payload#>>'{quota,quota_projected}', '')::int
    );
    return jsonb_build_object('applied', false, 'reason', 'state_changed', 'run_id', run_id);
  end if;

  perf_count := jsonb_array_length(payload->'performance_rows');
  if perf_count <> 2 then
    raise exception 'performance_rows must contain exactly US and EU snapshots';
  end if;

  select count(*) into active_position_count from public.portfolio_positions where active = true;
  position_count := jsonb_array_length(payload->'positions');
  select count(distinct item->>'position_id') into distinct_position_count
  from jsonb_array_elements(payload->'positions') item;
  if position_count <> active_position_count or distinct_position_count <> active_position_count then
    raise exception 'positions must contain every active position exactly once';
  end if;

  for pos in select * from jsonb_array_elements(payload->'positions')
  loop
    select * into position_row
    from public.portfolio_positions
    where id = nullif(pos->>'position_id', '')::uuid and active = true;
    if not found then raise exception 'snapshot contains unknown or inactive position'; end if;
    if position_row.quantity is null
       or position_row.quantity::text in ('NaN', 'Infinity', '-Infinity')
       or position_row.quantity < 0
       or position_row.provider_price_multiplier is null
       or position_row.provider_price_multiplier::text in ('NaN', 'Infinity', '-Infinity')
       or position_row.provider_price_multiplier <= 0 then
      raise exception 'position quantity or multiplier is incomplete/invalid';
    end if;
    if position_row.provider_symbol is null or btrim(position_row.provider_symbol) = '' then
      raise exception 'active position is unmapped';
    end if;
    numeric_value := nullif(pos->>'price', '')::numeric;
    if numeric_value is null or numeric_value::text in ('NaN', 'Infinity', '-Infinity') or numeric_value <= 0 then
      raise exception 'position price must be finite and strictly positive';
    end if;
    if pos->>'price_source' <> 'delayed_feed' then
      raise exception 'EODHD snapshots must use delayed_feed';
    end if;
    if nullif(pos->>'provider_timestamp', '')::timestamptz is null then
      raise exception 'provider timestamp is required';
    end if;
    if position_row.price_updated_at is not null
       and position_row.price_updated_at > (pos->>'provider_timestamp')::timestamptz then
      raise exception 'provider timestamp regresses stored position timestamp';
    end if;

    update public.portfolio_positions
    set current_price = numeric_value,
        price_updated_at = (pos->>'provider_timestamp')::timestamptz,
        price_source = 'delayed_feed',
        updated_at = now()
    where id = position_row.id
      and (price_updated_at is null or price_updated_at <= (pos->>'provider_timestamp')::timestamptz);
    if found then updated_count := updated_count + 1; end if;
  end loop;

  for fx in select * from jsonb_array_elements(payload->'fx_rates')
  loop
    numeric_value := nullif(fx->>'rate', '')::numeric;
    if numeric_value is null or numeric_value::text in ('NaN', 'Infinity', '-Infinity') or numeric_value <= 0 then
      raise exception 'FX rate must be finite and strictly positive';
    end if;
    if nullif(fx->>'base_currency', '') is null
       or nullif(fx->>'quote_currency', '') is null
       or nullif(fx->>'provider_fetched_at', '')::timestamptz is null then
      raise exception 'FX row is incomplete';
    end if;
    insert into public.fx_rates (base_currency, quote_currency, rate, as_of_date, source, provider_fetched_at)
    values (
      fx->>'base_currency', fx->>'quote_currency', numeric_value,
      (fx->>'as_of_date')::date, 'delayed_feed', (fx->>'provider_fetched_at')::timestamptz
    )
    on conflict (base_currency, quote_currency, as_of_date) do update
      set rate = excluded.rate,
          source = excluded.source,
          provider_fetched_at = excluded.provider_fetched_at
      where public.fx_rates.provider_fetched_at is null
         or public.fx_rates.provider_fetched_at < excluded.provider_fetched_at;
  end loop;

  for perf in select * from jsonb_array_elements(payload->'performance_rows')
  loop
    select * into portfolio_row from public.portfolios
    where id = nullif(perf->>'portfolio_id', '')::uuid;
    if not found or portfolio_row.code not in ('US', 'EU') then
      raise exception 'performance row must reference US or EU portfolio';
    end if;
    if perf->>'portfolio_code' <> portfolio_row.code
       or perf->>'currency' <> portfolio_row.base_currency
       or portfolio_row.code = any(seen_codes) then
      raise exception 'performance portfolio code/currency is invalid or duplicated';
    end if;
    seen_codes := array_append(seen_codes, portfolio_row.code);
    if snapshot_date is null then
      snapshot_date := (perf->>'as_of_date')::date;
    elsif snapshot_date <> (perf->>'as_of_date')::date then
      raise exception 'US and EU snapshots must share as_of_date';
    end if;

    numeric_value := nullif(perf->>'nav_value', '')::numeric;
    if numeric_value is null or numeric_value::text in ('NaN', 'Infinity', '-Infinity') or numeric_value < 0 then
      raise exception 'NAV must be complete, finite and non-negative';
    end if;
    if nullif(perf->>'capital_contributed', '')::numeric is null
       or (perf->>'capital_contributed')::numeric::text in ('NaN', 'Infinity', '-Infinity')
       or (perf->>'capital_contributed')::numeric <= 0 then
      raise exception 'capital_contributed must be finite and strictly positive';
    end if;
    pending := nullif(perf->>'return_is_pending', '')::boolean;
    if pending is null then raise exception 'return_is_pending is required'; end if;
    if pending and perf->>'cumulative_return_pct' is not null then
      raise exception 'pending return must have null cumulative_return_pct';
    end if;
    if not pending then
      numeric_value := nullif(perf->>'cumulative_return_pct', '')::numeric;
      if numeric_value is null or numeric_value::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'non-pending return must be complete and finite';
      end if;
    end if;

    insert into public.portfolio_performance_history
      (portfolio_id, as_of_date, nav_value, capital_contributed, cumulative_return_pct, currency, return_is_pending)
    values (
      portfolio_row.id, snapshot_date, (perf->>'nav_value')::numeric,
      (perf->>'capital_contributed')::numeric,
      case when pending then null else (perf->>'cumulative_return_pct')::numeric end,
      portfolio_row.base_currency, pending
    )
    on conflict (portfolio_id, as_of_date) do update
      set nav_value = excluded.nav_value,
          capital_contributed = excluded.capital_contributed,
          cumulative_return_pct = excluded.cumulative_return_pct,
          currency = excluded.currency,
          return_is_pending = excluded.return_is_pending;
  end loop;

  if array_length(seen_codes, 1) <> 2
     or not ('US' = any(seen_codes) and 'EU' = any(seen_codes)) then
    raise exception 'performance_rows must contain distinct US and EU snapshots';
  end if;

  insert into public.portfolio_sync_runs (
    id, finished_at, applied, reason, problems,
    provider_call_units, provider_symbols_requested, quota_limit, quota_projected
  ) values (
    run_id, now(), true, 'ok', '[]'::jsonb,
    coalesce((payload#>>'{quota,provider_call_units}')::int, 0),
    coalesce((payload#>>'{quota,provider_symbols_requested}')::int, 0),
    nullif(payload#>>'{quota,quota_limit}', '')::int,
    nullif(payload#>>'{quota,quota_projected}', '')::int
  );

  return jsonb_build_object(
    'applied', true,
    'reason', 'ok',
    'run_id', run_id,
    'positions_updated', updated_count
  );
end;
$$;

revoke all on function public.apply_portfolio_price_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.apply_portfolio_price_snapshot(jsonb) to service_role;

commit;
