import { readFile } from 'node:fs/promises'

import { describe, expect, it, vi } from 'vitest'

import { resolveDisplayedScore, toMatchSummary } from '@/modules/app/read-model'
import { AiV01Service } from '@/modules/ai/pipeline'
import { MemoryAiRepository } from '@/modules/ai/memory-repository'
import type {
  IdentityCandidate,
  SourceObservationRow as AiObservationRow,
  SourceRecordRow as AiSourceRecordRow,
  SourceRow as AiSourceRow,
} from '@/modules/ai/types'
import { FECAFOOT_SOURCE } from '@/modules/ingest/core'
import { JsonConsoleIngestLogger, CollectingIngestLogger } from '@/modules/ingest/logger'
import { MemoryIngestRepository } from '@/modules/ingest/memory-repository'
import { ingestFecafootDocument } from '@/modules/ingest/pipeline'
import type { FetchedSourceDocument, PipelineEvent } from '@/modules/ingest/types'
import { CAMEROON_REALISTIC_MATCH as matchFixture } from '@/modules/match/fixtures/cameroon-realistic'
import { MemoryMatchRepository } from '@/modules/match/memory-repository'
import { MatchService } from '@/modules/match/service'

const NOW = '2026-09-22T12:00:00.000Z'
const sourceFixtureUrl = new URL(
  '../modules/ingest/fixtures/fecafoot-elite-one-launch-2026.json',
  import.meta.url,
)

async function loadSourceFixture(): Promise<FetchedSourceDocument> {
  return JSON.parse(await readFile(sourceFixtureUrl, 'utf8')) as FetchedSourceDocument
}

function bridgeIngestIntoAi(ingest: MemoryIngestRepository) {
  const ai = new MemoryAiRepository()
  const source = ingest.sources.get(FECAFOOT_SOURCE.sourceId)
  if (!source) throw new Error('Expected INGEST source')

  ai.sources.set(source.sourceId, {
    source_id: source.sourceId,
    name: source.name,
    source_type: source.sourceType,
    base_url: source.baseUrl,
    publisher: source.publisher,
    reliability_level: source.reliabilityLevel,
    status: source.status,
    created_at: NOW,
    updated_at: NOW,
  } as AiSourceRow)

  for (const record of ingest.sourceRecords.values()) {
    ai.sourceRecords.set(record.sourceRecordId, {
      source_record_id: record.sourceRecordId,
      source_id: record.sourceId,
      record_type: record.recordType,
      url: record.url,
      external_ref: record.externalRef,
      published_at: record.publishedAt,
      collected_at: record.collectedAt,
      content_hash: record.contentHash,
      metadata: record.metadata,
      created_at: NOW,
    } as AiSourceRecordRow)
  }

  for (const observation of ingest.observations.values()) {
    ai.sourceObservations.set(observation.observationId, {
      observation_id: observation.observationId,
      source_record_id: observation.sourceRecordId,
      subject_entity_id: observation.subjectEntityId,
      subject_entity_type: observation.subjectEntityType,
      subject_key: observation.subjectKey,
      field_name: observation.fieldName,
      raw_value: observation.rawValue,
      normalized_value: observation.normalizedValue,
      confidence: observation.confidence,
      status: observation.status,
      observed_at: observation.observedAt,
      created_at: NOW,
    } as AiObservationRow)
  }

  const competition = [...ingest.competitions.values()][0]
  if (!competition) throw new Error('Expected canonical competition from INGEST')
  const candidate: IdentityCandidate = {
    entityId: competition.entityId,
    entityType: 'competition',
    displayName: competition.name,
    normalizedIdentity: 'mtn elite one',
    matchKind: 'canonical',
    matchConfidence: 1,
  }
  ai.identityCandidates.set('competition:mtn elite one', [candidate])

  return { ai, competition }
}

