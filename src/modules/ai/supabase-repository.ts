import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '@/lib/supabase/database.types'

import { AI_V01, normalizeIdentity } from './core'
import type { AiRepository } from './repository'
import type {
  AiEntityType,
  AiSourceContext,
  IdentityCandidate,
  ValidationIssueInsert,
} from './types'

function assertNoError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

function asJson(value: unknown): Json {
  return value as Json
}

function candidate(
  entityId: string,
  entityType: AiEntityType,
  displayName: string,
  normalizedIdentity: string,
): IdentityCandidate {
  return {
    entityId,
    entityType,
    displayName,
    normalizedIdentity,
    matchKind: 'canonical',
    matchConfidence: AI_V01.confidence.canonicalIdentity,
  }
}

export class SupabaseAiRepository implements AiRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getSourceContext(sourceRecordId: string): Promise<AiSourceContext | null> {
    const recordResponse = await this.client
      .from('source_records')
      .select('*')
      .eq('source_record_id', sourceRecordId)
      .maybeSingle()
    assertNoError(recordResponse.error, 'AI get source_record')
    if (!recordResponse.data) return null

    const [sourceResponse, observationsResponse] = await Promise.all([
      this.client
        .from('sources')
        .select('*')
        .eq('source_id', recordResponse.data.source_id)
        .maybeSingle(),
      this.client
        .from('source_observations')
        .select('*')
        .eq('source_record_id', sourceRecordId)
        .order('created_at'),
    ])
    assertNoError(sourceResponse.error, 'AI get source')
    assertNoError(observationsResponse.error, 'AI get observations')
    if (!sourceResponse.data) return null

    return {
      source: sourceResponse.data,
      sourceRecord: recordResponse.data,
      observations: observationsResponse.data ?? [],
    }
  }

  private async canonicalCandidates(
    entityType: AiEntityType,
    normalizedIdentity: string,
  ): Promise<IdentityCandidate[]> {
    switch (entityType) {
      case 'competition': {
        const { data, error } = await this.client
          .from('competitions')
          .select('entity_id,name,short_name')
        assertNoError(error, 'AI find competition identities')
        return (data ?? []).flatMap((row) => {
          const names = [row.name, row.short_name].filter((value): value is string => Boolean(value))
          return names.some((name) => normalizeIdentity(name) === normalizedIdentity)
            ? [candidate(row.entity_id, entityType, row.name, normalizedIdentity)]
            : []
        })
      }
      case 'club': {
        const { data, error } = await this.client
          .from('clubs')
          .select('entity_id,official_name,short_name')
        assertNoError(error, 'AI find club identities')
        return (data ?? []).flatMap((row) => {
          const names = [row.official_name, row.short_name].filter(
            (value): value is string => Boolean(value),
          )
          return names.some((name) => normalizeIdentity(name) === normalizedIdentity)
            ? [candidate(row.entity_id, entityType, row.official_name, normalizedIdentity)]
            : []
        })
      }
      case 'team': {
        const { data, error } = await this.client.from('teams').select('entity_id,name')
        assertNoError(error, 'AI find team identities')
        return (data ?? []).flatMap((row) =>
          normalizeIdentity(row.name) === normalizedIdentity
            ? [candidate(row.entity_id, entityType, row.name, normalizedIdentity)]
            : [],
        )
      }
      case 'player': {
        const { data, error } = await this.client
          .from('players')
          .select('entity_id,display_name,first_name,last_name')
        assertNoError(error, 'AI find player identities')
        return (data ?? []).flatMap((row) => {
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
          const names = [row.display_name, fullName || null].filter(
            (value): value is string => Boolean(value),
          )
          return names.some((name) => normalizeIdentity(name) === normalizedIdentity)
            ? [candidate(row.entity_id, entityType, row.display_name, normalizedIdentity)]
            : []
        })
      }
      case 'season': {
        const { data, error } = await this.client.from('seasons').select('entity_id,name')
        assertNoError(error, 'AI find season identities')
        return (data ?? []).flatMap((row) =>
          normalizeIdentity(row.name) === normalizedIdentity
            ? [candidate(row.entity_id, entityType, row.name, normalizedIdentity)]
            : [],
        )
      }
      case 'venue': {
        const { data, error } = await this.client.from('venues').select('entity_id,name')
        assertNoError(error, 'AI find venue identities')
        return (data ?? []).flatMap((row) =>
          normalizeIdentity(row.name) === normalizedIdentity
            ? [candidate(row.entity_id, entityType, row.name, normalizedIdentity)]
            : [],
        )
      }
      case 'match':
        return []
    }
  }

  async findIdentityCandidates(
    entityType: AiEntityType,
    normalizedIdentity: string,
  ): Promise<IdentityCandidate[]> {
    const canonical = await this.canonicalCandidates(entityType, normalizedIdentity)
    const aliasResponse = await this.client
      .from('entity_aliases')
      .select('entity_id,alias,normalized_alias')
      .eq('normalized_alias', normalizedIdentity)
    assertNoError(aliasResponse.error, 'AI find aliases')

    const aliasRows = aliasResponse.data ?? []
    if (aliasRows.length === 0) return canonical

    const entityIds = [...new Set(aliasRows.map((row) => row.entity_id))]
    const entityResponse = await this.client
      .from('entities')
      .select('entity_id,entity_type')
      .in('entity_id', entityIds)
    assertNoError(entityResponse.error, 'AI verify alias entity types')
    const types = new Map(
      (entityResponse.data ?? []).map((row) => [row.entity_id, row.entity_type as AiEntityType]),
    )

    const aliases: IdentityCandidate[] = aliasRows.flatMap((row) =>
      types.get(row.entity_id) === entityType
        ? [
            {
              entityId: row.entity_id,
              entityType,
              displayName: row.alias,
              normalizedIdentity: row.normalized_alias,
              matchKind: 'alias' as const,
              matchConfidence: AI_V01.confidence.aliasIdentity,
            },
          ]
        : [],
    )

    return [...canonical, ...aliases]
  }

  async linkObservations(observationIds: string[], entityId: string) {
    if (observationIds.length === 0) return
    const { error } = await this.client
      .from('source_observations')
      .update({ subject_entity_id: entityId })
      .in('observation_id', observationIds)
    assertNoError(error, 'AI link observations')
  }

  async acceptObservations(observationIds: string[]) {
    if (observationIds.length === 0) return
    const { error } = await this.client
      .from('source_observations')
      .update({ status: 'accepted' })
      .in('observation_id', observationIds)
    assertNoError(error, 'AI accept observations')
  }

  async upsertValidationIssue(issue: ValidationIssueInsert) {
    const { error } = await this.client.from('validation_issues').upsert({
      ...issue,
      subject_locator: asJson(issue.subject_locator),
      details: asJson(issue.details),
    })
    assertNoError(error, 'AI upsert validation issue')
  }
}
