import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type MatchRow = Tables<'matches'>
export type MatchPlayerRow = Tables<'match_players'>
export type MatchEventRow = Tables<'match_events'>
export type MatchResultRow = Tables<'match_results'>
export type SourceObservationRow = Tables<'source_observations'>

export type MatchInsert = TablesInsert<'matches'>
export type MatchUpdate = TablesUpdate<'matches'>
export type MatchPlayerInsert = TablesInsert<'match_players'>
export type MatchEventInsert = TablesInsert<'match_events'>
export type MatchResultInsert = TablesInsert<'match_results'>
export type ValidationIssueInsert = TablesInsert<'validation_issues'>

export type MatchStatus =
  | 'scheduled'
  | 'postponed'
  | 'delayed'
  | 'live'
  | 'halftime'
  | 'suspended'
  | 'finished'
  | 'abandoned'
  | 'cancelled'

export type MatchPeriod = '1H' | '2H' | 'ET1' | 'ET2' | 'PEN' | 'unknown'

export type MatchEventType =
  | 'goal'
  | 'own_goal'
  | 'penalty_goal'
  | 'penalty_miss'
  | 'yellow_card'
  | 'red_card'
  | 'second_yellow_red'
  | 'substitution'
  | 'var'
  | 'other'

export type SquadRole = 'starter' | 'substitute_used' | 'substitute_unused' | 'unknown'

export type DecisionType =
  | 'regulation'
  | 'extra_time'
  | 'penalties'
  | 'walkover'
  | 'forfeit'
  | 'administrative'
  | 'draw'
  | 'unknown'

export interface ProvenanceInput {
  observationIds: string[]
}

export interface FixtureInput {
  matchId: string
  seasonId: string
  homeTeamId: string
  awayTeamId: string
  scheduledDate: string | null
  kickoffAt?: string | null
  kickoffPrecision?: 'exact' | 'approximate' | 'unknown'
  venueId?: string | null
  matchday?: number | null
  roundLabel?: string | null
  leg?: 'single' | 'first' | 'second' | null
  neutralVenue?: boolean
  replayOfMatchId?: string | null
  provenance?: ProvenanceInput
}

export interface MatchSheetInput {
  scheduledDate?: string | null
  kickoffAt?: string | null
  kickoffPrecision?: 'exact' | 'approximate' | 'unknown'
  venueId?: string | null
  matchday?: number | null
  roundLabel?: string | null
  leg?: 'single' | 'first' | 'second' | null
  neutralVenue?: boolean
  provenance?: ProvenanceInput
}

export interface MatchPlayerInput {
  matchPlayerId: string
  playerId: string
  teamId: string
  squadRole: SquadRole
  shirtNumber?: number | null
  captain?: boolean
  startingPosition?: string | null
  minuteIn?: number | null
  minuteOut?: number | null
}

export interface LineupInput {
  players: MatchPlayerInput[]
  provenance?: ProvenanceInput
}

export interface MatchEventInput {
  eventId: string
  eventType: MatchEventType
  period: MatchPeriod
  sequenceNumber: number
  minute?: number | null
  stoppageMinute?: number | null
  teamId?: string | null
  playerId?: string | null
  relatedPlayerId?: string | null
  metadata?: Json
  provenance?: ProvenanceInput
}

export interface ExplicitObservedResult {
  score90Home: number | null
  score90Away: number | null
  scoreEtHome?: number | null
  scoreEtAway?: number | null
  penaltiesHome?: number | null
  penaltiesAway?: number | null
}

export interface FinishMatchInput {
  eventFeedComplete: boolean
  observedResult?: ExplicitObservedResult
  provenance?: ProvenanceInput
}

export interface OfficialResultInput {
  officialScoreHome: number
  officialScoreAway: number
  decisionType: Exclude<DecisionType, 'unknown'>
  winnerTeamId: string | null
  penaltiesHome?: number | null
  penaltiesAway?: number | null
  provenance?: ProvenanceInput
}

export interface ObservedScore {
  score90Home: number | null
  score90Away: number | null
  scoreEtHome: number | null
  scoreEtAway: number | null
  penaltiesHome: number | null
  penaltiesAway: number | null
  currentHome: number | null
  currentAway: number | null
  derivedFromCompleteEvents: boolean
}

export interface OfficialValidationResult {
  status: 'validated' | 'review_required'
  issueId?: string
}