function seedMatchRepository() {
  const repository = new MemoryMatchRepository()
  repository.seasons.add(matchFixture.seasonId)
  repository.teams.add(matchFixture.homeTeamId)
  repository.teams.add(matchFixture.awayTeamId)
  repository.players.add(matchFixture.homePlayerOne)
  repository.players.add(matchFixture.awayPlayerOne)
  repository.venues.add(matchFixture.venueId)

  repository.sourceObservations.set(matchFixture.fixtureObservationId, {
    observation_id: matchFixture.fixtureObservationId,
    source_record_id: '10000000-0000-4000-8000-000000000020',
    subject_entity_id: null,
    subject_entity_type: 'match',
    subject_key: 'match:canon-coton:2026-10-04',
    field_name: 'fixture',
    raw_value: { home: 'Canon Sportif de Yaoundé', away: 'Coton Sport de Garoua' },
    normalized_value: null,
    confidence: 0.99,
    status: 'candidate',
    observed_at: NOW,
    created_at: NOW,
  })
  repository.sourceObservations.set(matchFixture.eventObservationId, {
    observation_id: matchFixture.eventObservationId,
    source_record_id: '10000000-0000-4000-8000-000000000021',
    subject_entity_id: null,
    subject_entity_type: 'match',
    subject_key: 'match:canon-coton:2026-10-04',
    field_name: 'event',
    raw_value: { event: 'goal' },
    normalized_value: null,
    confidence: 0.97,
    status: 'candidate',
    observed_at: NOW,
    created_at: NOW,
  })

  return repository
}

