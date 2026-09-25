import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeIdentity } from './core.ts'
import type { IngestRepository } from './repository.ts'
import type {
  CompetitionIdentity,
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'
import type { Database, Json } from '../../lib/supabase/database.types.ts'

function asJson(value: unknown): Json {
  return value as Json
}

function assertNoError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

export class SupabaseIngestRepository implements IngestRepository {
  private readonly client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async upsertSource(source: SourceDefinition): Promise<void> {
    const { error } = await this.client.from('sources').upsert({
      source_id: source.sourceId,
      name: source.name,
      source_type: source.sourceType,
      base_url: source.baseUrl,
      publisher: source.publisher,
      reliability_level: source.reliabilityLevel,
      status: source.status,
    })
    assertNoError(error, 'upsert source')
  }

  async upsertSourceRecord(record: SourceRecordDraft): Promise<void> {
    const { error } = await this.client.from('source_records').upsert({
      source_record_id: record.sourceRecordId,
      source_id: record.sourceId,
      record_type: record.recordType,
      url: record.url,
      external_ref: record.externalRef,
      published_at: record.publishedAt,
      collected_at: record.collectedAt,
      content_hash: record.contentHash,
      metadata: asJson(record.metadata),
    })
    assertNoError(error, 'upsert source record')
  }

  async upsertObservations(observations: ObservationDraft[]): Promise<void> {
    if (observations.length === 0) return
    const { error } = await this.client.from('source_observations').upsert(
      observations.map((item) => ({
        observation_id: item.observationId,
        source_record_id: item.sourceRecordId,
        subject_entity_id: item.subjectEntityId,
        subject_entity_type: item.subjectEntityType,
        subject_key: item.subjectKey,
        field_name: item.fieldName,
        raw_value: asJson(item.rawValue),
        normalized_value: asJson(item.normalizedValue),
        confidence: item.confidence,
        status: item.status,
        observed_at: item.observedAt,
      })),
    )
    assertNoError(error, 'upsert observations')
  }

  async findCompetitionCandidates(normalizedName: string): Promise<CompetitionIdentity[]> {
    const { data, error } = await this.client
      .from('competitions')
      .select('entity_id,name,country_code,gender,age_category')
    assertNoError(error, 'find competition candidates')
    const rows = (data ?? []) as Database['public']['Tables']['competitions']['Row'][]
    return rows
      .filter((row) => normalizeIdentity(row.name) === normalizedName)
      .map((row) => ({
        entityId: row.entity_id,
        name: row.name,
        countryCode: row.country_code,
        gender: row.gender,
        ageCategory: row.age_category,
      }))
  }

  async upsertEntity(input: { entityId: string; entityType: 'competition' }): Promise<void> {
    const { error } = await this.client
      .from('entities')
      .upsert({ entity_id: input.entityId, entity_type: input.entityType })
    assertNoError(error, 'upsert entity')
  }

  async upsertCompetition(input: {
    entityId: string
    name: string
    competitionType: 'league'
    countryCode: 'CM'
    organizerName: string
  }): Promise<void> {
    const { error } = await this.client.from('competitions').upsert({
      entity_id: input.entityId,
      name: input.name,
      competition_type: input.competitionType,
      country_code: input.countryCode,
      organizer_name: input.organizerName,
    })
    assertNoError(error, 'upsert competition')
  }

  async acceptObservations(observationIds: string[], entityId: string): Promise<void> {
    if (observationIds.length === 0) return
    const { error } = await this.client
      .from('source_observations')
      .update({ status: 'accepted', subject_entity_id: entityId })
      .in('observation_id', observationIds)
    assertNoError(error, 'accept observations')
  }

  async upsertReviewIssue(issue: ReviewIssueDraft): Promise<void> {
    const { error } = await this.client.from('validation_issues').upsert({
      validation_issue_id: issue.validationIssueId,
      entity_id: issue.entityId,
      subject_locator: asJson(issue.subjectLocator),
      rule_code: issue.ruleCode,
      severity: issue.severity,
      status: issue.status,
      message: issue.message,
      details: asJson(issue.details),
      detected_at: issue.detectedAt,
    })
    assertNoError(error, 'upsert review issue')
  }
}
