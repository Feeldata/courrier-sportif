import type { Json, Tables, TablesInsert } from '@/lib/supabase/database.types'

export type AiEntityType = 'player' | 'club' | 'team' | 'competition' | 'season' | 'venue' | 'match'

export type SourceRow = Tables<'sources'>
export type SourceRecordRow = Tables<'source_records'>
export type SourceObservationRow = Tables<'source_observations'>
export type ValidationIssueInsert = TablesInsert<'validation_issues'>

export type AiDecision = 'automatic' | 'candidate' | 'review_required' | 'already_resolved'
export type IdentityMatchKind = 'canonical' | 'alias' | 'linked'

export interface AiSourceContext {
  source: SourceRow
  sourceRecord: SourceRecordRow
  observations: SourceObservationRow[]
}

export interface ExtractedFact {
  observationId: string
  sourceRecordId: string
  subjectKey: string
  entityType: AiEntityType
  fieldName: string
  rawValue: Json
  normalizedValue: Json | null
  identityKey: string | null
  confidence: number | null
  status: string
  subjectEntityId: string | null
}

export interface IdentityCandidate {
  entityId: string
  entityType: AiEntityType
  displayName: string
  normalizedIdentity: string
  matchKind: IdentityMatchKind
  matchConfidence: number
}

export interface ConfidenceBreakdown {
  observation: number
  source: number
  identity: number
  overall: number
}

export interface AiSubjectDecision {
  subjectKey: string
  entityType: AiEntityType
  observationIds: string[]
  identityObservationIds: string[]
  identityValue: string | null
  normalizedIdentity: string | null
  candidates: IdentityCandidate[]
  linkedEntityIds: string[]
  confidence: ConfidenceBreakdown
  decision: AiDecision
  reasonCode: string
  canonicalEntityId: string | null
  validationIssueId: string | null
}

export interface AiRunResult {
  sourceRecordId: string
  sourceId: string
  apply: boolean
  extractedFacts: ExtractedFact[]
  decisions: AiSubjectDecision[]
  automaticCount: number
  candidateCount: number
  reviewCount: number
}

export interface AiRunOptions {
  apply?: boolean
  now?: string
}
