import type { MatchEventRow } from './types'
import type { MatchPeriod, MatchStatus, ObservedScore } from './types'

export class MatchDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'MatchDomainError'
  }
}

export const MATCH_STATUS_TRANSITIONS: Readonly<Record<MatchStatus, readonly MatchStatus[]>> = {
  scheduled: ['delayed', 'postponed', 'live', 'cancelled'],
  delayed: ['scheduled', 'postponed', 'live', 'cancelled'],
  postponed: ['scheduled', 'cancelled'],
  live: ['halftime', 'suspended', 'finished', 'abandoned'],
  halftime: ['live', 'suspended', 'abandoned'],
  suspended: ['live', 'postponed', 'abandoned'],
  finished: [],
  abandoned: [],
  cancelled: [],
}

const SCORE_EVENT_TYPES = new Set(['goal', 'own_goal', 'penalty_goal'])
const REGULATION_PERIODS = new Set<MatchPeriod>(['1H', '2H'])
const EXTRA_TIME_PERIODS = new Set<MatchPeriod>(['ET1', 'ET2'])

export function assertStatusTransition(from: MatchStatus, to: MatchStatus): void {
  if (!MATCH_STATUS_TRANSITIONS[from].includes(to)) {
    throw new MatchDomainError('INVALID_STATUS_TRANSITION', `Transition ${from} → ${to} interdite.`)
  }
}

function nonNegative(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isInteger(value) || value < 0) {
    throw new MatchDomainError('INVALID_SCORE', `${field} doit être un entier positif ou nul.`)
  }
  return value
}

export function validateExplicitObservedResult(input: {
  score90Home: number | null
  score90Away: number | null
  scoreEtHome?: number | null
  scoreEtAway?: number | null
  penaltiesHome?: number | null
  penaltiesAway?: number | null
}): ObservedScore {
  const score90Home = nonNegative(input.score90Home, 'score90Home')
  const score90Away = nonNegative(input.score90Away, 'score90Away')
  const scoreEtHome = nonNegative(input.scoreEtHome, 'scoreEtHome')
  const scoreEtAway = nonNegative(input.scoreEtAway, 'scoreEtAway')
  const penaltiesHome = nonNegative(input.penaltiesHome, 'penaltiesHome')
  const penaltiesAway = nonNegative(input.penaltiesAway, 'penaltiesAway')

  if ((score90Home === null) !== (score90Away === null)) {
    throw new MatchDomainError(
      'PARTIAL_SCORE',
      'Le score à 90 minutes doit être complet ou absent.',
    )
  }
  if ((scoreEtHome === null) !== (scoreEtAway === null)) {
    throw new MatchDomainError(
      'PARTIAL_SCORE',
      'Le score après prolongation doit être complet ou absent.',
    )
  }
  if ((penaltiesHome === null) !== (penaltiesAway === null)) {
    throw new MatchDomainError(
      'PARTIAL_SCORE',
      'Le score aux tirs au but doit être complet ou absent.',
    )
  }

  const currentHome = scoreEtHome ?? score90Home
  const currentAway = scoreEtAway ?? score90Away

  return {
    score90Home,
    score90Away,
    scoreEtHome,
    scoreEtAway,
    penaltiesHome,
    penaltiesAway,
    currentHome,
    currentAway,
    derivedFromCompleteEvents: false,
  }
}

export function deriveObservedScoreFromEvents(
  match: { home_team_id: string; away_team_id: string },
  events: MatchEventRow[],
): ObservedScore {
  let regulationHome = 0
  let regulationAway = 0
  let extraHome = 0
  let extraAway = 0
  let penaltiesHome = 0
  let penaltiesAway = 0
  let hasExtraTime = false
  let hasPenaltyShootout = false

  for (const event of events) {
    if (!SCORE_EVENT_TYPES.has(event.event_type)) continue

    if (!event.team_id) {
      throw new MatchDomainError(
        'SCORING_TEAM_MISSING',
        `L'événement ${event.event_id} ne permet pas d'attribuer le but à une équipe.`,
      )
    }
    if (event.team_id !== match.home_team_id && event.team_id !== match.away_team_id) {
      throw new MatchDomainError(
        'EVENT_TEAM_NOT_IN_MATCH',
        `L'équipe de l'événement ${event.event_id} ne participe pas au match.`,
      )
    }

    const home = event.team_id === match.home_team_id
    const period = event.period as MatchPeriod

    if (REGULATION_PERIODS.has(period)) {
      if (home) regulationHome += 1
      else regulationAway += 1
    } else if (EXTRA_TIME_PERIODS.has(period)) {
      hasExtraTime = true
      if (home) extraHome += 1
      else extraAway += 1
    } else if (period === 'PEN' && event.event_type === 'penalty_goal') {
      hasPenaltyShootout = true
      if (home) penaltiesHome += 1
      else penaltiesAway += 1
    }
  }

  const scoreEtHome = hasExtraTime ? regulationHome + extraHome : null
  const scoreEtAway = hasExtraTime ? regulationAway + extraAway : null

  return {
    score90Home: regulationHome,
    score90Away: regulationAway,
    scoreEtHome,
    scoreEtAway,
    penaltiesHome: hasPenaltyShootout ? penaltiesHome : null,
    penaltiesAway: hasPenaltyShootout ? penaltiesAway : null,
    currentHome: scoreEtHome ?? regulationHome,
    currentAway: scoreEtAway ?? regulationAway,
    derivedFromCompleteEvents: true,
  }
}
