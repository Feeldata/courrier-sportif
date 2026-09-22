import type { MatchRepository } from './repository'
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

const NOW = '2026-09-22T08:00:00.000Z'

export class MemoryMatchRepository implements MatchRepository {
  readonly seasons = new Set<string>()
  readonly teams = new Set<string>()
  readonly players = new Set<string>()
  readonly venues = new Set<string>()
  readonly matchEntities = new Set<string>()
  readonly matches = new Map<string, MatchRow>()
  readonly matchPlayers = new Map<string, MatchPlayerRow>()
  readonly matchEvents = new Map<string, MatchEventRow>()
  readonly matchResults = new Map<string, MatchResultRow>()
  readonly sourceObservations = new Map<string, SourceObservationRow>()
  readonly validationIssues = new Map<string, ValidationIssueInsert>()

  async getMatch(matchId: string) {
    return this.matches.get(matchId) ?? null
  }

  async seasonExists(seasonId: string) {
    return this.seasons.has(seasonId)
  }

  async teamExists(teamId: string) {
    return this.teams.has(teamId)
  }

  async playerExists(playerId: string) {
    return this.players.has(playerId)
  }

  async venueExists(venueId: string) {
    return this.venues.has(venueId)
  }

  async createMatchEntity(matchId: string) {
    this.matchEntities.add(matchId)
  }

  async upsertMatch(match: MatchInsert) {
    const existing = this.matches.get(match.entity_id)
    this.matches.set(match.entity_id, {
      entity_id: match.entity_id,
      season_id: match.season_id,
      home_team_id: match.home_team_id,
      away_team_id: match.away_team_id,
      scheduled_date: match.scheduled_date ?? null,
      kickoff_at: match.kickoff_at ?? null,
      kickoff_precision: match.kickoff_precision ?? 'unknown',
      venue_id: match.venue_id ?? null,
      matchday: match.matchday ?? null,
      round_label: match.round_label ?? null,
      leg: match.leg ?? null,
      neutral_venue: match.neutral_venue ?? false,
      replay_of_match_id: match.replay_of_match_id ?? null,
      status: match.status ?? 'scheduled',
      created_at: existing?.created_at ?? NOW,
      updated_at: NOW,
    })
  }

  async updateMatch(matchId: string, patch: MatchUpdate) {
    const current = this.matches.get(matchId)
    if (!current) throw new Error(`Match ${matchId} missing`)
    this.matches.set(matchId, { ...current, ...patch, entity_id: matchId, updated_at: NOW })
  }

  async listMatchPlayers(matchId: string) {
    return [...this.matchPlayers.values()].filter((row) => row.match_id === matchId)
  }

  async upsertMatchPlayers(players: MatchPlayerInsert[]) {
    for (const row of players) {
      if (!row.match_player_id) throw new Error('Memory repository requires match_player_id')
      const existing = this.matchPlayers.get(row.match_player_id)
      this.matchPlayers.set(row.match_player_id, {
        match_player_id: row.match_player_id,
        match_id: row.match_id,
        player_id: row.player_id,
        team_id: row.team_id,
        squad_role: row.squad_role ?? 'unknown',
        shirt_number: row.shirt_number ?? null,
        captain: row.captain ?? false,
        starting_position: row.starting_position ?? null,
        minute_in: row.minute_in ?? null,
        minute_out: row.minute_out ?? null,
        created_at: existing?.created_at ?? NOW,
        updated_at: NOW,
      })
    }
  }

  async listMatchEvents(matchId: string) {
    return [...this.matchEvents.values()]
      .filter((row) => row.match_id === matchId)
      .sort(
        (a, b) =>
          (a.sequence_number ?? Number.MAX_SAFE_INTEGER) -
          (b.sequence_number ?? Number.MAX_SAFE_INTEGER),
      )
  }

  async upsertMatchEvent(event: MatchEventInsert) {
    if (!event.event_id) throw new Error('Memory repository requires event_id')
    const existing = this.matchEvents.get(event.event_id)
    this.matchEvents.set(event.event_id, {
      event_id: event.event_id,
      match_id: event.match_id,
      event_type: event.event_type,
      period: event.period ?? 'unknown',
      sequence_number: event.sequence_number ?? null,
      minute: event.minute ?? null,
      stoppage_minute: event.stoppage_minute ?? null,
      team_id: event.team_id ?? null,
      player_id: event.player_id ?? null,
      related_player_id: event.related_player_id ?? null,
      metadata: event.metadata ?? {},
      created_at: existing?.created_at ?? NOW,
      updated_at: NOW,
    })
  }

  async getMatchResult(matchId: string) {
    return this.matchResults.get(matchId) ?? null
  }

  async upsertMatchResult(result: MatchResultInsert) {
    const existing = this.matchResults.get(result.match_id)
    this.matchResults.set(result.match_id, {
      match_result_id:
        result.match_result_id ?? existing?.match_result_id ?? `result-${result.match_id}`,
      match_id: result.match_id,
      score_90_home: result.score_90_home ?? existing?.score_90_home ?? null,
      score_90_away: result.score_90_away ?? existing?.score_90_away ?? null,
      score_et_home: result.score_et_home ?? existing?.score_et_home ?? null,
      score_et_away: result.score_et_away ?? existing?.score_et_away ?? null,
      penalties_home: result.penalties_home ?? existing?.penalties_home ?? null,
      penalties_away: result.penalties_away ?? existing?.penalties_away ?? null,
      official_score_home: result.official_score_home ?? existing?.official_score_home ?? null,
      official_score_away: result.official_score_away ?? existing?.official_score_away ?? null,
      decision_type: result.decision_type ?? existing?.decision_type ?? 'unknown',
      winner_team_id: result.winner_team_id ?? existing?.winner_team_id ?? null,
      created_at: existing?.created_at ?? NOW,
      updated_at: NOW,
    })
  }

  async getSourceObservations(observationIds: string[]) {
    return observationIds.flatMap((id) => {
      const row = this.sourceObservations.get(id)
      return row ? [row] : []
    })
  }

  async acceptMatchObservations(matchId: string, observationIds: string[]) {
    for (const id of observationIds) {
      const row = this.sourceObservations.get(id)
      if (!row) throw new Error(`Observation ${id} missing`)
      this.sourceObservations.set(id, {
        ...row,
        status: 'accepted',
        subject_entity_id: matchId,
      })
    }
  }

  async upsertValidationIssue(issue: ValidationIssueInsert) {
    if (!issue.validation_issue_id)
      throw new Error('Memory repository requires validation_issue_id')
    this.validationIssues.set(issue.validation_issue_id, structuredClone(issue))
  }
}
