import { createHash } from 'node:crypto'

import {
  MatchDomainError,
  assertStatusTransition,
  deriveObservedScoreFromEvents,
  validateExplicitObservedResult,
} from './lifecycle'
import type { MatchRepository } from './repository'
import type {
  FinishMatchInput,
  FixtureInput,
  LineupInput,
  MatchEventInput,
  MatchEventRow,
  MatchPeriod,
  MatchResultRow,
  MatchSheetInput,
  MatchStatus,
  ObservedScore,
  OfficialResultInput,
  OfficialValidationResult,
  ProvenanceInput,
} from './types'

function stableIssueId(matchId: string, ruleCode: string): string {
  const digest = createHash('sha256')
    .update(`courrier-sportif:match:v0.1:${matchId}:${ruleCode}`)
    .digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function assertIntegerAtLeast(value: number | null | undefined, minimum: number, field: string) {
  if (value === null || value === undefined) return
  if (!Number.isInteger(value) || value < minimum) {
    throw new MatchDomainError('INVALID_NUMBER', `${field} est invalide.`)
  }
}

async function requireMatch(repository: MatchRepository, matchId: string) {
  const match = await repository.getMatch(matchId)
  if (!match) throw new MatchDomainError('MATCH_NOT_FOUND', `Match ${matchId} introuvable.`)
  return match
}

async function validateProvenance(
  repository: MatchRepository,
  matchId: string,
  provenance: ProvenanceInput | undefined,
): Promise<string[]> {
  if (!provenance || provenance.observationIds.length === 0) return []
  const uniqueIds = [...new Set(provenance.observationIds)]
  const rows = await repository.getSourceObservations(uniqueIds)
  if (rows.length !== uniqueIds.length) {
    throw new MatchDomainError(
      'PROVENANCE_NOT_FOUND',
      'Une observation INGEST référencée est absente.',
    )
  }
  for (const row of rows) {
    if (row.subject_entity_type !== 'match') {
      throw new MatchDomainError(
        'PROVENANCE_ENTITY_TYPE_MISMATCH',
        `L'observation ${row.observation_id} ne cible pas un match.`,
      )
    }
    if (row.status === 'rejected') {
      throw new MatchDomainError(
        'PROVENANCE_REJECTED',
        `L'observation ${row.observation_id} a été rejetée et ne peut pas être canonisée.`,
      )
    }
    if (row.subject_entity_id && row.subject_entity_id !== matchId) {
      throw new MatchDomainError(
        'PROVENANCE_ALREADY_LINKED',
        `L'observation ${row.observation_id} est déjà liée à un autre match.`,
      )
    }
  }
  return uniqueIds
}

async function linkProvenance(
  repository: MatchRepository,
  matchId: string,
  provenance: ProvenanceInput | undefined,
) {
  const observationIds = await validateProvenance(repository, matchId, provenance)
  if (observationIds.length === 0) return
  await repository.acceptMatchObservations(matchId, observationIds)
}

function assertTeamBelongsToMatch(
  match: { home_team_id: string; away_team_id: string },
  teamId: string,
) {
  if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
    throw new MatchDomainError(
      'TEAM_NOT_IN_MATCH',
      `L'équipe ${teamId} ne participe pas à ce match.`,
    )
  }
}

function isScoringEvent(eventType: string) {
  return eventType === 'goal' || eventType === 'own_goal' || eventType === 'penalty_goal'
}

function resultSnapshot(result: MatchResultRow | null): ObservedScore | null {
  if (!result) return null
  const currentHome = result.score_et_home ?? result.score_90_home
  const currentAway = result.score_et_away ?? result.score_90_away
  if (currentHome === null || currentAway === null) return null
  return {
    score90Home: result.score_90_home,
    score90Away: result.score_90_away,
    scoreEtHome: result.score_et_home,
    scoreEtAway: result.score_et_away,
    penaltiesHome: result.penalties_home,
    penaltiesAway: result.penalties_away,
    currentHome,
    currentAway,
    derivedFromCompleteEvents: false,
  }
}

export class MatchService {
  constructor(private readonly repository: MatchRepository) {}

