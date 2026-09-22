import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'

import type { MatchRepository } from './repository'
import type {
  MatchEventInsert,
  MatchInsert,
  MatchPlayerInsert,
  MatchResultInsert,
  MatchUpdate,
  ValidationIssueInsert,
} from './types'

function assertNoError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

export class SupabaseMatchRepository implements MatchRepository {
  private readonly client = createAdminSupabaseClient()

  async getMatch(matchId: string) {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('entity_id', matchId)
      .maybeSingle()
    assertNoError(error, 'get match')
    return data
  }

  async seasonExists(seasonId: string) {
    const { count, error } = await this.client
      .from('seasons')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', seasonId)
    assertNoError(error, 'check season')
    return (count ?? 0) > 0
  }

  async teamExists(teamId: string) {
    const { count, error } = await this.client
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', teamId)
    assertNoError(error, 'check team')
    return (count ?? 0) > 0
  }

  async playerExists(playerId: string) {
    const { count, error } = await this.client
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', playerId)
    assertNoError(error, 'check player')
    return (count ?? 0) > 0
  }

  async venueExists(venueId: string) {
    const { count, error } = await this.client
      .from('venues')
      .select('*', { count: 'exact', head: true })
      .eq('entity_id', venueId)
    assertNoError(error, 'check venue')
    return (count ?? 0) > 0
  }

  async createMatchEntity(matchId: string) {
    const { error } = await this.client
      .from('entities')
      .upsert({ entity_id: matchId, entity_type: 'match' })
    assertNoError(error, 'upsert match entity')
  }

  async upsertMatch(match: MatchInsert) {
    const { error } = await this.client.from('matches').upsert(match)
    assertNoError(error, 'upsert match')
  }

  async updateMatch(matchId: string, patch: MatchUpdate) {
    const { error } = await this.client.from('matches').update(patch).eq('entity_id', matchId)
    assertNoError(error, 'update match')
  }

  async listMatchPlayers(matchId: string) {
    const { data, error } = await this.client
      .from('match_players')
      .select('*')
      .eq('match_id', matchId)
      .order('squad_role')
      .order('shirt_number', { ascending: true, nullsFirst: false })
    assertNoError(error, 'list match players')
    return data ?? []
  }

  async upsertMatchPlayers(players: MatchPlayerInsert[]) {
    if (players.length === 0) return
    const { error } = await this.client.from('match_players').upsert(players, {
      onConflict: 'match_player_id',
    })
    assertNoError(error, 'upsert match players')
  }

  async listMatchEvents(matchId: string) {
    const { data, error } = await this.client
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('minute', { ascending: true, nullsFirst: false })
    assertNoError(error, 'list match events')
    return data ?? []
  }

  async upsertMatchEvent(event: MatchEventInsert) {
    const { error } = await this.client.from('match_events').upsert(event, {
      onConflict: 'event_id',
    })
    assertNoError(error, 'upsert match event')
  }

  async getMatchResult(matchId: string) {
    const { data, error } = await this.client
      .from('match_results')
      .select('*')
      .eq('match_id', matchId)
      .maybeSingle()
    assertNoError(error, 'get match result')
    return data
  }

  async upsertMatchResult(result: MatchResultInsert) {
    const { error } = await this.client.from('match_results').upsert(result, {
      onConflict: 'match_id',
    })
    assertNoError(error, 'upsert match result')
  }

  async getSourceObservations(observationIds: string[]) {
    if (observationIds.length === 0) return []
    const { data, error } = await this.client
      .from('source_observations')
      .select('*')
      .in('observation_id', observationIds)
    assertNoError(error, 'get source observations')
    return data ?? []
  }

  async acceptMatchObservations(matchId: string, observationIds: string[]) {
    if (observationIds.length === 0) return
    const { error } = await this.client
      .from('source_observations')
      .update({ subject_entity_id: matchId, status: 'accepted' })
      .in('observation_id', observationIds)
    assertNoError(error, 'accept match observations')
  }

  async upsertValidationIssue(issue: ValidationIssueInsert) {
    const { error } = await this.client.from('validation_issues').upsert(issue, {
      onConflict: 'validation_issue_id',
    })
    assertNoError(error, 'upsert validation issue')
  }
}
