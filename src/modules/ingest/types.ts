export type IngestEntityType =
  | 'player'
  | 'club'
  | 'team'
  | 'competition'
  | 'season'
  | 'venue'
  | 'match'

export type ObservationStatus = 'raw' | 'candidate' | 'accepted' | 'rejected'
export type ReviewSeverity = 'info' | 'warning' | 'error' | 'blocking'

export interface SourceDefinition {
  sourceId: string
  name: string
  sourceType: 'official_federation'
  baseUrl: string
  publisher: string
  reliabilityLevel: number
  status: 'active'
}

export interface FetchedSourceDocument {
  url: string
  title: string
  publishedAt: string | null
  publishedAtPrecision: 'exact' | 'date' | 'unknown'
  text: string
  externalRef?: string | null
  fetchedAt?: string
  captureMode?: 'live_html' | 'verified_excerpt'
}

export interface SourceRecordDraft {
  sourceRecordId: string
  sourceId: string
  recordType: 'webpage'
  url: string
  externalRef: string | null
  publishedAt: string | null
  collectedAt: string
  contentHash: string
  metadata: Record<string, unknown>
}

export interface ObservationDraft {
  observationId: string
  sourceRecordId: string
  subjectEntityId: string | null
  subjectEntityType: IngestEntityType
  subjectKey: string
  fieldName: string
  rawValue: unknown
  normalizedValue: unknown
  confidence: number
  status: ObservationStatus
  observedAt: string
}

export interface CompetitionCandidate {
  kind: 'competition'
  subjectKey: string
  canonicalId: string
  name: string
  competitionType: 'league'
  countryCode: 'CM'
  organizerName: string
  confidence: number
  evidenceObservationIds: string[]
  identityResolution:
    | { kind: 'existing_exact'; entityId: string; score: 1 }
    | { kind: 'new_deterministic'; entityId: string; score: number }
    | { kind: 'ambiguous'; entityIds: string[]; score: number }
}

export interface ReviewIssueDraft {
  validationIssueId: string
  entityId: string | null
  subjectLocator: Record<string, unknown>
  ruleCode: string
  severity: ReviewSeverity
  status: 'open'
  message: string
  details: Record<string, unknown>
  detectedAt: string
}

export interface CompetitionIdentity {
  entityId: string
  name: string
  countryCode: string | null
  gender: string
  ageCategory: string
}

export interface IngestWritePlan {
  source: SourceDefinition
  sourceRecord: SourceRecordDraft
  observations: ObservationDraft[]
  competitionCandidate: CompetitionCandidate | null
  reviewIssues: ReviewIssueDraft[]
}

export interface PipelineEvent {
  timestamp: string
  stage: 'fetch' | 'source_record' | 'extract' | 'normalize' | 'resolve' | 'validate' | 'write'
  level: 'info' | 'warning' | 'error'
  code: string
  message: string
  context?: Record<string, unknown>
}

export interface IngestRunResult {
  dryRun: boolean
  sourceRecordId: string
  observationIds: string[]
  canonicalEntityIds: string[]
  reviewIssueIds: string[]
  events: PipelineEvent[]
}
