import { describe, expect, it } from 'vitest'

import { normalizeIdentity } from './core'
import { MemoryAiRepository } from './memory-repository'
import { AiV01Service } from './pipeline'
import type { IdentityCandidate, SourceObservationRow, SourceRecordRow, SourceRow } from './types'

const SOURCE_ID = '10000000-0000-4000-8000-000000000001'
const RECORD_ID = '10000000-0000-4000-8000-000000000002'
const COMPETITION_ID = '10000000-0000-4000-8000-000000000003'
const NOW = '2026-09-22T10:00:00.000Z'

function source(reliabilityLevel = 5): SourceRow {
  return {
    source_id: SOURCE_ID,
    name: 'FECAFOOT — site officiel',
    source_type: 'official_federation',
    base_url: 'https://fecafoot-officiel.com',
    publisher: 'Fédération Camerounaise de Football',
    reliability_level: reliabilityLevel,
    status: 'active',
    created_at: NOW,
    updated_at: NOW,
  }
}

function sourceRecord(): SourceRecordRow {
  return {
    source_record_id: RECORD_ID,
    source_id: SOURCE_ID,
    record_type: 'webpage',
    url: 'https://fecafoot-officiel.com/actualite/example',
    external_ref: 'fixture:ai-v0.1',
    published_at: '2026-01-13T00:00:00.000Z',
    collected_at: NOW,
    content_hash: 'sha256:test',
    metadata: { title: 'MTN Elite One' },
    created_at: NOW,
  }
}

function observation(input: {
  id: string
  confidence: number | null
  fieldName?: string
  rawValue?: string
  normalizedValue?: string | null
  entityType?: string
  subjectKey?: string
  subjectEntityId?: string | null
}): SourceObservationRow {
  return {
    observation_id: input.id,
    source_record_id: RECORD_ID,
    subject_entity_id: input.subjectEntityId ?? null,
    subject_entity_type: input.entityType ?? 'competition',
    subject_key: input.subjectKey ?? 'competition:mtn-elite-one',
    field_name: input.fieldName ?? 'name',
    raw_value: input.rawValue ?? 'MTN Elite One',
    normalized_value:
      input.normalizedValue === undefined
        ? (input.rawValue ?? 'MTN Elite One')
        : input.normalizedValue,
    confidence: input.confidence,
    status: 'candidate',
    observed_at: NOW,
    created_at: NOW,
  }
}

function canonicalCandidate(entityId = COMPETITION_ID): IdentityCandidate {
  return {
    entityId,
    entityType: 'competition',
    displayName: 'MTN Elite One',
    normalizedIdentity: 'mtn elite one',
    matchKind: 'canonical',
    matchConfidence: 1,
  }
}

function seededRepository(observations: SourceObservationRow[] = []) {
  const repository = new MemoryAiRepository()
  repository.sources.set(SOURCE_ID, source())
  repository.sourceRecords.set(RECORD_ID, sourceRecord())
  for (const item of observations) repository.sourceObservations.set(item.observation_id, item)
  return repository
}