  async createFixture(input: FixtureInput) {
    if (input.homeTeamId === input.awayTeamId) {
      throw new MatchDomainError(
        'SAME_TEAM_FIXTURE',
        'Une équipe ne peut pas jouer contre elle-même.',
      )
    }
    if (!(await this.repository.seasonExists(input.seasonId))) {
      throw new MatchDomainError('SEASON_NOT_FOUND', 'La saison du fixture est absente.')
    }
    if (!(await this.repository.teamExists(input.homeTeamId))) {
      throw new MatchDomainError('HOME_TEAM_NOT_FOUND', "L'équipe à domicile est absente.")
    }
    if (!(await this.repository.teamExists(input.awayTeamId))) {
      throw new MatchDomainError('AWAY_TEAM_NOT_FOUND', "L'équipe à l'extérieur est absente.")
    }
    if (input.venueId && !(await this.repository.venueExists(input.venueId))) {
      throw new MatchDomainError('VENUE_NOT_FOUND', 'Le stade indiqué est absent.')
    }
    assertIntegerAtLeast(input.matchday, 1, 'matchday')

    const existing = await this.repository.getMatch(input.matchId)
    if (existing) {
      const sameIdentity =
        existing.season_id === input.seasonId &&
        existing.home_team_id === input.homeTeamId &&
        existing.away_team_id === input.awayTeamId
      if (!sameIdentity) {
        throw new MatchDomainError(
          'FIXTURE_ID_CONFLICT',
          'Cet identifiant de match existe déjà avec une autre identité.',
        )
      }
      await linkProvenance(this.repository, input.matchId, input.provenance)
      return existing
    }

    await this.repository.createMatchEntity(input.matchId)
    await this.repository.upsertMatch({
      entity_id: input.matchId,
      season_id: input.seasonId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      scheduled_date: input.scheduledDate,
      kickoff_at: input.kickoffAt ?? null,
      kickoff_precision: input.kickoffPrecision ?? 'unknown',
      venue_id: input.venueId ?? null,
      matchday: input.matchday ?? null,
      round_label: input.roundLabel ?? null,
      leg: input.leg ?? null,
      neutral_venue: input.neutralVenue ?? false,
      replay_of_match_id: input.replayOfMatchId ?? null,
      status: 'scheduled',
    })
    await linkProvenance(this.repository, input.matchId, input.provenance)
    return requireMatch(this.repository, input.matchId)
  }

  async transitionStatus(matchId: string, target: MatchStatus, provenance?: ProvenanceInput) {
    const match = await requireMatch(this.repository, matchId)
    const current = match.status as MatchStatus
    if (current === target) {
      await linkProvenance(this.repository, matchId, provenance)
      return match
    }
    assertStatusTransition(current, target)
    await this.repository.updateMatch(matchId, { status: target })
    await linkProvenance(this.repository, matchId, provenance)
    return requireMatch(this.repository, matchId)
  }

  async setMatchSheet(matchId: string, input: MatchSheetInput) {
    const match = await requireMatch(this.repository, matchId)
    if (match.status === 'finished' || match.status === 'cancelled') {
      throw new MatchDomainError(
        'MATCH_SHEET_LOCKED',
        'La feuille de match est verrouillée pour ce statut.',
      )
    }
    if (input.venueId && !(await this.repository.venueExists(input.venueId))) {
      throw new MatchDomainError('VENUE_NOT_FOUND', 'Le stade indiqué est absent.')
    }
    assertIntegerAtLeast(input.matchday, 1, 'matchday')

    await this.repository.updateMatch(matchId, {
      ...(Object.hasOwn(input, 'scheduledDate') ? { scheduled_date: input.scheduledDate } : {}),
      ...(Object.hasOwn(input, 'kickoffAt') ? { kickoff_at: input.kickoffAt } : {}),
      ...(Object.hasOwn(input, 'kickoffPrecision')
        ? { kickoff_precision: input.kickoffPrecision }
        : {}),
      ...(Object.hasOwn(input, 'venueId') ? { venue_id: input.venueId } : {}),
      ...(Object.hasOwn(input, 'matchday') ? { matchday: input.matchday } : {}),
      ...(Object.hasOwn(input, 'roundLabel') ? { round_label: input.roundLabel } : {}),
      ...(Object.hasOwn(input, 'leg') ? { leg: input.leg } : {}),
      ...(Object.hasOwn(input, 'neutralVenue') ? { neutral_venue: input.neutralVenue } : {}),
    })
    await linkProvenance(this.repository, matchId, input.provenance)
    return requireMatch(this.repository, matchId)
  }

