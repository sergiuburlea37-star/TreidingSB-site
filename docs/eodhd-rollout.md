# EODHD Live Delayed — rollout și preflight

Cronul este intenționat comentat/dormant. Nu aplica migrațiile, seed-ul, Vault sau cronul direct în producție.

## Contract operațional

- `EODHD_API_TOKEN`, `PORTFOLIO_CRON_SECRET` și `EODHD_DAILY_CALL_LIMIT` sunt obligatorii și server-side.
- `EODHD_DAILY_CALL_LIMIT` trebuie să fie limita zilnică reală a abonamentului, nu numărul de request-uri HTTP.
- Endpoint-ul deduplică simbolurile. Seed-ul curent are 20 poziții, dar 19 simboluri distincte (`AAPL.US` este comun US/EU), plus aproximativ 4 perechi FX: circa **23 unități EODHD/run**.
- Fereastra dormantă are 60 runs/zi luni-joi și 61 vineri (run weekly final la 22:30 UTC): aproximativ **1.380 unități/zi** luni-joi și **1.403 vineri**. Păstrați marjă peste aceste valori pentru retry-uri manuale; recomandarea minimă de rollout este 1.500 unități/zi confirmate contractual.
- Fiecare run persistă `provider_call_units`, `provider_symbols_requested`, `quota_limit` și `quota_projected`, inclusiv un `server_error` produs după fetch. La 80% răspunsul include `warning`; peste limită fetch-ul este oprit cu `quota_exhausted`. Fără limită configurată rulează fail-closed cu `quota_unconfigured`.

## Preflight în proiect Supabase de test

1. Confirmați în abonamentul EODHD accesul Live Delayed la US, LSE, Xetra, Euronext, SIX, BME, Milano, Stockholm, Nasdaq Copenhagen (`.CO`) și Forex, plus limita de minimum 1.500 unități/zi.
2. Aplicați manual migrările `202608140001`–`202608140004`, apoi seed-ul de mapping. Nu aplicați `202608140005` încă.
3. Verificați că fiecare poziție activă are `provider_symbol` cu suffix din registry-ul de sesiuni, `provider_price_multiplier > 0`, `quantity` valid și moneda corectă (inclusiv DKK/SEK). Adminul și constraint-ul DB resping suffix-uri fără session policy; `.CO` folosește 17:00 `Europe/Copenhagen` (CET/CEST).
4. După seed, validați explicit constrângerile rămase `NOT VALID`:
   - `portfolio_positions_active_provider_mapping_check`
   - `fx_rates_positive_finite_check`
   - `portfolio_positions_positive_finite_current_price_check`
   - `portfolio_positions_quantity_domain_check`, `portfolio_positions_avg_price_domain_check`
   - toate constrângerile `portfolio_transactions_*_domain_check` și `portfolio_transactions_trade_fields_check`
   - `portfolio_dividends_amount_domain_check`
   - constrângerile `portfolio_performance_*_domain_check`
5. Rulați testele locale și testele DB cu credențialele proiectului de test. Verificați manual un run complet, un simbol invalid, FX istoric lipsă, două runs concurente și payloadurile RPC 0/1/duplicate.
6. Rulați manual vineri după 22:30 UTC și confirmați că snapshotul `weekly_final` conține close-ul oficial al burselor EU, US și FX. Timestampul de piață trebuie să fie în ultimele 20 minute înainte de close; delay-ul de livrare nu lărgește această fereastră. Înainte de 22:30, datele EU mai vechi de o oră trebuie să rămână `partial`. Early-close și holiday rămân fail-closed până la introducerea unui calendar explicit.
7. Verificați că în DB `price_source` și `fx_rates.source` sunt `delayed_feed`, că există exact două rânduri de performanță US/EU și că punctele pending au `cumulative_return_pct = NULL` și `return_is_pending = true`.
8. Abia după aprobarea cifrelor repetați pașii într-un Deploy Preview și apoi în producție. Activarea celor două `cron.schedule` comentate necesită aprobare separată.

## Monitorizare și rollback

- Alertați pe `partial`, `fetch_failed`, `quota_unconfigured`, `quota_exhausted`, `state_changed`, lease rămas până la TTL și lipsa unui `weekly_final` vineri.
- Alertați și pe `server_error`/audit insert failure. `locked` este auditat, dar nu aprinde bannerul de membru deoarece runul care deține lease-ul va publica propriul rezultat.
- Lease-ul expiră automat în 180 secunde și este eliberat explicit în `finally`; nu ștergeți manual lease-ul decât după confirmarea că nu există un run activ.
- RPC-ul compară sub SHARE table locks + row locks `evaluation_basis` (portofolii, starea completă relevantă a pozițiilor, tranzacții, dividende și toate cursurile FX istorice) cu starea DB. Table locks previn și insert/delete phantoms. Orice PATCH admin sau schimbare FX comisă după read respinge întreg snapshotul cu `state_changed`; orice write început după lock așteaptă commit-ul. La timestamp de provider egal, RPC-ul rescrie determinist `current_price` cu prețul folosit în NAV.
- Testele Supabase care scriu necesită explicit `ALLOW_SUPABASE_WRITE_TESTS=1` și, pentru snapshot, `TEST_SNAPSHOT_AS_OF_DATE`; folosiți numai un proiect de test dispensabil.
- Pentru oprire, păstrați cronul nesetat sau folosiți comenzile `cron.unschedule` comentate în migrarea dormantă. Nu este necesar rollback de date pentru a opri fetch-urile.
