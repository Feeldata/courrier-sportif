import type {
  CompetitionIdentity,
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'

export interface IngestRepository {
  upsertSource(source: SourceDefinition): Promise<void>
  upsertSourceRecord(record: SourceRecordDraft): Promise<void>
  upsertObservations(observations: ObservationDraft[]): Promise<void>
  findCompetitionCandidates(normalizedName: string): Promise<CompetitionIdentity[]>
  upsertEntity(input: { entityId: string; entityType: 'competition' }): Promise<void>
  upsertCompetition(input: {
    entityId: string
    name: string
    competitionType: 'league'
    countryCode: 'CM'
    organizerName: string
  }): Promise<void>
  acceptObservations(observationIds: string[], entityId: string): Promise<void>
  upsertReviewIssue(issue: ReviewIssueDraft): Promise<void>
}
