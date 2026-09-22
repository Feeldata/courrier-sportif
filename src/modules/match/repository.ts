import type {
  MatchEventInsert,
  MatchEventRow,
  MatchInsert,
  MatchPlayerInsert,
  MatchPlayerRow,
  MatchResultInsert,
  MatchResultRow,
  MatchRow,
  MatchUpdate,
  SourceObservationRow,
  ValidationIssueInsert,
} from './types'

export interface MatchRepository {
  getMatch(matchId: string): Promise<MatchRow | null>
  seasonExists(seasonId: string): Promise<boolean>
  teamExists(teamId: string): Promise<boolean>
  playerExists(playerId: string): Promise<boolean>
  venueExists(venueId: string): Promise<boolean>
  createMatchEntity(matchId: string): Promise<void>
  upsertMatch(match: MatchInsert): Promise<void>
  updateMatch(matchId: string, patch: MatchUpdate): Promise<void>
  listMatchPlayers(matchId: string): Promise<MatchPlayerRow[]>
  upsertMatchPlayers(players: MatchPlayerInsert[]): Promise<void>
  listMatchEvents(matchId: string): Promise<MatchEventRow[]>
  upsertMatchEvent(event: MatchEventInsert): Promise<void>
  getMatchResult(matchId: string): Promise<MatchResultRow | null>
  upsertMatchResult(result: MatchResultInsert): Promise<void>
  getSourceObservations(observationIds: string[]): Promise<SourceObservationRow[]>
  acceptMatchObservations(matchId: string, observationIds: string[]): Promise<void>
  upsertValidationIssue(issue: ValidationIssueInsert): Promise<void>
}
