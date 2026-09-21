# APP MVP V0.1

## Scope

APP V0.1 is the public, mobile-first presentation layer for the existing DATA V0.1 schema. It does not add database schema, live-match orchestration, editorial AI, authentication, or admin tooling.

## Routes

- `/` — Accueil: real catalogue counts, validated competitions, available matches.
- `/competitions` — competition catalogue.
- `/competitions/[id]` — competition header, seasons, standings derived from validated results, matches, entered teams.
- `/match/[id]` — match score/status, venue, timeline and lineups when present.
- `/club/[id]` — club identity, teams and linked players when present.
- `/joueur/[id]` — player identity and validated team/club memberships.
- `/recherche?q=...` — server-side search over validated competitions, clubs and players.

Entity detail routes return a product-level missing-data state for unknown IDs rather than inventing content.

## Data access

All reads use the generated DATA V0.1 types in `src/lib/supabase/database.types.ts`.

The production DATA V0.1 tables currently have RLS enabled but zero public SELECT policies. Supabase therefore returns no rows through the publishable/anonymous API. APP V0.1 deliberately does not change RLS because schema/policy ownership belongs to CS DATA / CS COMMAND.

Until public read policies are approved, `src/modules/app/data/repository.ts` uses the existing server-only Supabase secret client. The secret never enters a Client Component or `NEXT_PUBLIC_*` variable. This is a temporary server rendering boundary, not a browser data-access pattern. Once DATA approves public SELECT policies, the repository implementation can switch clients without rewriting screens or presentation components.

## Empty-database behavior

The UI treats sparse data as a first-class product state:

- `loading`: root route transition skeleton.
- `empty`: a collection exists but has zero rows, e.g. no matches.
- `no-data`: an optional section or field is absent, e.g. no timeline or season.
- `error`: Supabase/query failure boundary with retry.

No placeholder clubs, players, fixtures, scores, rankings or match events are generated.

## Reusable components

- `MatchCard`
- `CompetitionCard`
- `ClubCard`
- `PlayerCard`
- `CompetitionHeader`
- `StandingsTable`
- `MatchTimeline`
- `SearchResult`
- shared `LoadingState`, `EmptyState`, `NoDataState`
- mobile `AppShell` + bottom navigation

`StandingsTable` is computed only from `team_season_entries`, canonical matches and available `match_results`; absent scores do not count as played matches.

## Architecture

Routes compose read models from `src/modules/app/`. APP does not import INGEST or MATCH. MATCH live can later feed the existing DATA tables/read models without changing page contracts, and AI can remain an upstream validation/content process.
