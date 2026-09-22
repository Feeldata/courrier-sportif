# AI V0.1

AI V0.1 is a source-backed assisted-validation layer over DATA V0.1 and INGEST V0.1. It does not create a new database schema, a new sports entity, or synthetic sports facts.

## Pipeline

`source_record + source_observations → extraction → normalization → identity resolution → confidence → ambiguity detection → assisted validation → human review`

### Extraction

V0.1 only extracts facts from existing `source_observations` attached to the requested `source_record`. A missing source record stops the run. A source record with zero observations yields zero facts. Rejected observations are never reused as AI evidence.

DATA V0.1 does not retain arbitrary page bodies, so AI V0.1 does not attempt free-text hallucination from unavailable content. Any future model-based extractor must first produce source-backed observations through the INGEST boundary.

### Normalization

Identity strings are normalized deterministically for matching: whitespace, Unicode accents, apostrophes, case and punctuation are normalized. Existing `normalized_value` remains the primary evidence when present.

### Identity resolution

V0.1 resolves only against existing canonical entities and `entity_aliases`. It does not create a new entity.

Supported canonical name surfaces:

- competitions: `name`, `short_name`
- clubs: `official_name`, `short_name`
- teams: `name`
- players: `display_name`, first + last name
- seasons: `name`
- venues: `name`
- matches: no name-based auto-resolution in V0.1

Matching is exact after normalization. No fuzzy match is silently accepted.

### Confidence

Overall confidence is the minimum of:

1. source observation confidence;
2. source reliability;
3. identity match confidence.

Source reliability mapping is deliberately conservative:

- 5 → 1.00
- 4 → 0.90
- 3 → 0.75
- 2 → 0.55
- 1 → 0.35
- unknown → 0.50
- blocked source → rejected before processing

Canonical exact matches score 1.00; exact aliases score 0.98.

### Decisions

- **automatic**: unique existing entity and overall confidence ≥ 0.95. AI links all observations in the subject group to the entity, but only identity observations are marked `accepted`. Other factual observations keep their existing status.
- **candidate**: unique existing entity and confidence ≥ 0.80 but < 0.95. Nothing is canonized; a `validation_issue` is created.
- **review_required**: ambiguity, missing identity evidence, unresolved identity, conflicting identity evidence, conflicting existing links, or confidence < 0.80. Nothing is canonized; a `validation_issue` is created.
- **already_resolved**: observations already point to one canonical entity. AI does not rewrite them.

### Human review

Review issues use DATA V0.1 `validation_issues` and preserve:

- source record ID;
- subject key and entity type;
- all observation IDs;
- identity observation IDs;
- normalized identity;
- candidate entity IDs;
- confidence breakdown.

## Safety invariants

- No source record → no output.
- No source observations → no facts.
- No exact existing entity/alias → no automatic canonization.
- Multiple candidate entities → blocking review.
- Low confidence → human review.
- Rejected observations are ignored as evidence.
- Automatic identity resolution never upgrades unrelated factual observations to accepted.
- Dry-run is the default; writes require `{ apply: true }`.
- AI does not import APP, INGEST or MATCH internals.

## Supabase

The server adapter uses the existing DATA V0.1 tables only. It can be instantiated server-side with the existing secret-key Supabase client. Secret keys remain backend-only and are never exposed to browser code.
