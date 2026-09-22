# MATCH V0.1

MATCH V0.1 implements the validated match lifecycle on top of DATA V0.1 without any schema change.

## Lifecycle

The domain service covers:

`fixture → status → match sheet → lineups → ordered events → observed score → finished → official validation`

Canonical status transitions are intentionally explicit:

- `scheduled → delayed | postponed | live | cancelled`
- `delayed → scheduled | postponed | live | cancelled`
- `postponed → scheduled | cancelled`
- `live → halftime | suspended | finished | abandoned`
- `halftime → live | suspended | abandoned`
- `suspended → live | postponed | abandoned`
- `finished`, `abandoned`, and `cancelled` are terminal in V0.1.

A repeated transition to the current status is treated as an idempotent no-op.

## DATA V0.1 mapping

- fixture/status/match sheet → `entities` + `matches`
- compositions → `match_players`
- event stream → `match_events`
- observed score snapshots → `match_results.score_90_*`, `score_et_*`, `penalties_*`
- official result → `match_results.official_score_*`, `decision_type`, `winner_team_id`
- INGEST provenance → existing `source_observations`, accepted and linked to the match entity
- unresolved official contradictions → `validation_issues`

No table, constraint, migration, trigger, policy or function is created by MATCH V0.1.

## Score semantics

MATCH V0.1 never treats a missing event feed as `0-0`.

A score is derived from match events only when the caller explicitly marks the event feed as complete. Otherwise the match may be marked `finished` with no known score, or an explicit observed score can be supplied from a source. Official score fields remain null until the explicit official-validation step.

For a complete event feed, `goal`, `own_goal`, and `penalty_goal` are scoring events. `1H`/`2H` feed the 90-minute score, `ET1`/`ET2` feed the extra-time score, and `PEN` `penalty_goal` events feed the shootout score. A scoring event without a beneficiary team is rejected instead of guessed.

## Provenance

MATCH accepts optional INGEST observation IDs. Before accepting them it verifies that every observation exists, targets entity type `match`, is not rejected, and is not already attached to a different match. Accepted observations keep their original `source_record_id` and are linked to the canonical match.

Event metadata also records the observation IDs used for that event when provenance is supplied.

## Official validation

For normal regulation/extra-time/penalty decisions, the proposed official score is checked against the observed result. A contradiction creates an idempotent blocking `validation_issues` row and leaves the official score untouched for human review.

Administrative outcomes (`walkover`, `forfeit`, `administrative`) are allowed to differ from the observed score because DATA V0.1 explicitly models these decision types.

## Cameroonian verification fixture

The critical test uses a realistic MTN Elite One scenario with Canon Sportif de Yaoundé and Coton Sport de Garoua, lineups, ordered first/second-half events, a derived 2–1 observed score, then an explicit 2–1 regulation official validation. It is a deterministic test scenario and is not presented as a historical official result.

The production DATA V0.1 database currently contains the MTN Elite One competition but no season, team, player or match rows sufficient to run a non-destructive live integration fixture. MATCH therefore verifies write semantics through the repository contract and in-memory critical-path tests without seeding fake production data.
