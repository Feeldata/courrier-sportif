import type {
  AiEntityType,
  AiSourceContext,
  IdentityCandidate,
  ValidationIssueInsert,
} from './types'

export interface AiRepository {
  getSourceContext(sourceRecordId: string): Promise<AiSourceContext | null>
  findIdentityCandidates(
    entityType: AiEntityType,
    normalizedIdentity: string,
  ): Promise<IdentityCandidate[]>
  linkObservations(observationIds: string[], entityId: string): Promise<void>
  acceptObservations(observationIds: string[]): Promise<void>
  upsertValidationIssue(issue: ValidationIssueInsert): Promise<void>
}
