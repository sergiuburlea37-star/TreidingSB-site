alter table public.trading_ideas
  add column if not exists payload_sha256 text;

comment on column public.trading_ideas.payload_sha256 is 'Canonical SHA-256 of the event payload for idempotent upsert checks.';