  async setLineup(matchId: string, input: LineupInput) {
    const match = await requireMatch(this.repository, matchId)
    if (match.status === 'cancelled') {
      throw new MatchDomainError(
        'LINEUP_NOT_ALLOWED',
        'Impossible de renseigner une composition annulée.',
      )
    }

    const seenPlayers = new Set<string>()
    const captainByTeam = new Set<string>()
    for (const player of input.players) {
      assertTeamBelongsToMatch(match, player.teamId)
      if (seenPlayers.has(player.playerId)) {
        throw new MatchDomainError(
          'DUPLICATE_MATCH_PLAYER',
          'Un joueur ne peut apparaître qu’une fois.',
        )
      }
      seenPlayers.add(player.playerId)
      if (!(await this.repository.playerExists(player.playerId))) {
        throw new MatchDomainError('PLAYER_NOT_FOUND', `Le joueur ${player.playerId} est absent.`)
      }
      assertIntegerAtLeast(player.shirtNumber, 0, 'shirtNumber')
      assertIntegerAtLeast(player.minuteIn, 0, 'minuteIn')
      assertIntegerAtLeast(player.minuteOut, 0, 'minuteOut')
      if (player.captain) {
        if (captainByTeam.has(player.teamId)) {
          throw new MatchDomainError(
            'MULTIPLE_CAPTAINS',
            'Une équipe ne peut avoir deux capitaines.',
          )
        }
        captainByTeam.add(player.teamId)
      }
    }

    await this.repository.upsertMatchPlayers(
      input.players.map((player) => ({
        match_player_id: player.matchPlayerId,
        match_id: matchId,
        player_id: player.playerId,
        team_id: player.teamId,
        squad_role: player.squadRole,
        shirt_number: player.shirtNumber ?? null,
        captain: player.captain ?? false,
        starting_position: player.startingPosition ?? null,
        minute_in: player.minuteIn ?? null,
        minute_out: player.minuteOut ?? null,
      })),
    )
    await linkProvenance(this.repository, matchId, input.provenance)
    return this.repository.listMatchPlayers(matchId)
  }

  async recordEvent(matchId: string, input: MatchEventInput) {
    const match = await requireMatch(this.repository, matchId)
    if (!['live', 'halftime', 'suspended'].includes(match.status)) {
      throw new MatchDomainError(
        'EVENT_NOT_ALLOWED',
        `Événement interdit quand le match est ${match.status}.`,
      )
    }
    assertIntegerAtLeast(input.sequenceNumber, 1, 'sequenceNumber')
    assertIntegerAtLeast(input.minute, 0, 'minute')
    assertIntegerAtLeast(input.stoppageMinute, 0, 'stoppageMinute')

    if (input.teamId) assertTeamBelongsToMatch(match, input.teamId)
    if (isScoringEvent(input.eventType) && !input.teamId) {
      throw new MatchDomainError(
        'SCORING_TEAM_REQUIRED',
        'Un but ne peut pas être canonisé sans équipe bénéficiaire.',
      )
    }
    if (input.playerId && !(await this.repository.playerExists(input.playerId))) {
      throw new MatchDomainError('PLAYER_NOT_FOUND', `Le joueur ${input.playerId} est absent.`)
    }
    if (input.relatedPlayerId && !(await this.repository.playerExists(input.relatedPlayerId))) {
      throw new MatchDomainError(
        'RELATED_PLAYER_NOT_FOUND',
        `Le joueur ${input.relatedPlayerId} est absent.`,
      )
    }

    const events = await this.repository.listMatchEvents(matchId)
    const sameEvent = events.find((event) => event.event_id === input.eventId)
    const sameSequence = events.find(
      (event) => event.sequence_number === input.sequenceNumber && event.event_id !== input.eventId,
    )
    if (sameSequence) {
      throw new MatchDomainError(
        'EVENT_SEQUENCE_CONFLICT',
        `La séquence ${input.sequenceNumber} est déjà utilisée.`,
      )
    }
    if (!sameEvent) {
      const maxSequence = events.reduce(
        (max, event) => Math.max(max, event.sequence_number ?? 0),
        0,
      )
      if (input.sequenceNumber <= maxSequence) {
        throw new MatchDomainError(
          'EVENT_OUT_OF_ORDER',
          'Un nouvel événement doit suivre la dernière séquence canonique.',
        )
      }
    }

    const metadata =
      input.provenance && input.provenance.observationIds.length > 0
        ? {
            ...(typeof input.metadata === 'object' &&
            input.metadata &&
            !Array.isArray(input.metadata)
              ? input.metadata
              : {}),
            provenance_observation_ids: [...new Set(input.provenance.observationIds)],
          }
        : (input.metadata ?? {})

    await this.repository.upsertMatchEvent({
      event_id: input.eventId,
      match_id: matchId,
      event_type: input.eventType,
      period: input.period,
      sequence_number: input.sequenceNumber,
      minute: input.minute ?? null,
      stoppage_minute: input.stoppageMinute ?? null,
      team_id: input.teamId ?? null,
      player_id: input.playerId ?? null,
      related_player_id: input.relatedPlayerId ?? null,
      metadata,
    })
    await linkProvenance(this.repository, matchId, input.provenance)
    return this.repository.listMatchEvents(matchId)
  }

