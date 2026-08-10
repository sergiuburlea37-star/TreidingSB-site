# Website Integration

This project includes a website ingestion contract for TSB trading ideas.

## Contract

The public JSON contract is stored at `contract/trading-idea.v1.schema.json` and matches the required payload fields:

- schema_version
- event_id
- context_id
- created_at
- symbol
- direction
- entry
- stop_loss
- take_profit
- risk_reward
- confidence
- execution_status
- fundamental_status
- risk_status
- guardrails_status
- ai_status
- ai_verdict
- ai_strength
- ai_summary
- outcome
- closed_at

## Ingestion helpers

The runtime helpers in `lib/` validate the payload, verify the HMAC signature, and compute a canonical SHA-256 fingerprint used for idempotent persistence.

## Database

The new migration `supabase/migrations/202608100001_add_payload_sha256.sql` adds the nullable `payload_sha256` column and a unique partial index for non-null values.

## Important

- No live deployment is performed in this repo.
- No Supabase `db push` is run from CI or local development in this workflow.
- The website integration uses an HMAC secret and canonical payload fingerprint to preserve integrity without exposing secrets.
