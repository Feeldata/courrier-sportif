import {
  AI_V01,
  AiGuardrailError,
  extractBackedFacts,
  scoreConfidence,
  sourceConfidence,
  stableAiIssueId,
  uniqueCandidates,
} from './core'
import type { AiRepository } from './repository'
import type {
  AiRunOptions,
  AiRunResult,
  AiSourceContext,
  AiSubjectDecision,
  ExtractedFact,
  IdentityCandidate,
  ValidationIssueInsert,
} from './types'

function groupFacts(facts: ExtractedFact[]) {
  const groups = new Map<string, ExtractedFact[]>()
  for (const fact of facts) {
    const key = `${fact.entityType}:${fact.subjectKey}`
    groups.set(key, [...(groups.get(key) ?? []), fact])
  }
  return [...groups.values()]
}

function factStringValue(fact: ExtractedFact): string | null {
  if (typeof fact.normalizedValue === 'string') return fact.normalizedValue
  if (typeof fact.rawValue === 'string') return fact.rawValue.replace(/\s+/g, ' ').trim()
  return null
}

function observationConfidence(facts: ExtractedFact[]) {
  if (facts.length === 0) return 0
  return Math.min(...facts.map((fact) => fact.confidence ?? 0))
}

function issueSeverity(reasonCode: string): 'warning' | 'blocking' {
  return [
    'AI_IDENTITY_AMBIGUOUS',
    'AI_IDENTITY_EVIDENCE_CONFLICT',
    'AI_IDENTITY_LINK_CONFLICT',
    'AI_IDENTITY_LINK_IDENTITY_CONFLICT',
  ].includes(reasonCode)
    ? 'blocking'
    : 'warning'
}

function buildIssue(
  context: AiSourceContext,
  decision: AiSubjectDecision,
  now: string,
): ValidationIssueInsert {
  const issueId = stableAiIssueId(
    context.sourceRecord.source_record_id,
    decision.subjectKey,
    decision.reasonCode,
  )

  return {
    validation_issue_id: issueId,
    entity_id: decision.candidates.length === 1 ? (decision.candidates[0]?.entityId ?? null) : null,
    subject_locator: {
      source_record_id: context.sourceRecord.source_record_id,
      subject_key: decision.subjectKey,
      entity_type: decision.entityType,
    },
    rule_code: decision.reasonCode,
    severity: issueSeverity(decision.reasonCode),
    status: 'open',
    message:
      decision.decision === 'candidate'
        ? 'AI V0.1 propose une résolution candidate qui nécessite une confirmation humaine.'
        : 'AI V0.1 ne peut pas canoniser cette résolution sans revue humaine.',
    details: {
      action: 'human_review_required',
      observation_ids: decision.observationIds,
      identity_observation_ids: decision.identityObservationIds,
      identity_value: decision.identityValue,
      normalized_identity: decision.normalizedIdentity,
      candidate_entity_ids: decision.candidates.map((candidate) => candidate.entityId),
      linked_entity_ids: decision.linkedEntityIds,
      confidence: {
        observation: decision.confidence.observation,
        source: decision.confidence.source,
        identity: decision.confidence.identity,
        overall: decision.confidence.overall,
      },
    },
    detected_at: now,
  }
}

function reviewDecision(input: {
  facts: ExtractedFact[]
  identityFacts: ExtractedFact[]
  candidates?: IdentityCandidate[]
  linkedEntityIds?: string[]
  sourceScore: number
  reasonCode: string
  normalizedIdentity?: string | null
  identityValue?: string | null
  decision?: 'candidate' | 'review_required'
}): AiSubjectDecision {
  const first = input.facts[0]
  if (!first) {
    throw new AiGuardrailError('AI_EMPTY_SUBJECT', 'Aucun fait source-backed à analyser.')
  }

  const candidates = uniqueCandidates(input.candidates ?? [])
  const identityScore = candidates.length === 1 ? (candidates[0]?.matchConfidence ?? 0) : 0
  const confidence = scoreConfidence({
    observationConfidence: observationConfidence(input.identityFacts),
    sourceConfidence: input.sourceScore,
    identityConfidence: identityScore,
  })

  return {
    subjectKey: first.subjectKey,
    entityType: first.entityType,
    observationIds: input.facts.map((fact) => fact.observationId),
    identityObservationIds: input.identityFacts.map((fact) => fact.observationId),
    identityValue: input.identityValue ?? null,
    normalizedIdentity: input.normalizedIdentity ?? null,
    candidates,
    linkedEntityIds: input.linkedEntityIds ?? [],
    confidence,
    decision: input.decision ?? 'review_required',
    reasonCode: input.reasonCode,
    canonicalEntityId: null,
    validationIssueId: null,
  }
}