  async getObservedScore(
    matchId: string,
    eventFeedComplete = false,
  ): Promise<ObservedScore | null> {
    const match = await requireMatch(this.repository, matchId)
    const stored = resultSnapshot(await this.repository.getMatchResult(matchId))
    if (!eventFeedComplete) return stored
    return deriveObservedScoreFromEvents(match, await this.repository.listMatchEvents(matchId))
  }

  async finishMatch(matchId: string, input: FinishMatchInput) {
    const match = await requireMatch(this.repository, matchId)
    const status = match.status as MatchStatus
    if (status !== 'live') {
      throw new MatchDomainError(
        'FINISH_NOT_ALLOWED',
        'Un match doit être live avant de passer à finished.',
      )
    }

    let observed: ObservedScore | null = null
    if (input.observedResult) {
      observed = validateExplicitObservedResult(input.observedResult)
    } else if (input.eventFeedComplete) {
      observed = deriveObservedScoreFromEvents(
        match,
        await this.repository.listMatchEvents(matchId),
      )
    }

    if (observed) {
      await this.repository.upsertMatchResult({
        match_id: matchId,
        score_90_home: observed.score90Home,
        score_90_away: observed.score90Away,
        score_et_home: observed.scoreEtHome,
        score_et_away: observed.scoreEtAway,
        penalties_home: observed.penaltiesHome,
        penalties_away: observed.penaltiesAway,
        decision_type: 'unknown',
      })
    }
    await this.repository.updateMatch(matchId, { status: 'finished' })
    await linkProvenance(this.repository, matchId, input.provenance)
    return observed
  }

