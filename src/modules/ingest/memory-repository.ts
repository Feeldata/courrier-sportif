import { normalizeIdentity } from './core.ts'
import type { IngestRepository } from './repository.ts'
import type {
  CompetitionIdentity,
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'

export class MemoryIngestRepository implements IngestRepository {
  readonly sources = new Map<string, SourceDefinition>()
  readonly sourceRecords = new Map<string, SourceRecordDraft>()
  readonly observations = new Map<string, ObservationDraft>()
  readonly competitions = new Map<
    string,
    CompetitionIdentity & { competitionType: 'league'; organizerName: string }
  >()
  readonly entities = new Map<string, 'competition'>()
  readonly reviewIssues = new Map<string, ReviewIssueDraft>()

  async upsertSource(source: SourceDefinition): Promise<void> {
    this.sources.set(source.sourceId, structuredClone(source))
  }

  async upsertSourceRecord(record: SourceRecordDraft): Promise<void> {
    this.sourceRecords.set(record.sourceRecordId, structuredClone(record))
  }

  async upsertObservations(observations: ObservationDraft[]): Promise<void> {
    for (const item of observations)
      this.observations.set(item.observationId, structuredClone(item))
  }

  async findCompetitionCandidates(normalizedName: string): Promise<CompetitionIdentity[]> {
    return [...this.competitions.values()].filter(
      (candidate) => normalizeIdentity(candidate.name) === normalizedName,
    )
  }

  async upsertEntity(input: { entityId: string; entityType: 'competition' }): Promise<void> {
    this.entities.set(input.entityId, input.entityType)
  }

  async upsertCompetition(input: {
    entityId: string
    name: string
    competitionType: 'league'
    countryCode: 'CM'
    organizerName: string
  }): Promise<void> {
    this.competitions.set(input.entityId, {
      entityId: input.entityId,
      name: input.name,
      competitionType: input.competitionType,
      countryCode: input.countryCode,
      organizerName: input.organizerName,
      gender: 'male',
      ageCategory: 'senior',
    })
  }

  async acceptObservations(observationIds: string[], entityId: string): Promise<void> {
    for (const id of observationIds) {
      const item = this.observations.get(id)
      if (item)
        this.observations.set(id, { ...item, status: 'accepted', subjectEntityId: entityId })
    }
  }

  async upsertReviewIssue(issue: ReviewIssueDraft): Promise<void> {
    this.reviewIssues.set(issue.validationIssueId, structuredClone(issue))
  }
}
