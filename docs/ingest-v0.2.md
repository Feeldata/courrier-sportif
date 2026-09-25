# INGEST V0.2 — Football catalogue and fixtures (staging scope)

The FECAFOOT regulation published on 17 September 2026 anchors Gate A for MTN Elite One 2026-2027. The existing competition ID is `c92a7b55-4d4c-5c68-be3f-b333dbadd405`; ingestion refuses to create another competition. The season ID is deterministic from that ID and the exact `2026-2027` label. Its dates remain unset because the regulation is not a fixture calendar.

Official evidence: [2026-2027 regulation](https://fecafoot-officiel.com/actualite/voici-le-reglement-du-championnat-professionnel-mtn-elite-one-2026-2027/2026/09/17/), [2025-2026 calendar](https://fecafoot-officiel.com/wp-content/uploads/2026/01/CALENDRIER-ELITE-ONE-SAISON-25-26_.pdf), and [2025-2026 matchday 1 program](https://fecafoot-officiel.com/wp-content/uploads/2026/01/1ERER-JOUNEEOFFICIELS_071448.pdf). The committed JSON fixtures contain short, frozen, verified text extracts from these documents, not complete PDFs. Program and calendar extraction are qualified locally against those extracts. A synthetic reprogramming case tests precedence without claiming an unpublished FECAFOOT notice.

## Gates

1. Gate A accepts only an official season regulation and an existing canonical competition.
2. Gate B requires an official FECAFOOT participant publication. Each unknown club and team produces a blocking `validation_issues` row. A human must resolve each issue with `status=resolved`, non-null `resolved_at`, and `details.approved_entity_id`, `details.create_new`, and `details.reviewed_by`. Only then may the next run create or link the identity and its season entry. Exact normalized names, approved aliases, and FECAFOOT external IDs are the only automatic matches; conflicting matches block.
3. Gate C requires an official FECAFOOT calendar, an existing season, and both teams entered for that season. Gates B/C for 2026-2027 are explicitly closed in this release; a later source-verified change must open them after publication. No 2026-2027 participants or fixtures are supplied or created here.
4. Matchday programs outrank general calendars; reprogramming outranks both. Same-rank conflicting dates block for review. Match identity uses season, matchday, and ordered teams, independent of date, time, and venue. A logical lookup catches non-deterministic existing IDs and collisions.

Source records, observations, review issues, and canonical rows use stable IDs. Before any write, the adapter compares the stored hash for the same FECAFOOT URL and refuses changed content. DATA V0.1 cannot retain two hashes for one URL. Accepted observations retain a path to their source record and FECAFOOT source. An unknown venue is retained as a text observation while `matches.venue_id` stays null.

The connected adapter refuses any environment other than the authorized staging project. It does not create or modify players, staff, statistics, transfers, schema, migrations, or RLS. Frozen excerpts are dry-run only through the CLI. Full-PDF acquisition and text extraction are not supplied by this release; an operator must verify the source text before using a new document.

## Run Gate A

```bash
npm run ingest:fecafoot:v02 -- --fixture src/modules/ingest/fixtures/fecafoot-elite-one-regulation-2026-2027.json
npm run ingest:fecafoot:v02 -- --url https://fecafoot-officiel.com/actualite/voici-le-reglement-du-championnat-professionnel-mtn-elite-one-2026-2027/2026/09/17/ --apply-staging
```

The connected command requires staging-only environment variables and a staging secret in the process environment. It prints IDs and evidence counts, never credentials.

## Connected staging Gate A smoke

On a same-repository pull request from `codex/ingest/v0.2`, the existing GitHub Actions staging workflow selects `npm run smoke:staging:v02`. It uses the repository's staging credentials and rejects any non-staging project before constructing the Supabase adapter. The V0.1 branch still runs its original smoke unchanged. The workflow checks the captured smoke output for the secret value before printing it.

The V0.2 smoke applies the frozen official regulation extract twice. It verifies the existing competition is unchanged, exactly one `2026-2027` season uses deterministic ID `09301529-4080-5537-9311-31edb9d3a8dd`, and the same source record and two accepted observations point back to the FECAFOOT source. Global row counts for clubs, teams, season entries, matches, players, memberships, statistics, match events, match players, and results must stay unchanged. No transfer table or write path is used.

This smoke intentionally **retains** the canonical Gate A season and its provenance in staging; they are not synthetic test rows. Expected final state: one season/entity for that ID, one source record for the regulation URL, and two accepted observations linked to the season; the FECAFOOT source row may already exist. Subsequent runs must reuse those IDs without adding rows. No 2026-2027 participant or fixture is created.
