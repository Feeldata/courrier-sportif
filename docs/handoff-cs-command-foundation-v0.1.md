# Handoff — CS CODEX FOUNDATION V0.1

Status: implemented on `codex/foundation/v0.1`, not merged into `main`.

## Structure created

- Next.js App Router TypeScript web application with a mobile-first shell.
- Minimal PWA manifest and production-only service-worker registration.
- Shared environment parsing under `src/lib/env/`.
- Typed Supabase browser/server clients under `src/lib/supabase/`.
- Exact generated DATA V0.1 TypeScript contract committed as `database.types.ts`.
- Explicit `src/modules/app`, `src/modules/ingest`, and `src/modules/match` boundaries.
- ESLint, Prettier, TypeScript, Vitest and GitHub Actions configuration.
- Branch and pull-request conventions for parallel Codex tasks.
- No Supabase migration or schema-changing artifact in this foundation branch.

## Technical choices

- Next.js App Router + React + TypeScript for the mobile-first/PWA web surface.
- `@supabase/ssr` + `@supabase/supabase-js` with publishable-key configuration only.
- Environment values supplied at runtime; `.env.example` contains placeholders only.
- Direct dependency versions are pinned in `package.json`.
- Database-generated types are committed and regenerated only after an approved DATA change.
- Domain modules do not import each other directly in V0.1; shared primitives live under `src/lib`.

## Verification completed

Passed locally:

- foundation structure check;
- secret-hygiene check;
- module-boundary check;
- JavaScript syntax checks for repository scripts/service worker;
- generated DATA V0.1 TypeScript file parses successfully;
- positive and negative runtime checks for environment parsing;
- generated database type snapshot verified byte-for-byte in logical content against the current production schema generation output (41,947 characters; matching FNV-1a checksum);
- Git repository integrity check;
- release archive integrity check.

Not executed locally:

- dependency-backed ESLint / Prettier / full TypeScript project check / Vitest / Next.js build.

Reason: the execution environment could not reach the npm registry long enough to generate `package-lock.json` or install dependencies. CI is configured to use `npm ci` when a lockfile exists and temporarily falls back to `npm install --ignore-scripts` before that first lockfile is committed.

## Supabase observations — no changes made

Production DATA V0.1 currently has 23 public tables and one recorded foundation migration. All 23 public tables have RLS enabled.

Current advisors report:

- 23 tables with RLS enabled but no policies;
- 10 public functions with mutable `search_path`;
- 9 foreign keys without covering indexes;
- 41 currently unused indexes (expected to be interpreted cautiously on a new/low-traffic database).

These are DATA/security/performance follow-ups. CS CODEX did not modify policies, functions, indexes, tables, migrations, storage schema, or any other database object.

## Blockers / decisions required from CS COMMAND

1. GitHub: no Courrier Sportif repository is currently accessible through the connected GitHub account, and the available connector cannot create a repository. Create/connect the remote repository, then push this branch.
2. Lockfile: generate and commit `package-lock.json` from an environment with npm registry access; rerun the full quality gate afterward.
3. DATA: define/approve public read policies before APP features can read production data through the publishable-key client.
4. DATA: review the function `search_path` and missing-index advisor findings before deciding on any migration.
5. Environment topology: staging currently has no dedicated Supabase project in the connected account. Provision one only if CS COMMAND chooses separate staging infrastructure.

## Parallel work unlocked after foundation merge

- `codex/app/*`: public routes/components/read models against the approved schema and RLS contract.
- `codex/ingest/*`: ingestion orchestration and source adapters, server-only.
- `codex/match/*`: match lifecycle/domain implementation.
- `codex/foundation/*`: CI/deployment/PWA hardening that does not change domain behavior.
- DATA-related work remains separately gated by CS DATA + CS COMMAND.
