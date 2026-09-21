# CS CODEX → CS COMMAND — INGEST V0.1

## Scope implemented

Only CS INGEST V0.1 was implemented. No APP UI, MATCH live system, AI automation expansion, DDL or migration was added.

Primary source: FECAFOOT official website.

Implemented flow:

`source → source_record → source_observation → normalization → identity resolution → canonical candidate → confidence/review gate → canonical data`

## Code delivered

- FECAFOOT HTML fetch/parser with domain and content-type guardrails.
- Deterministic SHA-256 content fingerprints and stable UUID-shaped IDs.
- Idempotent source, source-record, observation, canonical-entity and review identities.
- Observation confidence values plus an automatic acceptance threshold.
- Exact normalized identity matching only; multiple matches are blocking review cases.
- Human-review routing through the existing `validation_issues` table.
- Structured phase/error logging for fetch, parsing/extraction, resolution and writes.
- Zero-write dry-run mode.
- Server-only Supabase credential configuration (`SUPABASE_SECRET_KEY` placeholder only).
- Supabase repository using DATA V0.1 only.
- Real FECAFOOT factual fixture and critical-path tests.

## Real Supabase proof

Verified FECAFOOT source URL:
`https://fecafoot-officiel.com/actualite/32843/2026/01/13/`

The real-source verification created/confirmed:

- source: `318e1543-d504-5c8f-8231-f7f864eb685e`
- source record: `81d4d00a-588b-5aaa-867c-336df48ee297`
- canonical competition: `c92a7b55-4d4c-5c68-be3f-b333dbadd405` (`MTN Elite One`)
- five observations: four `accepted`, one season start-date observation still `candidate`
- review item: `ef852022-8cd3-54df-8ed0-d6727f840b2e` with rule `INGEST_SEASON_IDENTITY_UNRESOLVED`

The 24 January 2026 start date is deliberately not attached to a canonical season because the tested source excerpt does not identify the canonical season label precisely enough. It remains in human review rather than being guessed.

## Idempotency proof

The same verified source payload was applied twice. Counts after the second application remained:

- `sources`: 1
- `source_records`: 1
- `source_observations`: 5
- canonical `competitions`: 1
- matching `validation_issues`: 1

Content changes generate a different source-record ID because the content hash participates in the deterministic source-record identity.

## Tests executed

Passed locally without third-party packages:

- foundation structure
- secret hygiene
- module-boundary checks
- TypeScript syntax checks with Node type stripping
- strict type-check of INGEST source/core/repository contracts using temporary external-module stubs
- 9 Node critical-path tests covering normalization, deterministic IDs, real FECAFOOT sample extraction, HTML parsing, parse failure, canonical write behavior, idempotency, dry-run and ambiguous identity review
- `git diff --check`

Full npm-based lint/Prettier/Next build/Vitest could not run because `npm install` timed out in the execution environment. No partial lockfile or dependency state was committed.

## Supabase schema state

No schema change was made. Migration history is unchanged and still contains only:

`20260919205019_cs_data_v0_1_foundation`

No schema modification is required to operate this V0.1 pipeline. A dedicated ingest-run/error-log table could be proposed later for durable operational telemetry, but it is not blocking and was not added.

## Operational limitation

The live TypeScript CLI requires a server-only Supabase secret key. That secret is intentionally not obtainable from or committed to this repository. The data-path proof against production Supabase was executed through the authorized Supabase admin connector using the same deterministic IDs and row model produced by the code.
