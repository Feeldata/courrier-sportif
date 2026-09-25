import { normalizeIdentity } from './core.ts'
import type { CatalogueRepository, IdentityKind, MatchRow } from './catalogue-v02-repository.ts'
import type {
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'

export class MemoryCatalogueRepository implements CatalogueRepository {
  readonly sources = new Map<string, SourceDefinition>()
  readonly sourceRecords = new Map<string, SourceRecordDraft>()
  readonly observations = new Map<string, ObservationDraft>()
  readonly reviewIssues = new Map<string, ReviewIssueDraft>()
  readonly approvals = new Map<string, { entityId: string; createNew: boolean }>()
  readonly entities = new Map<string, string>()
  readonly competitions = new Set<string>()
  readonly seasons = new Map<string, { competitionId: string; name: string }>()
  readonly clubs = new Map<string, string>()
  readonly teams = new Map<string, { name: string; clubId: string }>()
  readonly aliases = new Map<string, Set<string>>()
  readonly externalIds = new Map<string, Set<string>>()
  readonly entries = new Map<string, { seasonId: string; teamId: string }>()
  readonly matches = new Map<string, MatchRow & { kickoffPrecision: 'date' | 'exact' }>()

  async upsertSource(source: SourceDefinition): Promise<void> {
    this.sources.set(source.sourceId, structuredClone(source))
  }
  async findSourceRecordByUrl(sourceId: string, url: string): Promise<SourceRecordDraft | null> {
    return (
      [...this.sourceRecords.values()].find((x) => x.sourceId === sourceId && x.url === url) ?? null
    )
  }
  async upsertSourceRecord(record: SourceRecordDraft): Promise<void> {
    const previous = await this.findSourceRecordByUrl(record.sourceId, record.url)
    if (previous && previous.contentHash !== record.contentHash) throw new Error('URL hash changed')
    this.sourceRecords.set(record.sourceRecordId, structuredClone(record))
  }
  async upsertObservations(observations: ObservationDraft[]): Promise<void> {
    for (const item of observations)
      this.observations.set(item.observationId, structuredClone(item))
  }
  async acceptObservations(ids: string[], entityId: string): Promise<void> {
    for (const id of ids) {
      const item = this.observations.get(id)
      if (item)
        this.observations.set(id, { ...item, status: 'accepted', subjectEntityId: entityId })
    }
  }
  async upsertReviewIssue(issue: ReviewIssueDraft): Promise<void> {
    this.reviewIssues.set(issue.validationIssueId, structuredClone(issue))
  }
  async hasCompetition(id: string): Promise<boolean> {
    return this.competitions.has(id)
  }
  async findSeasons(competitionId: string, name: string): Promise<string[]> {
    return [...this.seasons]
      .filter(([, row]) => row.competitionId === competitionId && row.name === name)
      .map(([id]) => id)
  }
  async upsertEntity(input: {
    entityId: string
    entityType: 'season' | 'club' | 'team' | 'match'
  }): Promise<void> {
    this.entities.set(input.entityId, input.entityType)
  }
  async upsertSeason(input: {
    entityId: string
    competitionId: string
    name: string
  }): Promise<void> {
    this.seasons.set(input.entityId, { competitionId: input.competitionId, name: input.name })
  }
  async getEntityType(id: string): Promise<string | null> {
    return this.entities.get(id) ?? null
  }
  async findIdentityApproval(
    issueId: string,
  ): Promise<{ entityId: string; createNew: boolean } | null> {
    return this.approvals.get(issueId) ?? null
  }
  async findIdentityMatches(
    kind: IdentityKind,
    normalizedName: string,
    externalId?: string,
  ): Promise<string[]> {
    const rows =
      kind === 'club'
        ? [...this.clubs].map(([id, name]) => ({ id, name }))
        : [...this.teams].map(([id, row]) => ({ id, name: row.name }))
    const ids = rows.filter((x) => normalizeIdentity(x.name) === normalizedName).map((x) => x.id)
    ids.push(...(this.aliases.get(`${kind}:${normalizedName}`) ?? []))
    if (externalId) ids.push(...(this.externalIds.get(`${kind}:${externalId}`) ?? []))
    return [...new Set(ids)]
  }
  async upsertClub(input: { entityId: string; officialName: string }): Promise<void> {
    this.clubs.set(input.entityId, input.officialName)
  }
  async upsertTeam(input: { entityId: string; name: string; clubId: string }): Promise<void> {
    this.teams.set(input.entityId, { name: input.name, clubId: input.clubId })
  }
  async getTeamClubId(teamId: string): Promise<string | null> {
    return this.teams.get(teamId)?.clubId ?? null
  }
  async addIdentityNames(
    kind: IdentityKind,
    id: string,
    name: string,
    externalId?: string,
  ): Promise<void> {
    const key = `${kind}:${normalizeIdentity(name)}`
    this.aliases.set(key, new Set([...(this.aliases.get(key) ?? []), id]))
    if (externalId) {
      const ext = `${kind}:${externalId}`
      this.externalIds.set(ext, new Set([...(this.externalIds.get(ext) ?? []), id]))
    }
  }
  async upsertEntry(input: { entryId: string; seasonId: string; teamId: string }): Promise<void> {
    this.entries.set(input.entryId, { seasonId: input.seasonId, teamId: input.teamId })
  }
  async hasEntry(seasonId: string, teamId: string): Promise<boolean> {
    return [...this.entries.values()].some((x) => x.seasonId === seasonId && x.teamId === teamId)
  }
  async listTeamNames(): Promise<string[]> {
    return [
      ...new Set([
        ...[...this.teams.values()].map((x) => x.name),
        ...[...this.aliases.keys()].filter((x) => x.startsWith('team:')).map((x) => x.slice(5)),
      ]),
    ]
  }
  async findLogicalMatches(
    input: Pick<MatchRow, 'seasonId' | 'matchday' | 'homeTeamId' | 'awayTeamId'>,
  ): Promise<MatchRow[]> {
    return [...this.matches.values()].filter(
      (x) =>
        x.seasonId === input.seasonId &&
        x.matchday === input.matchday &&
        x.homeTeamId === input.homeTeamId &&
        x.awayTeamId === input.awayTeamId,
    )
  }
  async findMatchById(id: string): Promise<MatchRow | null> {
    return this.matches.get(id) ?? null
  }
  async getSchedulePriority(matchId: string): Promise<number> {
    const records = [...this.observations.values()]
      .filter(
        (x) =>
          x.subjectEntityId === matchId &&
          x.status === 'accepted' &&
          x.fieldName === 'scheduled_date',
      )
      .map((x) => this.sourceRecords.get(x.sourceRecordId))
    return Math.max(0, ...records.map((x) => Number(x?.metadata.planning_priority ?? 0)))
  }
  async upsertMatch(input: MatchRow & { kickoffPrecision: 'date' | 'exact' }): Promise<void> {
    this.matches.set(input.entityId, structuredClone(input))
  }
}
