import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeIdentity, stableUuid } from './core.ts'
import type { CatalogueRepository, IdentityKind, MatchRow } from './catalogue-v02-repository.ts'
import type {
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'
import type { Database, Json } from '../../lib/supabase/database.types.ts'

const STAGING_REF = 'dlilhxaixpnabefqloxs'
function guardStaging(clientUrl: string): void {
  if (
    process.env.NEXT_PUBLIC_APP_ENV !== 'staging' ||
    process.env.SUPABASE_PROJECT_REF !== STAGING_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${STAGING_REF}.supabase.co` ||
    clientUrl !== `https://${STAGING_REF}.supabase.co`
  ) {
    throw new Error('INGEST V0.2 Supabase adapter is restricted to authorized staging')
  }
}
function checked(error: { message: string } | null, scope: string): void {
  if (error) throw new Error(`${scope}: ${error.message}`)
}
function matchRow(row: Database['public']['Tables']['matches']['Row']): MatchRow {
  if (row.matchday === null)
    throw new Error('Match without matchday cannot be resolved automatically')
  return {
    entityId: row.entity_id,
    seasonId: row.season_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    matchday: row.matchday,
    scheduledDate: row.scheduled_date,
    kickoffAt: row.kickoff_at,
    status: row.status,
  }
}

export class SupabaseCatalogueRepository implements CatalogueRepository {
  private readonly client: SupabaseClient<Database>
  constructor(client: SupabaseClient<Database>) {
    guardStaging((client as unknown as { supabaseUrl?: string }).supabaseUrl ?? '')
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
    checked(error, 'upsert source')
  }
  async upsertObservations(rows: ObservationDraft[]): Promise<void> {
    if (!rows.length) return
    const { error } = await this.client.from('source_observations').upsert(
      rows.map((item) => ({
        observation_id: item.observationId,
        source_record_id: item.sourceRecordId,
        subject_entity_id: item.subjectEntityId,
        subject_entity_type: item.subjectEntityType,
        subject_key: item.subjectKey,
        field_name: item.fieldName,
        raw_value: item.rawValue as Json,
        normalized_value: item.normalizedValue as Json,
        confidence: item.confidence,
        status: item.status,
        observed_at: item.observedAt,
      })),
    )
    checked(error, 'upsert observations')
  }
  async acceptObservations(ids: string[], entityId: string): Promise<void> {
    if (!ids.length) return
    const { error } = await this.client
      .from('source_observations')
      .update({ status: 'accepted', subject_entity_id: entityId })
      .in('observation_id', ids)
    checked(error, 'accept observations')
  }
  async upsertReviewIssue(issue: ReviewIssueDraft): Promise<void> {
    const { error } = await this.client.from('validation_issues').upsert({
      validation_issue_id: issue.validationIssueId,
      entity_id: issue.entityId,
      subject_locator: issue.subjectLocator as Json,
      rule_code: issue.ruleCode,
      severity: issue.severity,
      status: issue.status,
      message: issue.message,
      details: issue.details as Json,
      detected_at: issue.detectedAt,
    })
    checked(error, 'upsert review issue')
  }
  async findSourceRecordByUrl(sourceId: string, url: string): Promise<SourceRecordDraft | null> {
    const { data, error } = await this.client
      .from('source_records')
      .select('*')
      .eq('source_id', sourceId)
      .eq('url', url)
      .maybeSingle()
    checked(error, 'find source record')
    if (!data) return null
    return {
      sourceRecordId: data.source_record_id,
      sourceId: data.source_id,
      recordType: data.record_type === 'pdf' ? 'pdf' : 'webpage',
      url: data.url ?? '',
      externalRef: data.external_ref,
      publishedAt: data.published_at,
      collectedAt: data.collected_at,
      contentHash: data.content_hash ?? '',
      metadata: data.metadata as Record<string, unknown>,
    }
  }
  async upsertSourceRecord(record: SourceRecordDraft): Promise<void> {
    const old = await this.findSourceRecordByUrl(record.sourceId, record.url)
    if (
      old &&
      (old.contentHash !== record.contentHash || old.sourceRecordId !== record.sourceRecordId)
    )
      throw new Error('INGEST_SOURCE_URL_CONTENT_CHANGED')
    const { error } = await this.client.from('source_records').upsert({
      source_record_id: record.sourceRecordId,
      source_id: record.sourceId,
      record_type: record.recordType,
      url: record.url,
      external_ref: record.externalRef,
      published_at: record.publishedAt,
      collected_at: record.collectedAt,
      content_hash: record.contentHash,
      metadata: record.metadata as Json,
    })
    checked(error, 'upsert source record')
  }
  async hasCompetition(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('competitions')
      .select('entity_id')
      .eq('entity_id', id)
      .maybeSingle()
    checked(error, 'find competition')
    return Boolean(data)
  }
  async findSeasons(competitionId: string, name: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('seasons')
      .select('entity_id')
      .eq('competition_id', competitionId)
      .eq('name', name)
    checked(error, 'find seasons')
    return (data ?? []).map((x) => x.entity_id)
  }
  async upsertEntity(input: {
    entityId: string
    entityType: 'season' | 'club' | 'team' | 'match'
  }): Promise<void> {
    const { error } = await this.client.from('entities').upsert({
      entity_id: input.entityId,
      entity_type: input.entityType,
    })
    checked(error, 'upsert entity')
  }
  async upsertSeason(input: {
    entityId: string
    competitionId: string
    name: string
  }): Promise<void> {
    const { error } = await this.client.from('seasons').upsert({
      entity_id: input.entityId,
      competition_id: input.competitionId,
      name: input.name,
      status: 'planned',
    })
    checked(error, 'upsert season')
  }
  async getEntityType(id: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('entities')
      .select('entity_type')
      .eq('entity_id', id)
      .maybeSingle()
    checked(error, 'find entity type')
    return data?.entity_type ?? null
  }
  async findIdentityApproval(
    issueId: string,
  ): Promise<{ entityId: string; createNew: boolean } | null> {
    const { data, error } = await this.client
      .from('validation_issues')
      .select('status,resolved_at,details')
      .eq('validation_issue_id', issueId)
      .maybeSingle()
    checked(error, 'find human approval')
    if (!data || data.status !== 'resolved' || !data.resolved_at) return null
    const details = data.details as Record<string, unknown>
    if (
      typeof details.approved_entity_id !== 'string' ||
      typeof details.reviewed_by !== 'string' ||
      !details.reviewed_by ||
      typeof details.create_new !== 'boolean'
    )
      return null
    return { entityId: details.approved_entity_id, createNew: details.create_new }
  }
  async findIdentityMatches(
    kind: IdentityKind,
    normalizedName: string,
    externalId?: string,
  ): Promise<string[]> {
    const [canonical, aliases, external] = await Promise.all([
      kind === 'club'
        ? this.client.from('clubs').select('entity_id,official_name')
        : this.client.from('teams').select('entity_id,name'),
      this.client.from('entity_aliases').select('entity_id').eq('normalized_alias', normalizedName),
      externalId
        ? this.client
            .from('external_ids')
            .select('entity_id')
            .eq('provider', 'fecafoot')
            .eq('entity_type', kind)
            .eq('external_value', externalId)
        : Promise.resolve({ data: [], error: null }),
    ])
    checked(canonical.error, 'find canonical names')
    checked(aliases.error, 'find aliases')
    checked(external.error, 'find external ids')
    const ids = (canonical.data ?? [])
      .filter(
        (row) =>
          normalizeIdentity('official_name' in row ? row.official_name : row.name) ===
          normalizedName,
      )
      .map((row) => row.entity_id)
    ids.push(...(external.data ?? []).map((row) => row.entity_id))
    for (const row of aliases.data ?? []) {
      if ((await this.getEntityType(row.entity_id)) === kind) ids.push(row.entity_id)
    }
    return [...new Set(ids)]
  }
  async upsertClub(input: { entityId: string; officialName: string }): Promise<void> {
    const { error } = await this.client.from('clubs').upsert({
      entity_id: input.entityId,
      official_name: input.officialName,
      country_code: 'CM',
      status: 'active',
    })
    checked(error, 'upsert club')
  }
  async upsertTeam(input: { entityId: string; name: string; clubId: string }): Promise<void> {
    const { error } = await this.client.from('teams').upsert({
      entity_id: input.entityId,
      name: input.name,
      club_id: input.clubId,
      team_scope: 'club',
      country_code: 'CM',
      gender: 'male',
      age_category: 'senior',
      status: 'active',
    })
    checked(error, 'upsert team')
  }
  async getTeamClubId(teamId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('teams')
      .select('club_id')
      .eq('entity_id', teamId)
      .maybeSingle()
    checked(error, 'find team club')
    return data?.club_id ?? null
  }
  async addIdentityNames(
    kind: IdentityKind,
    id: string,
    name: string,
    externalId?: string,
  ): Promise<void> {
    const normalized = normalizeIdentity(name)
    const matches = await this.findIdentityMatches(kind, normalized, externalId)
    if (matches.some((match) => match !== id))
      throw new Error('Alias or external ID already maps to another identity')
    const { error: aliasError } = await this.client.from('entity_aliases').upsert({
      alias_id: stableUuid(`alias:${kind}:${id}:${normalized}`),
      entity_id: id,
      alias: name,
      normalized_alias: normalized,
      alias_type: 'official',
    })
    checked(aliasError, 'upsert alias')
    if (externalId) {
      const { error } = await this.client.from('external_ids').upsert({
        external_id_id: stableUuid(`external:fecafoot:${kind}:${externalId}`),
        entity_id: id,
        entity_type: kind,
        provider: 'fecafoot',
        external_value: externalId,
      })
      checked(error, 'upsert external ID')
    }
  }
  async upsertEntry(input: { entryId: string; seasonId: string; teamId: string }): Promise<void> {
    const { error } = await this.client.from('team_season_entries').upsert({
      entry_id: input.entryId,
      season_id: input.seasonId,
      team_id: input.teamId,
      entry_status: 'active',
    })
    checked(error, 'upsert season entry')
  }
  async hasEntry(seasonId: string, teamId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('team_season_entries')
      .select('entry_id')
      .eq('season_id', seasonId)
      .eq('team_id', teamId)
      .maybeSingle()
    checked(error, 'find season entry')
    return Boolean(data)
  }
  async listTeamNames(): Promise<string[]> {
    const [teams, aliases] = await Promise.all([
      this.client.from('teams').select('name'),
      this.client.from('entity_aliases').select('entity_id,alias'),
    ])
    checked(teams.error, 'list team names')
    checked(aliases.error, 'list team aliases')
    const names = (teams.data ?? []).map((x) => x.name)
    for (const alias of aliases.data ?? []) {
      if ((await this.getEntityType(alias.entity_id)) === 'team') names.push(alias.alias)
    }
    return [...new Set(names)]
  }
  async findLogicalMatches(
    input: Pick<MatchRow, 'seasonId' | 'matchday' | 'homeTeamId' | 'awayTeamId'>,
  ): Promise<MatchRow[]> {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('season_id', input.seasonId)
      .eq('matchday', input.matchday)
      .eq('home_team_id', input.homeTeamId)
      .eq('away_team_id', input.awayTeamId)
    checked(error, 'find logical matches')
    return (data ?? []).map(matchRow)
  }
  async findMatchById(id: string): Promise<MatchRow | null> {
    const { data, error } = await this.client
      .from('matches')
      .select('*')
      .eq('entity_id', id)
      .maybeSingle()
    checked(error, 'find match ID')
    return data ? matchRow(data) : null
  }
  async getSchedulePriority(matchId: string): Promise<number> {
    const { data, error } = await this.client
      .from('source_observations')
      .select('source_record_id')
      .eq('subject_entity_id', matchId)
      .eq('field_name', 'scheduled_date')
      .eq('status', 'accepted')
    checked(error, 'find accepted planning evidence')
    const ids = [...new Set((data ?? []).map((x) => x.source_record_id))]
    if (!ids.length) return 0
    const records = await this.client
      .from('source_records')
      .select('metadata')
      .in('source_record_id', ids)
    checked(records.error, 'find planning source records')
    return Math.max(
      0,
      ...(records.data ?? []).map((x) =>
        Number((x.metadata as Record<string, Json>).planning_priority ?? 0),
      ),
    )
  }
  async upsertMatch(input: MatchRow & { kickoffPrecision: 'date' | 'exact' }): Promise<void> {
    const { error } = await this.client.from('matches').upsert({
      entity_id: input.entityId,
      season_id: input.seasonId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      matchday: input.matchday,
      scheduled_date: input.scheduledDate,
      kickoff_at: input.kickoffAt,
      kickoff_precision: input.kickoffPrecision,
      venue_id: null,
      status: 'scheduled',
    })
    checked(error, 'upsert match')
  }
}