export class AiV01Service {
  constructor(private readonly repository: AiRepository) {}

  async analyzeSourceRecord(
    sourceRecordId: string,
    options: AiRunOptions = {},
  ): Promise<AiRunResult> {
    const apply = options.apply ?? false
    const now = options.now ?? new Date().toISOString()
    const context = await this.repository.getSourceContext(sourceRecordId)

    if (!context) {
      throw new AiGuardrailError(
        'AI_SOURCE_RECORD_NOT_FOUND',
        'AI V0.1 refuse de produire une donnée sans source_record existant.',
      )
    }

    if (context.source.status === 'blocked') {
      throw new AiGuardrailError(
        'AI_SOURCE_BLOCKED',
        'AI V0.1 refuse d’utiliser une source bloquée.',
      )
    }

    const facts = extractBackedFacts(context)
    const sourceScore = sourceConfidence(context)
    const decisions: AiSubjectDecision[] = []

    for (const group of groupFacts(facts)) {
      const first = group[0]
      if (!first) continue

      const linkedIds = [...new Set(group.map((fact) => fact.subjectEntityId).filter(Boolean))]
      const identityFacts = group.filter((fact) => fact.identityKey !== null)
      const identityKeys = [
        ...new Set(identityFacts.map((fact) => fact.identityKey).filter(Boolean)),
      ]
      const identityValue = identityFacts.map(factStringValue).find(Boolean) ?? null

      if (linkedIds.length > 1) {
        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            sourceScore,
            reasonCode: 'AI_IDENTITY_LINK_CONFLICT',
            identityValue,
            normalizedIdentity: identityKeys[0] ?? null,
          }),
        )
        continue
      }

      if (identityKeys.length > 1) {
        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            sourceScore,
            reasonCode: 'AI_IDENTITY_EVIDENCE_CONFLICT',
            identityValue,
          }),
        )
        continue
      }

      if (linkedIds.length === 1) {
        const linkedEntityId = linkedIds[0] as string

        if (identityFacts.length === 0 || identityKeys.length === 0) {
          decisions.push({
            subjectKey: first.subjectKey,
            entityType: first.entityType,
            observationIds: group.map((fact) => fact.observationId),
            identityObservationIds: [],
            identityValue: null,
            normalizedIdentity: null,
            candidates: [],
            linkedEntityIds: [linkedEntityId],
            confidence: scoreConfidence({
              observationConfidence: observationConfidence(group),
              sourceConfidence: sourceScore,
              identityConfidence: 1,
            }),
            decision: 'already_resolved',
            reasonCode: 'AI_ALREADY_RESOLVED',
            canonicalEntityId: linkedEntityId,
            validationIssueId: null,
          })
          continue
        }

        const normalizedIdentity = identityKeys[0] as string
        const candidates = uniqueCandidates(
          await this.repository.findIdentityCandidates(first.entityType, normalizedIdentity),
        )

        if (candidates.length === 1 && candidates[0]?.entityId === linkedEntityId) {
          decisions.push({
            subjectKey: first.subjectKey,
            entityType: first.entityType,
            observationIds: group.map((fact) => fact.observationId),
            identityObservationIds: identityFacts.map((fact) => fact.observationId),
            identityValue,
            normalizedIdentity,
            candidates,
            linkedEntityIds: [linkedEntityId],
            confidence: scoreConfidence({
              observationConfidence: observationConfidence(identityFacts),
              sourceConfidence: sourceScore,
              identityConfidence: candidates[0].matchConfidence,
            }),
            decision: 'already_resolved',
            reasonCode: 'AI_ALREADY_RESOLVED',
            canonicalEntityId: linkedEntityId,
            validationIssueId: null,
          })
          continue
        }

        if (candidates.length === 1 && candidates[0]?.entityId !== linkedEntityId) {
          decisions.push(
            reviewDecision({
              facts: group,
              identityFacts,
              candidates,
              linkedEntityIds: [linkedEntityId],
              sourceScore,
              reasonCode: 'AI_IDENTITY_LINK_IDENTITY_CONFLICT',
              identityValue,
              normalizedIdentity,
            }),
          )
          continue
        }

        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            candidates,
            linkedEntityIds: [linkedEntityId],
            sourceScore,
            reasonCode: candidates.length > 1 ? 'AI_IDENTITY_AMBIGUOUS' : 'AI_IDENTITY_UNRESOLVED',
            identityValue,
            normalizedIdentity,
          }),
        )
        continue
      }

      if (identityFacts.length === 0 || identityKeys.length === 0) {
        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            sourceScore,
            reasonCode: 'AI_IDENTITY_EVIDENCE_MISSING',
          }),
        )
        continue
      }

      const normalizedIdentity = identityKeys[0] as string
      const candidates = uniqueCandidates(
        await this.repository.findIdentityCandidates(first.entityType, normalizedIdentity),
      )

      if (candidates.length === 0) {
        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            sourceScore,
            candidates,
            reasonCode: 'AI_IDENTITY_UNRESOLVED',
            identityValue,
            normalizedIdentity,
          }),
        )
        continue
      }

      if (candidates.length > 1) {
        decisions.push(
          reviewDecision({
            facts: group,
            identityFacts,
            sourceScore,
            candidates,
            reasonCode: 'AI_IDENTITY_AMBIGUOUS',
            identityValue,
            normalizedIdentity,
          }),
        )
        continue
      }

      const candidate = candidates[0] as IdentityCandidate
      const confidence = scoreConfidence({
        observationConfidence: observationConfidence(identityFacts),
        sourceConfidence: sourceScore,
        identityConfidence: candidate.matchConfidence,
      })

      if (confidence.overall >= AI_V01.confidence.automatic) {
        const decision: AiSubjectDecision = {
          subjectKey: first.subjectKey,
          entityType: first.entityType,
          observationIds: group.map((fact) => fact.observationId),
          identityObservationIds: identityFacts.map((fact) => fact.observationId),
          identityValue,
          normalizedIdentity,
          candidates,
          linkedEntityIds: [],
          confidence,
          decision: 'automatic',
          reasonCode: 'AI_SAFE_IDENTITY_RESOLUTION',
          canonicalEntityId: candidate.entityId,
          validationIssueId: null,
        }
        if (apply) {
          await this.repository.linkObservations(decision.observationIds, candidate.entityId)
          await this.repository.acceptObservations(decision.identityObservationIds)
        }
        decisions.push(decision)
        continue
      }

      const decision = reviewDecision({
        facts: group,
        identityFacts,
        sourceScore,
        candidates,
        reasonCode:
          confidence.overall >= AI_V01.confidence.candidate
            ? 'AI_IDENTITY_CANDIDATE_REVIEW'
            : 'AI_LOW_CONFIDENCE',
        identityValue,
        normalizedIdentity,
        decision:
          confidence.overall >= AI_V01.confidence.candidate ? 'candidate' : 'review_required',
      })
      decision.confidence = confidence
      decisions.push(decision)
    }

    for (const decision of decisions) {
      if (decision.decision !== 'candidate' && decision.decision !== 'review_required') continue
      const issue = buildIssue(context, decision, now)
      decision.validationIssueId = issue.validation_issue_id ?? null
      if (apply) await this.repository.upsertValidationIssue(issue)
    }

    return {
      sourceRecordId: context.sourceRecord.source_record_id,
      sourceId: context.source.source_id,
      apply,
      extractedFacts: facts,
      decisions,
      automaticCount: decisions.filter((decision) => decision.decision === 'automatic').length,
      candidateCount: decisions.filter((decision) => decision.decision === 'candidate').length,
      reviewCount: decisions.filter((decision) => decision.decision === 'review_required').length,
    }
  }
}
