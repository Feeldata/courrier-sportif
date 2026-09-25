import type { IngestRepository } from './repository.ts'
import type { SourceRecordDraft } from './types.ts'

export type IdentityKind = 'club' | 'team'
export type MatchRow = {
  entityId: string
  seasonId: string
  homeTeamId: string
  awayTeamId: string
  matchday: number
  scheduledDate: string | null
  kickoffAt: string | null
  status?: string
}

export interface CatalogueRepository extends Pick<
  IngestRepository,
  | 'upsertSource'
  | 'upsertSourceRecord'
  | 'upsertObservations'
  | 'upsertReviewIssue'
  | 'acceptObservations'
> {
  findSourceRecordByUrl(sourceId: string, url: string): Promise<SourceRecordDraft | null>
  hasCompetition(id: string): Promise<boolean>
  findSeasons(competitionId: string, name: string): Promise<string[]>
  upsertEntity(input: {
    entityId: string
    entityType: 'season' | 'club' | 'team' | 'match'
  }): Promise<void>
  upsertSeason(input: { entityId: string; competitionId: string; name: string }): Promise<void>
  findIdentityMatches(
    kind: IdentityKind,
    normalizedName: string,
    externalId?: string,
  ): Promise<string[]>
  findIdentityApproval(issueId: string): Promise<{ entityId: string; createNew: boolean } | null>
  getEntityType(id: string): Promise<string | null>
  upsertClub(input: { entityId: string; officialName: string }): Promise<void>
  upsertTeam(input: { entityId: string; name: string; clubId: string }): Promise<void>
  getTeamClubId(teamId: string): Promise<string | null>
  addIdentityNames(kind: IdentityKind, id: string, name: string, externalId?: string): Promise<void>
  upsertEntry(input: { entryId: string; seasonId: string; teamId: string }): Promise<void>
  hasEntry(seasonId: string, teamId: string): Promise<boolean>
  listTeamNames(): Promise<string[]>
  findLogicalMatches(
    input: Pick<MatchRow, 'seasonId' | 'matchday' | 'homeTeamId' | 'awayTeamId'>,
  ): Promise<MatchRow[]>
  findMatchById(id: string): Promise<MatchRow | null>
  getSchedulePriority(matchId: string): Promise<number>
  upsertMatch(input: MatchRow & { kickoffPrecision: 'date' | 'exact' }): Promise<void>
}
