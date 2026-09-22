import { describe, expect, it } from 'vitest'

import type { MatchDomainError } from './lifecycle'
import { MemoryMatchRepository } from './memory-repository'
import { MatchService } from './service'
import { CAMEROON_REALISTIC_MATCH as fixture } from './fixtures/cameroon-realistic'

const NOW = '2026-09-22T08:00:00.000Z'

function seedRepository() {
  const repository = new MemoryMatchRepository()
  repository.seasons.add(fixture.seasonId)
  repository.teams.add(fixture.homeTeamId)
  repository.teams.add(fixture.awayTeamId)
  repository.venues.add(fixture.venueId)
  repository.players.add(fixture.homePlayerOne)
  repository.players.add(fixture.homePlayerTwo)
  repository.players.add(fixture.awayPlayerOne)
  repository.players.add(fixture.awayPlayerTwo)
  repository.sourceObservations.set(fixture.fixtureObservationId, {
    observation_id: fixture.fixtureObservationId,
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
  repository.sourceObservations.set(fixture.eventObservationId, {
    observation_id: fixture.eventObservationId,
    source_record_id: '10000000-0000-4000-8000-000000000021',
    subject_entity_id: null,
    subject_entity_type: 'match',
    subject_key: 'match:canon-coton:2026-10-04:event:5',
    field_name: 'event',
    raw_value: { type: 'goal', minute: 78 },
    normalized_value: null,
    confidence: 0.97,
    status: 'candidate',
    observed_at: NOW,
    created_at: NOW,
  })
  return repository
}

async function createFixture(service: MatchService) {
  return service.createFixture({
    matchId: fixture.matchId,
    seasonId: fixture.seasonId,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    scheduledDate: '2026-10-04',
    kickoffAt: '2026-10-04T15:30:00+01:00',
    kickoffPrecision: 'exact',
    venueId: fixture.venueId,
    matchday: 3,
    provenance: { observationIds: [fixture.fixtureObservationId] },
  })
}

async function setLineup(service: MatchService) {
  await service.setLineup(fixture.matchId, {
    players: [
      {
        matchPlayerId: '20000000-0000-4000-8000-000000000001',
        playerId: fixture.homePlayerOne,
        teamId: fixture.homeTeamId,
        squadRole: 'starter',
        shirtNumber: 9,
        captain: true,
        startingPosition: 'CF',
      },
      {
        matchPlayerId: '20000000-0000-4000-8000-000000000002',
        playerId: fixture.homePlayerTwo,
        teamId: fixture.homeTeamId,
        squadRole: 'substitute_unused',
        shirtNumber: 17,
      },
      {
        matchPlayerId: '20000000-0000-4000-8000-000000000003',
        playerId: fixture.awayPlayerOne,
        teamId: fixture.awayTeamId,
        squadRole: 'starter',
        shirtNumber: 10,
        captain: true,
        startingPosition: 'AM',
      },
      {
        matchPlayerId: '20000000-0000-4000-8000-000000000004',
        playerId: fixture.awayPlayerTwo,
        teamId: fixture.awayTeamId,
        squadRole: 'substitute_used',
        shirtNumber: 19,
        minuteIn: 66,
      },
    ],
  })
}

describe('MATCH V0.1 critical lifecycle', () => {
  it('runs a realistic Cameroonian fixture through official validation without inventing data', async () => {
    const repository = seedRepository()
    const service = new MatchService(repository)

    await createFixture(service)
    expect(repository.matches.get(fixture.matchId)?.status).toBe('scheduled')
    expect(repository.sourceObservations.get(fixture.fixtureObservationId)).toMatchObject({
      status: 'accepted',
      subject_entity_id: fixture.matchId,
    })

    await service.setMatchSheet(fixture.matchId, {
      roundLabel: 'Journée 3',
      neutralVenue: false,
    })
    await setLineup(service)
    expect(await repository.listMatchPlayers(fixture.matchId)).toHaveLength(4)

    await service.transitionStatus(fixture.matchId, 'live')
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000001',
      eventType: 'goal',
      period: '1H',
      sequenceNumber: 1,
      minute: 18,
      teamId: fixture.homeTeamId,
      playerId: fixture.homePlayerOne,
    })
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000002',
      eventType: 'yellow_card',
      period: '1H',
      sequenceNumber: 2,
      minute: 31,
      teamId: fixture.awayTeamId,
      playerId: fixture.awayPlayerOne,
    })
    await service.transitionStatus(fixture.matchId, 'halftime')
    await service.transitionStatus(fixture.matchId, 'live')
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000003',
      eventType: 'goal',
      period: '2H',
      sequenceNumber: 3,
      minute: 63,
      teamId: fixture.awayTeamId,
      playerId: fixture.awayPlayerOne,
    })
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000004',
      eventType: 'substitution',
      period: '2H',
      sequenceNumber: 4,
      minute: 66,
      teamId: fixture.awayTeamId,
      playerId: fixture.awayPlayerOne,
      relatedPlayerId: fixture.awayPlayerTwo,
    })
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000005',
      eventType: 'goal',
      period: '2H',
      sequenceNumber: 5,
      minute: 78,
      teamId: fixture.homeTeamId,
      playerId: fixture.homePlayerOne,
      provenance: { observationIds: [fixture.eventObservationId] },
    })

    const observed = await service.finishMatch(fixture.matchId, { eventFeedComplete: true })
    expect(observed).toMatchObject({
      score90Home: 2,
      score90Away: 1,
      currentHome: 2,
      currentAway: 1,
      derivedFromCompleteEvents: true,
    })
    expect(repository.matches.get(fixture.matchId)?.status).toBe('finished')
    expect(repository.matchResults.get(fixture.matchId)).toMatchObject({
      score_90_home: 2,
      score_90_away: 1,
      official_score_home: null,
      official_score_away: null,
      decision_type: 'unknown',
    })
    expect(repository.sourceObservations.get(fixture.eventObservationId)).toMatchObject({
      status: 'accepted',
      subject_entity_id: fixture.matchId,
    })

    const validation = await service.validateOfficialResult(fixture.matchId, {
      officialScoreHome: 2,
      officialScoreAway: 1,
      decisionType: 'regulation',
      winnerTeamId: fixture.homeTeamId,
    })
    expect(validation).toEqual({ status: 'validated' })
    expect(repository.matchResults.get(fixture.matchId)).toMatchObject({
      score_90_home: 2,
      score_90_away: 1,
      official_score_home: 2,
      official_score_away: 1,
      decision_type: 'regulation',
      winner_team_id: fixture.homeTeamId,
    })
  })

  it('rejects an invalid lifecycle transition', async () => {
    const service = new MatchService(seedRepository())
    await createFixture(service)
    await expect(service.transitionStatus(fixture.matchId, 'halftime')).rejects.toMatchObject({
      code: 'INVALID_STATUS_TRANSITION',
    } satisfies Partial<MatchDomainError>)
  })

  it('does not turn a sparse event feed into an invented 0-0 score', async () => {
    const repository = seedRepository()
    const service = new MatchService(repository)
    await createFixture(service)
    await service.transitionStatus(fixture.matchId, 'live')

    const observed = await service.finishMatch(fixture.matchId, { eventFeedComplete: false })
    expect(observed).toBeNull()
    expect(repository.matchResults.has(fixture.matchId)).toBe(false)
    expect(repository.matches.get(fixture.matchId)?.status).toBe('finished')
  })

  it('requires a scoring team instead of guessing the beneficiary', async () => {
    const service = new MatchService(seedRepository())
    await createFixture(service)
    await setLineup(service)
    await service.transitionStatus(fixture.matchId, 'live')

    await expect(
      service.recordEvent(fixture.matchId, {
        eventId: '30000000-0000-4000-8000-000000000010',
        eventType: 'goal',
        period: '1H',
        sequenceNumber: 1,
        minute: 12,
        playerId: fixture.homePlayerOne,
      }),
    ).rejects.toMatchObject({ code: 'SCORING_TEAM_REQUIRED' } satisfies Partial<MatchDomainError>)
  })

  it('routes an official score conflict to validation review and leaves official score untouched', async () => {
    const repository = seedRepository()
    const service = new MatchService(repository)
    await createFixture(service)
    await setLineup(service)
    await service.transitionStatus(fixture.matchId, 'live')
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000020',
      eventType: 'goal',
      period: '2H',
      sequenceNumber: 1,
      minute: 70,
      teamId: fixture.homeTeamId,
      playerId: fixture.homePlayerOne,
    })
    await service.finishMatch(fixture.matchId, { eventFeedComplete: true })

    const validation = await service.validateOfficialResult(fixture.matchId, {
      officialScoreHome: 2,
      officialScoreAway: 0,
      decisionType: 'regulation',
      winnerTeamId: fixture.homeTeamId,
    })

    expect(validation.status).toBe('review_required')
    expect(repository.validationIssues.size).toBe(1)
    expect(repository.matchResults.get(fixture.matchId)).toMatchObject({
      score_90_home: 1,
      score_90_away: 0,
      official_score_home: null,
      official_score_away: null,
    })
  })

  it('rejects duplicate or retroactive event sequence numbers', async () => {
    const service = new MatchService(seedRepository())
    await createFixture(service)
    await setLineup(service)
    await service.transitionStatus(fixture.matchId, 'live')
    await service.recordEvent(fixture.matchId, {
      eventId: '30000000-0000-4000-8000-000000000030',
      eventType: 'yellow_card',
      period: '1H',
      sequenceNumber: 2,
      minute: 20,
      teamId: fixture.homeTeamId,
      playerId: fixture.homePlayerOne,
    })

    await expect(
      service.recordEvent(fixture.matchId, {
        eventId: '30000000-0000-4000-8000-000000000031',
        eventType: 'yellow_card',
        period: '1H',
        sequenceNumber: 1,
        minute: 21,
        teamId: fixture.awayTeamId,
        playerId: fixture.awayPlayerOne,
      }),
    ).rejects.toMatchObject({ code: 'EVENT_OUT_OF_ORDER' } satisfies Partial<MatchDomainError>)
  })
})