  async validateOfficialResult(
    matchId: string,
    input: OfficialResultInput,
  ): Promise<OfficialValidationResult> {
    const match = await requireMatch(this.repository, matchId)
    if (match.status !== 'finished') {
      throw new MatchDomainError(
        'OFFICIAL_VALIDATION_NOT_ALLOWED',
        'La validation officielle exige un match terminé.',
      )
    }
    assertIntegerAtLeast(input.officialScoreHome, 0, 'officialScoreHome')
    assertIntegerAtLeast(input.officialScoreAway, 0, 'officialScoreAway')
    assertIntegerAtLeast(input.penaltiesHome, 0, 'penaltiesHome')
    assertIntegerAtLeast(input.penaltiesAway, 0, 'penaltiesAway')
    if (input.winnerTeamId) assertTeamBelongsToMatch(match, input.winnerTeamId)

    const result = await this.repository.getMatchResult(matchId)
    const expected = (() => {
      if (!result) return null
      if (input.decisionType === 'extra_time' || input.decisionType === 'penalties') {
        if (result.score_et_home !== null && result.score_et_away !== null) {
          return [result.score_et_home, result.score_et_away] as const
        }
      }
      if (result.score_90_home !== null && result.score_90_away !== null) {
        return [result.score_90_home, result.score_90_away] as const
      }
      return null
    })()

    const administrative = ['walkover', 'forfeit', 'administrative'].includes(input.decisionType)
    const scoreMismatch =
      !administrative &&
      (!expected ||
        expected[0] !== input.officialScoreHome ||
        expected[1] !== input.officialScoreAway)

    const observedPenalties =
      result?.penalties_home !== null &&
      result?.penalties_home !== undefined &&
      result.penalties_away !== null &&
      result.penalties_away !== undefined
        ? ([result.penalties_home, result.penalties_away] as const)
        : null
    const penaltyMismatch =
      input.decisionType === 'penalties' &&
      observedPenalties !== null &&
      (input.penaltiesHome !== observedPenalties[0] || input.penaltiesAway !== observedPenalties[1])

    const draw = input.officialScoreHome === input.officialScoreAway
    const winnerMismatch = (() => {
      if (input.decisionType === 'penalties') {
        if (input.penaltiesHome === null || input.penaltiesHome === undefined) return true
        if (input.penaltiesAway === null || input.penaltiesAway === undefined) return true
        if (input.penaltiesHome === input.penaltiesAway) return true
        const expectedWinner =
          input.penaltiesHome > input.penaltiesAway ? match.home_team_id : match.away_team_id
        return input.winnerTeamId !== expectedWinner
      }
      if (draw) return input.winnerTeamId !== null || input.decisionType !== 'draw'
      if (input.decisionType === 'draw') return true
      const expectedWinner =
        input.officialScoreHome > input.officialScoreAway ? match.home_team_id : match.away_team_id
      return input.winnerTeamId !== expectedWinner
    })()

    if (scoreMismatch || penaltyMismatch || winnerMismatch) {
      const provenanceObservationIds = await validateProvenance(
        this.repository,
        matchId,
        input.provenance,
      )
      const issueId = stableIssueId(matchId, 'MATCH_OFFICIAL_RESULT_REVIEW_REQUIRED')
      await this.repository.upsertValidationIssue({
        validation_issue_id: issueId,
        entity_id: matchId,
        rule_code: 'MATCH_OFFICIAL_RESULT_REVIEW_REQUIRED',
        severity: 'blocking',
        status: 'open',
        message:
          'Le résultat officiel proposé ne peut pas être validé automatiquement contre le score observé.',
        subject_locator: { match_id: matchId },
        details: {
          observed_score: expected ? { home: expected[0], away: expected[1] } : null,
          observed_penalties: observedPenalties
            ? { home: observedPenalties[0], away: observedPenalties[1] }
            : null,
          proposed_official_score: {
            home: input.officialScoreHome,
            away: input.officialScoreAway,
          },
          proposed_penalties:
            input.decisionType === 'penalties'
              ? { home: input.penaltiesHome ?? null, away: input.penaltiesAway ?? null }
              : null,
          decision_type: input.decisionType,
          winner_team_id: input.winnerTeamId,
          provenance_observation_ids: provenanceObservationIds,
        },
      })
      return { status: 'review_required', issueId }
    }

    await this.repository.upsertMatchResult({
      match_id: matchId,
      official_score_home: input.officialScoreHome,
      official_score_away: input.officialScoreAway,
      penalties_home: input.penaltiesHome ?? result?.penalties_home ?? null,
      penalties_away: input.penaltiesAway ?? result?.penalties_away ?? null,
      decision_type: input.decisionType,
      winner_team_id: input.winnerTeamId,
    })
    await linkProvenance(this.repository, matchId, input.provenance)
    return { status: 'validated' }
  }
}

export function periodSortValue(period: MatchPeriod) {
  const values: Record<MatchPeriod, number> = {
    '1H': 1,
    '2H': 2,
    ET1: 3,
    ET2: 4,
    PEN: 5,
    unknown: 6,
  }
  return values[period]
}

export function sortMatchEvents(events: MatchEventRow[]) {
  return [...events].sort(
    (a, b) =>
      (a.sequence_number ?? Number.MAX_SAFE_INTEGER) -
        (b.sequence_number ?? Number.MAX_SAFE_INTEGER) ||
      periodSortValue(a.period as MatchPeriod) - periodSortValue(b.period as MatchPeriod) ||
      (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER),
  )
}
