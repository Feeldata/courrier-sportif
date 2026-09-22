import { createHash } from 'node:crypto'

import type {
  AiEntityType,
  AiSourceContext,
  ConfidenceBreakdown,
  ExtractedFact,
  IdentityCandidate,
} from './types'

export const AI_V01 = {
  confidence: {
    automatic: 0.95,
    candidate: 0.8,
    canonicalIdentity: 1,
    aliasIdentity: 0.98,
  },
} as const

const IDENTITY_FIELDS = new Set([
  'name',
  'official_name',
  'display_name',
  'short_name',
  'competition_name',
  'club_name',
  'team_name',
  'player_name',
  'season_name',
  'venue_name',
])

export class AiGuardrailError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AiGuardrailError'
  }
}

export function normalizeIdentity(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

export function extractBackedFacts(context: AiSourceContext): ExtractedFact[] {
  return context.observations.flatMap((observation) => {
    if (observation.source_record_id !== context.sourceRecord.source_record_id) {
      throw new AiGuardrailError(
        'AI_OBSERVATION_SOURCE_MISMATCH',
        `Observation ${observation.observation_id} rattachée au mauvais source_record.`,
      )
    }

    if (observation.status === 'rejected') return []

    const rawString = stringValue(observation.raw_value)
    const normalizedString = stringValue(observation.normalized_value)
    const identitySource = normalizedString ?? rawString
    const identityKey =
      IDENTITY_FIELDS.has(observation.field_name) && identitySource
        ? normalizeIdentity(identitySource)
        : null

    const subjectKey =
      observation.subject_key ??
      (observation.subject_entity_id
        ? `entity:${observation.subject_entity_id}`
        : `observation:${observation.observation_id}`)

    return [
      {
        observationId: observation.observation_id,
        sourceRecordId: observation.source_record_id,
        subjectKey,
        entityType: observation.subject_entity_type as AiEntityType,
        fieldName: observation.field_name,
        rawValue: observation.raw_value,
        normalizedValue: observation.normalized_value,
        identityKey,
        confidence:
          observation.confidence === null || observation.confidence === undefined
            ? null
            : Number(observation.confidence),
        status: observation.status,
        subjectEntityId: observation.subject_entity_id,
      },
    ]
  })
}

export function sourceConfidence(context: AiSourceContext): number {
  if (context.source.status !== 'active') return 0
  switch (context.source.reliability_level) {
    case 5:
      return 1
    case 4:
      return 0.9
    case 3:
      return 0.75
    case 2:
      return 0.55
    case 1:
      return 0.35
    default:
      return 0.5
  }
}

export function scoreConfidence(input: {
  observationConfidence: number
  sourceConfidence: number
  identityConfidence: number
}): ConfidenceBreakdown {
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  const observation = clamp(input.observationConfidence)
  const source = clamp(input.sourceConfidence)
  const identity = clamp(input.identityConfidence)

  return {
    observation,
    source,
    identity,
    overall: Math.min(observation, source, identity),
  }
}

export function uniqueCandidates(candidates: IdentityCandidate[]): IdentityCandidate[] {
  const byEntity = new Map<string, IdentityCandidate>()
  for (const candidate of candidates) {
    const current = byEntity.get(candidate.entityId)
    if (!current || candidate.matchConfidence > current.matchConfidence) {
      byEntity.set(candidate.entityId, candidate)
    }
  }
  return [...byEntity.values()]
}

export function stableAiIssueId(
  sourceRecordId: string,
  subjectKey: string,
  ruleCode: string,
): string {
  const digest = createHash('sha256')
    .update(`courrier-sportif:ai:v0.1:${sourceRecordId}:${subjectKey}:${ruleCode}`)
    .digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
