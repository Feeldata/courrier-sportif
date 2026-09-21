# CS INGEST V0.1 — FECAFOOT pipeline

Primary source: the official FECAFOOT website (`https://fecafoot-officiel.com`). V0.1 handles official HTML article pages and stores provenance before any canonical write.

## Flow

`source → source_record → source_observation → normalization → identity resolution → canonical candidate → confidence/review gate → canonical data`

- `sources`: deterministic FECAFOOT source identity, reliability level 5.
- `source_records`: deterministic content-version identity from source URL + SHA-256 content fingerprint. The same unchanged page reruns into the same row; changed content creates a new source record.
- `source_observations`: deterministic per source-record/subject/field identity. Raw value, normalized value and confidence are retained.
- identity resolution: exact normalized matching only in V0.1. No fuzzy match is silently accepted.
- canonical candidate: built in memory from accepted observations. New deterministic IDs remove duplicate creation races.
- validation: candidates at or above the V0.1 automatic threshold (`0.95`) may be written when required facts are present. Ambiguous or incomplete identities create `validation_issues` instead.
- canonical write: V0.1 currently writes the supported competition candidate into `entities` + `competitions`. It does not invent a season identity from a date alone.

## Error handling

Pipeline events are structured JSON records with stages `fetch`, `source_record`, `extract`, `normalize`, `resolve`, `validate`, and `write`. Reviewable extraction/resolution problems are persisted through `validation_issues` when the existing DATA V0.1 schema can represent them. Database write failures remain in structured runtime logs because no dedicated ingest-run/error-log table exists in DATA V0.1.

## Dry run

```bash
npm run ingest:fecafoot:dry-run
```

The dry run builds the same source record, observations, candidate and review decisions but performs zero writes.

For a live page after dependencies and environment variables are configured:

```bash
npm run ingest:fecafoot -- --url https://fecafoot-officiel.com/actualite/32843/2026/01/13/
```

Live ingest requires `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY`. A publishable/anon key is deliberately not used for trusted ingestion.

## Real-source fixture

`src/modules/ingest/fixtures/fecafoot-elite-one-launch-2026.json` records a minimal factual extract from FECAFOOT's 13 January 2026 Elite One season announcement. It is intentionally small: enough to prove parser behavior without storing a copy of the full article.

The sample creates a high-confidence canonical candidate for `MTN Elite One` and deliberately sends the extracted 24 January 2026 start date to review because the source excerpt does not identify the canonical season label precisely enough.

## Schema boundary

INGEST V0.1 makes no DDL changes. It uses only existing DATA V0.1 tables. A future schema request may be justified for transactional ingest-run/error logging or explicit review-queue linking, but that is not part of this implementation.
