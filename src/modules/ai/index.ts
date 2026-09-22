export { AI_V01, AiGuardrailError, extractBackedFacts, normalizeIdentity } from './core'
export { AiV01Service } from './pipeline'
export type { AiRepository } from './repository'
export type {
  AiDecision,
  AiRunOptions,
  AiRunResult,
  AiSubjectDecision,
  ConfidenceBreakdown,
  ExtractedFact,
  IdentityCandidate,
} from './types'

export const AI_MODULE = {
  name: 'ai',
  responsibility:
    'Source-backed extraction, normalization, identity resolution, confidence and assisted validation',
  version: '0.1',
} as const
