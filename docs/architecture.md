# Architecture V0.1

Courrier Sportif is a single Next.js TypeScript application organized around explicit domain modules so multiple Codex tasks can evolve independently without creating separate runtimes too early.

- `src/app/`: Next.js routing, layouts and route composition only.
- `src/modules/app/`: public product domain and presentation/read-model logic.
- `src/modules/ingest/`: server-side ingestion orchestration; never import this module from client components.
- `src/modules/match/`: match lifecycle domain logic and match-specific use cases.
- `src/lib/supabase/`: generated database contract and shared Supabase clients.
- `src/lib/env/`: environment parsing and validation.

## Boundaries

APP, INGEST and MATCH must not import one another directly in V0.1. Shared primitives belong under `src/lib/` only when they are genuinely cross-domain. Cross-domain behavior should be integrated at route/server-action/orchestration boundaries, not by creating hidden module coupling.

## Database ownership

The Supabase schema remains owned by CS DATA / CS COMMAND. This repository may consume generated types and query the existing schema. No migration, DDL, policy change, trigger, function or storage schema change is permitted without explicit validation from CS DATA / CS COMMAND.