describe('AI V0.1 guardrails and assisted resolution', () => {
  it('refuses hallucination when no source_record exists and invents no facts for an empty source', async () => {
    const emptyRepository = new MemoryAiRepository()
    const service = new AiV01Service(emptyRepository)

    await expect(service.analyzeSourceRecord(RECORD_ID)).rejects.toMatchObject({
      code: 'AI_SOURCE_RECORD_NOT_FOUND',
    })

    const backedRepository = seededRepository()
    const backedService = new AiV01Service(backedRepository)
    const result = await backedService.analyzeSourceRecord(RECORD_ID, { apply: true })

    expect(result.extractedFacts).toEqual([])
    expect(result.decisions).toEqual([])
    expect(backedRepository.validationIssues.size).toBe(0)
  })

  it('normalizes identity deterministically and safely resolves a unique high-confidence entity', async () => {
    const nameObservation = observation({
      id: '20000000-0000-4000-8000-000000000001',
      confidence: 0.99,
      rawValue: 'MTN Élite-One',
      normalizedValue: 'MTN Elite One',
    })
    const countryObservation = observation({
      id: '20000000-0000-4000-8000-000000000002',
      confidence: 0.98,
      fieldName: 'country_code',
      rawValue: 'Cameroon',
      normalizedValue: 'CM',
    })
    const repository = seededRepository([nameObservation, countryObservation])
    repository.identityCandidates.set('competition:mtn elite one', [canonicalCandidate()])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(normalizeIdentity(' MTN Élite-One ')).toBe('mtn elite one')
    expect(result.decisions[0]).toMatchObject({
      decision: 'automatic',
      reasonCode: 'AI_SAFE_IDENTITY_RESOLUTION',
      canonicalEntityId: COMPETITION_ID,
      confidence: { overall: 0.99 },
    })
    expect(repository.sourceObservations.get(nameObservation.observation_id)).toMatchObject({
      subject_entity_id: COMPETITION_ID,
      status: 'accepted',
    })
    expect(repository.sourceObservations.get(countryObservation.observation_id)).toMatchObject({
      subject_entity_id: COMPETITION_ID,
      status: 'candidate',
    })
    expect(repository.validationIssues.size).toBe(0)
  })

  it('routes ambiguous identity resolution to blocking human review without canonizing', async () => {
    const item = observation({
      id: '20000000-0000-4000-8000-000000000010',
      confidence: 0.99,
    })
    const repository = seededRepository([item])
    repository.identityCandidates.set('competition:mtn elite one', [
      canonicalCandidate('30000000-0000-4000-8000-000000000001'),
      canonicalCandidate('30000000-0000-4000-8000-000000000002'),
    ])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(result.decisions[0]).toMatchObject({
      decision: 'review_required',
      reasonCode: 'AI_IDENTITY_AMBIGUOUS',
    })
    expect(repository.validationIssues.size).toBe(1)
    expect(repository.sourceObservations.get(item.observation_id)).toMatchObject({
      subject_entity_id: null,
      status: 'candidate',
    })
  })

  it('routes low confidence to human review and preserves the original observation confidence', async () => {
    const item = observation({
      id: '20000000-0000-4000-8000-000000000020',
      confidence: 0.65,
    })
    const repository = seededRepository([item])
    repository.identityCandidates.set('competition:mtn elite one', [canonicalCandidate()])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(result.decisions[0]).toMatchObject({
      decision: 'review_required',
      reasonCode: 'AI_LOW_CONFIDENCE',
      confidence: { observation: 0.65, overall: 0.65 },
    })
    expect(repository.sourceObservations.get(item.observation_id)).toMatchObject({
      confidence: 0.65,
      subject_entity_id: null,
      status: 'candidate',
    })
    expect(repository.validationIssues.size).toBe(1)
  })

  it('keeps a medium-confidence unique resolution as candidate pending human confirmation', async () => {
    const item = observation({
      id: '20000000-0000-4000-8000-000000000030',
      confidence: 0.9,
    })
    const repository = seededRepository([item])
    repository.identityCandidates.set('competition:mtn elite one', [canonicalCandidate()])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(result.decisions[0]).toMatchObject({
      decision: 'candidate',
      reasonCode: 'AI_IDENTITY_CANDIDATE_REVIEW',
      confidence: { overall: 0.9 },
    })
    expect(repository.sourceObservations.get(item.observation_id)).toMatchObject({
      subject_entity_id: null,
      status: 'candidate',
    })
    const issue = [...repository.validationIssues.values()][0]
    expect(issue).toMatchObject({
      rule_code: 'AI_IDENTITY_CANDIDATE_REVIEW',
      details: {
        observation_ids: [item.observation_id],
        action: 'human_review_required',
      },
    })
  })

  it('does not invent identity evidence from a date-only season observation', async () => {
    const item = observation({
      id: '20000000-0000-4000-8000-000000000040',
      confidence: 0.99,
      entityType: 'season',
      subjectKey: 'season:mtn-elite-one:unresolved:2026-01-24',
      fieldName: 'start_date',
      rawValue: '24 janvier 2026',
      normalizedValue: '2026-01-24',
    })
    const repository = seededRepository([item])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(result.decisions[0]).toMatchObject({
      decision: 'review_required',
      reasonCode: 'AI_IDENTITY_EVIDENCE_MISSING',
      identityValue: null,
      canonicalEntityId: null,
    })
    expect(repository.sourceObservations.get(item.observation_id)).toMatchObject({
      subject_entity_id: null,
      status: 'candidate',
    })
  })

  it('routes a linked-entity versus source-identity conflict to review without rewriting the link', async () => {
    const entityA = '30000000-0000-4000-8000-000000000010'
    const entityB = '30000000-0000-4000-8000-000000000011'
    const item = observation({
      id: '20000000-0000-4000-8000-000000000050',
      confidence: 0.99,
      rawValue: 'MTN Elite One',
      normalizedValue: 'MTN Elite One',
      subjectEntityId: entityA,
    })
    const repository = seededRepository([item])
    repository.identityCandidates.set('competition:mtn elite one', [canonicalCandidate(entityB)])

    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID, {
      apply: true,
      now: NOW,
    })

    expect(result.decisions[0]).toMatchObject({
      decision: 'review_required',
      reasonCode: 'AI_IDENTITY_LINK_IDENTITY_CONFLICT',
      linkedEntityIds: [entityA],
      candidates: [{ entityId: entityB }],
      canonicalEntityId: null,
    })
    expect(repository.sourceObservations.get(item.observation_id)).toMatchObject({
      subject_entity_id: entityA,
      status: 'candidate',
    })

    const issue = [...repository.validationIssues.values()][0]
    expect(issue).toMatchObject({
      rule_code: 'AI_IDENTITY_LINK_IDENTITY_CONFLICT',
      details: {
        observation_ids: [item.observation_id],
        identity_observation_ids: [item.observation_id],
        linked_entity_ids: [entityA],
        candidate_entity_ids: [entityB],
      },
    })
  })

  it('defaults to apply false and does not mutate observations or validation issues', async () => {
    const item = observation({
      id: '20000000-0000-4000-8000-000000000060',
      confidence: 0.99,
    })
    const repository = seededRepository([item])
    repository.identityCandidates.set('competition:mtn elite one', [canonicalCandidate()])

    const beforeObservation = structuredClone(
      repository.sourceObservations.get(item.observation_id),
    )
    const result = await new AiV01Service(repository).analyzeSourceRecord(RECORD_ID)

    expect(result.apply).toBe(false)
    expect(result.decisions[0]).toMatchObject({
      decision: 'automatic',
      reasonCode: 'AI_SAFE_IDENTITY_RESOLUTION',
      canonicalEntityId: COMPETITION_ID,
    })
    expect(repository.sourceObservations.get(item.observation_id)).toEqual(beforeObservation)
    expect(repository.validationIssues.size).toBe(0)
  })
})