describe('V0.1 hardening integration', () => {
  it('keeps INGEST -> AI provenance and idempotence stable', async () => {
    const ingest = new MemoryIngestRepository()
    const document = await loadSourceFixture()
    const logger = new CollectingIngestLogger()

    const first = await ingestFecafootDocument(ingest, document, { now: NOW, logger })
    const second = await ingestFecafootDocument(ingest, document, { now: NOW, logger })

    expect(second.sourceRecordId).toBe(first.sourceRecordId)
    expect(second.observationIds).toEqual(first.observationIds)
    expect(ingest.sources.size).toBe(1)
    expect(ingest.sourceRecords.size).toBe(1)
    expect(ingest.observations.size).toBe(5)
    expect(ingest.competitions.size).toBe(1)
    expect(ingest.reviewIssues.size).toBe(1)

    const { ai, competition } = bridgeIngestIntoAi(ingest)
    const service = new AiV01Service(ai)

    const aiFirst = await service.analyzeSourceRecord(first.sourceRecordId, {
      apply: true,
      now: NOW,
    })
    const aiSecond = await service.analyzeSourceRecord(first.sourceRecordId, {
      apply: true,
      now: NOW,
    })

    const competitionDecision = aiSecond.decisions.find(
      (decision) => decision.entityType === 'competition',
    )
    const seasonDecision = aiSecond.decisions.find((decision) => decision.entityType === 'season')

    expect(competitionDecision).toMatchObject({
      decision: 'already_resolved',
      canonicalEntityId: competition.entityId,
    })
    expect(seasonDecision).toMatchObject({
      decision: 'review_required',
      reasonCode: 'AI_IDENTITY_EVIDENCE_MISSING',
    })
    expect(aiFirst.decisions.map((decision) => decision.reasonCode)).toEqual(
      aiSecond.decisions.map((decision) => decision.reasonCode),
    )
    expect(ai.validationIssues.size).toBe(1)
  })

  it('keeps MATCH writes idempotent and APP prefers the validated official score', async () => {
    const repository = seedMatchRepository()
    const service = new MatchService(repository)

    const fixtureInput = {
      matchId: matchFixture.matchId,
      seasonId: matchFixture.seasonId,
      homeTeamId: matchFixture.homeTeamId,
      awayTeamId: matchFixture.awayTeamId,
      scheduledDate: '2026-10-04',
      kickoffPrecision: 'unknown' as const,
      venueId: matchFixture.venueId,
      provenance: { observationIds: [matchFixture.fixtureObservationId] },
    }

    await service.createFixture(fixtureInput)
    await service.createFixture(fixtureInput)

    const lineup = {
      players: [
        {
          matchPlayerId: '20000000-0000-4000-8000-000000000001',
          playerId: matchFixture.homePlayerOne,
          teamId: matchFixture.homeTeamId,
          squadRole: 'starter' as const,
          shirtNumber: 9,
        },
        {
          matchPlayerId: '20000000-0000-4000-8000-000000000002',
          playerId: matchFixture.awayPlayerOne,
          teamId: matchFixture.awayTeamId,
          squadRole: 'starter' as const,
          shirtNumber: 10,
        },
      ],
    }
    await service.setLineup(matchFixture.matchId, lineup)
    await service.setLineup(matchFixture.matchId, lineup)

    await service.transitionStatus(matchFixture.matchId, 'live')
    await service.transitionStatus(matchFixture.matchId, 'live')

    const goal = {
      eventId: '20000000-0000-4000-8000-000000000010',
      eventType: 'goal' as const,
      period: '1H' as const,
      sequenceNumber: 1,
      minute: 31,
      teamId: matchFixture.homeTeamId,
      playerId: matchFixture.homePlayerOne,
      provenance: { observationIds: [matchFixture.eventObservationId] },
    }
    await service.recordEvent(matchFixture.matchId, goal)
    await service.recordEvent(matchFixture.matchId, goal)

    const observed = await service.finishMatch(matchFixture.matchId, {
      eventFeedComplete: true,
    })
    expect(observed).toMatchObject({ score90Home: 1, score90Away: 0 })

    const official = {
      officialScoreHome: 1,
      officialScoreAway: 0,
      decisionType: 'regulation' as const,
      winnerTeamId: matchFixture.homeTeamId,
    }
    await expect(service.validateOfficialResult(matchFixture.matchId, official)).resolves.toEqual({
      status: 'validated',
    })
    await expect(service.validateOfficialResult(matchFixture.matchId, official)).resolves.toEqual({
      status: 'validated',
    })

    expect(repository.matches.size).toBe(1)
    expect(repository.matchPlayers.size).toBe(2)
    expect(repository.matchEvents.size).toBe(1)
    expect(repository.matchResults.size).toBe(1)

    const match = repository.matches.get(matchFixture.matchId)
    const result = repository.matchResults.get(matchFixture.matchId)
    if (!match || !result) throw new Error('Expected MATCH canonical rows')

    const summary = toMatchSummary({
      match,
      homeTeam: {
        id: matchFixture.homeTeamId,
        name: 'Canon Sportif de Yaoundé',
        clubId: null,
      },
      awayTeam: {
        id: matchFixture.awayTeamId,
        name: 'Coton Sport de Garoua',
        clubId: null,
      },
      result,
      competitionName: 'MTN Elite One',
      seasonName: '2026',
    })

    expect(summary).toMatchObject({
      scoreHome: 1,
      scoreAway: 0,
      status: 'finished',
    })
    expect(resolveDisplayedScore(null)).toEqual({ home: null, away: null })
    expect(repository.sourceObservations.get(matchFixture.fixtureObservationId)).toMatchObject({
      status: 'accepted',
      subject_entity_id: matchFixture.matchId,
    })
    expect(repository.sourceObservations.get(matchFixture.eventObservationId)).toMatchObject({
      status: 'accepted',
      subject_entity_id: matchFixture.matchId,
    })
  })

  it('redacts secret-like values from structured INGEST logs', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const event: PipelineEvent = {
      timestamp: NOW,
      stage: 'write',
      level: 'info',
      code: 'HARDENING_LOG_TEST',
      message: 'Structured log redaction test.',
      context: {
        source_record_id: 'safe-record-id',
        SUPABASE_SECRET_KEY: 'must-not-appear',
        nested: { authorization: 'Bearer must-not-appear-either' },
      },
    }

    new JsonConsoleIngestLogger().log(event)

    const output = String(spy.mock.calls[0]?.[0] ?? '')
    expect(output).toContain('safe-record-id')
    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('must-not-appear')
    spy.mockRestore()
  })
})
