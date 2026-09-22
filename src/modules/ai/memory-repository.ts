import type { AiRepository } from './repository'
import type {
  AiEntityType,
  AiSourceContext,
  IdentityCandidate,
  SourceObservationRow,
  SourceRecordRow,
  SourceRow,
  ValidationIssueInsert,
} from './types'

export class MemoryAiRepository implements AiRepository {
  readonly sources = new Map<string, SourceRow>()
  readonly sourceRecords = new Map<string, SourceRecordRow>()
  readonly sourceObservations = new Map<string, SourceObservationRow>()
  readonly identityCandidates = new Map<string, IdentityCandidate[]>()
  readonly validationIssues = new Map<string, ValidationIssueInsert>()

  async getSourceContext(sourceRecordId: string): Promise<AiSourceContext | null> {
    const sourceRecord = this.sourceRecords.get(sourceRecordId)
    if (!sourceRecord) return null
    const source = this.sources.get(sourceRecord.source_id)
    if (!source) return null

    return {
      source,
      sourceRecord,
      observations: [...this.sourceObservations.values()].filter(
        (observation) => observation.source_record_id === sourceRecordId,
      ),
    }
  }

  async findIdentityCandidates(entityType: AiEntityType, normalizedIdentity: string) {
    return structuredClone(
      this.identityCandidates.get(`${entityType}:${normalizedIdentity}`) ?? [],
    )
  }

  async linkObservations(observationIds: string[], entityId: string) {
    for (const observationId of observationIds) {
      const observation = this.sourceObservations.get(observationId)
      if (!observation) throw new Error(`Observation ${observationId} missing`)
      this.sourceObservations.set(observationId, {
        ...observation,
        subject_entity_id: entityId,
      })
    }
  }

  async acceptObservations(observationIds: string[]) {
    for (const observationId of observationIds) {
      const observation = this.sourceObservations.get(observationId)
      if (!observation) throw new Error(`Observation ${observationId} missing`)
      this.sourceObservations.set(observationId, {
        ...observation,
        status: 'accepted',
      })
    }
  }

  async upsertValidationIssue(issue: ValidationIssueInsert) {
    if (!issue.validation_issue_id) throw new Error('validation_issue_id required')
    this.validationIssues.set(issue.validation_issue_id, structuredClone(issue))
  }
}
