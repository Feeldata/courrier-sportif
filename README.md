# Courrier Sportif — V0.1 codebase

Mobile-first/PWA codebase for Courrier Sportif, connected to the production Supabase DATA V0.1 schema.

## Implemented scopes

- Foundation V0.1: Next.js App Router, TypeScript, Supabase clients/types, PWA shell, quality gates and module boundaries.
- INGEST V0.1: FECAFOOT source pipeline with provenance, confidence, idempotency, dry-run and human review routing.
- APP MVP V0.1: public home, competitions, match, club, player and search experiences with sparse-data states.

No MATCH-live system or additional AI automation is implemented here.

## Stack

- Next.js App Router + React + TypeScript
- Supabase via `@supabase/supabase-js` and `@supabase/ssr`
- Generated `public` schema types in `src/lib/supabase/database.types.ts`
- ESLint, Prettier and Vitest
- Web manifest + service-worker registration

## Local setup

1. Use Node 22 or newer.
2. Run `npm install`. Commit the generated `package-lock.json`; CI prefers `npm ci` whenever the lockfile is present.
3. Copy `.env.example` to `.env.local`.
4. Configure the Supabase URL, publishable key, project ref and server-only secret key in the runtime environment. Never put a secret key in a `NEXT_PUBLIC_*` variable.
5. Run `npm run dev`.

`SUPABASE_SECRET_KEY` is currently required for trusted INGEST writes and server-rendered APP reads because DATA V0.1 has RLS enabled with no public SELECT policies. See `docs/app-v0.1.md`.

## APP routes

- `/`
- `/competitions`
- `/competitions/[id]`
- `/match/[id]`
- `/club/[id]`
- `/joueur/[id]`
- `/recherche?q=...`

The UI never synthesizes missing catalogue data. Loading, empty, no-data and error states are implemented explicitly.

## Environments

`NEXT_PUBLIC_APP_ENV` accepts `local`, `staging`, or `production`. Credentials are supplied by each runtime/deployment environment and are never committed. Staging should use its own Supabase project/ref once CS COMMAND provisions one; production points to the existing Courrier Sportif project.

## Database types

Regenerate only after an approved DATA schema change:

```bash
SUPABASE_PROJECT_REF=<project-ref> npm run db:types
```

The generated file is committed so feature branches share the same database contract. Do not hand-edit it.

## Quality gates

```bash
npm run verify:foundation
npm run verify:app
npm run check:boundaries
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Focused suites:

```bash
npm run test:ingest:core
npm run test:app:core
```

Until the first connected environment generates `package-lock.json`, CI falls back to `npm install --ignore-scripts`; after the lockfile is committed it automatically uses `npm ci`.

## Branch convention

`main` is production-ready. Use one short-lived branch per validated CS COMMAND task:

- `codex/app/<task>`
- `codex/ingest/<task>`
- `codex/match/<task>`
- `codex/data/<task>` only after CS DATA + CS COMMAND approval
- `codex/foundation/<task>` for shared infrastructure

## Schema rule

No Supabase schema modification is authorized from APP or INGEST work. There are deliberately no application-authored migration files here. Any DDL/RLS/policy/function/storage schema change must return to CS DATA / CS COMMAND first.

## INGEST V0.1

The first ingestion adapter targets the official FECAFOOT website. It stores provenance before canonicalization, uses deterministic IDs for idempotency, routes unresolved identities to `validation_issues`, and supports a zero-write dry-run.

```bash
npm run ingest:fecafoot:dry-run
# live, after server credentials are configured:
npm run ingest:fecafoot -- --url https://fecafoot-officiel.com/actualite/32843/2026/01/13/
```

See `docs/ingest-v0.1.md` and `docs/app-v0.1.md` for operational details.
