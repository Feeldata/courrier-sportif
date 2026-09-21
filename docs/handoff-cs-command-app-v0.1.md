# CS CODEX → CS COMMAND — APP MVP V0.1

## Implemented screens

- Accueil
- Compétitions
- Competition detail
- Match detail
- Club detail
- Player detail
- Recherche

The extra competition-detail route is the navigation target for competition cards and hosts the reusable competition header, standings and season/match sections specified by CS APP.

## Real production data observed during implementation

At verification time the production catalogue contains:

- competitions: 1
- seasons: 0
- clubs: 0
- teams: 0
- players: 0
- matches: 0
- match results: 0
- match events: 0

The real competition is `MTN Elite One` (`c92a7b55-4d4c-5c68-be3f-b333dbadd405`). The search equivalent for `Elite` returns that same row. Consequently the home and competition catalogue have real content; season, match, club and player sections correctly present empty/no-data states until INGEST expands the catalogue.

## Supabase connection

APP uses generated DATA V0.1 TypeScript types and server-side Supabase queries only. There are currently zero policies in `pg_policies` for the public schema, so a publishable-key client cannot read public data while RLS is enabled.

No policy/schema change was made. To make the MVP usable immediately, server-rendered reads use the existing `SUPABASE_SECRET_KEY` through the server-only admin client. This key is never sent to the browser and is never committed. CS DATA should later approve public SELECT policies if direct publishable-key reads/caching are desired.

## Product states

Implemented: loading, empty collection, section-level no-data, missing entity and Supabase error/retry states. No fake catalogue data is used.

## Tests/checks executed

- APP route/component verifier: passed.
- Foundation verifier: passed.
- Module-boundary verifier: passed.
- Secret-hygiene verifier: passed.
- Strict TypeScript parse/type pass of APP routes/components/read models using temporary external-library stubs: passed.
- Executable read-model assertions: 6/6 passed.
- Executable component smoke assertions: 7/7 passed.
- Real Supabase read-path verification: `MTN Elite One` returned by canonical ID and by `ILIKE '%Elite%'` query.

Vitest component/read-model suites are committed in the repository. Full `npm install`, ESLint, Prettier, real dependency typecheck, Next build and Vitest execution could not run because npm registry access timed out in this environment. No partial dependency tree or fabricated lockfile was committed.

## Database/schema verification

No table, migration, function, RLS policy or other schema object was changed. Migration history remains only `20260919205019_cs_data_v0_1_foundation`.

## Dependencies / next DATA-MATCH inputs

- DATA: public SELECT policies are still needed before APP can safely move public reads from the server-only secret facade to the publishable browser/server client.
- INGEST/DATA: more canonical seasons, clubs, teams, players and fixtures will naturally populate existing UI states.
- MATCH: live orchestration is not implemented. The current Match screen only renders canonical `matches`, `match_results`, `match_players` and `match_events` that already exist in DATA V0.1.
