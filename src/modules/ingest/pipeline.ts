import {
  FECAFOOT_SOURCE,
  INGEST_V01,
  buildCompetitionCandidate,
  buildSeasonReviewIssue,
  buildSourceRecord,
  extractFecafootObservations,
  normalizeIdentity,
  stableUuid,
} from './core.ts'
import { JsonConsoleIngestLogger, type IngestLogger } from './logger.ts'
import type { IngestRepository } from './repository.ts'
import type {
  FetchedSourceDocument,
  IngestRunResult,
  PipelineEvent,
  ReviewIssueDraft,
} from './types.ts'

interface RunOptions {
  dryRun?: boolean
  now?: string
  logger?: IngestLogger
}

function event(
  now: string,
  stage: PipelineEvent['stage'],
  level: PipelineEvent['level'],
  code: string,
  message: string,
  context?: Record<string, unknown>,
): PipelineEvent {
  return { timestamp: now, stage, level, code, message, context }
}

export async function ingestFecafootDocument(
  repository: IngestRepository,
  document: FetchedSourceDocument,
  options: RunOptions = {},
): Promise<IngestRunResult> {
  const dryRun = options.dryRun ?? false
  const now = options.now ?? new Date().toISOString()
  const logger = options.logger ?? new JsonConsoleIngestLogger()
  const events: PipelineEvent[] = []
  const emit = (entry: PipelineEvent) => {
    events.push(entry)
    logger.log(entry)
  }

  const sourceRecord = buildSourceRecord(document, now)
  emit(
    event(now, 'source_record', 'info', 'SOURCE_RECORD_READY', 'Source record fingerprinted.', {
      source_record_id: sourceRecord.sourceRecordId,
      content_hash: sourceRecord.contentHash,
      dry_run: dryRun,
    }),
  )

  let observations
  try {
    observations = extractFecafootObservations(document, sourceRecord)
  } catch (error) {
    emit(
      event(now, 'extract', 'error', 'EXTRACTION_FAILED', 'FECAFOOT extraction failed.', {
        error: error instanceof Error ? error.message : String(error),
        source_url: document.url,
      }),
    )
    throw error
  }

  if (observations.length === 0) {
    const issue: ReviewIssueDraft = {
      validationIssueId: stableUuid(`validation:INGEST_NO_SUPPORTED_FACTS:${sourceRecord.sourceRecordId}`),
      entityId: null,
      subjectLocator: { source_record_id: sourceRecord.sourceRecordId, source_url: document.url },
      ruleCode: 'INGEST_NO_SUPPORTED_FACTS',
      severity: 'warning',
      status: 'open',
      message: 'The document was fetched but no V0.1 supported facts could be extracted.',
      details: { parser_version: INGEST_V01.parserVersion },
      detectedAt: now,
    }
    if (!dryRun) {
      await repository.upsertSource(FECAFOOT_SOURCE)
      await repository.upsertSourceRecord(sourceRecord)
      await repository.upsertReviewIssue(issue)
    }
    emit(event(now, 'extract', 'warning', issue.ruleCode, issue.message, issue.subjectLocator))
    return {
      dryRun,
      sourceRecordId: sourceRecord.sourceRecordId,
      observationIds: [],
      canonicalEntityIds: [],
      reviewIssueIds: [issue.validationIssueId],
      events,
    }
  }

  emit(
    event(now, 'extract', 'info', 'OBSERVATIONS_EXTRACTED', 'Source observations extracted.', {
      observation_count: observations.length,
    }),
  )

  if (!dryRun) {
    try {
      await repository.upsertSource(FECAFOOT_SOURCE)
      await repository.upsertSourceRecord(sourceRecord)
      await repository.upsertObservations(observations)
    } catch (error) {
      emit(
        event(now, 'write', 'error', 'PROVENANCE_WRITE_FAILED', 'Failed to persist provenance.', {
          error: error instanceof Error ? error.message : String(error),
          source_record_id: sourceRecord.sourceRecordId,
        }),
      )
      throw error
    }
  }

  const nameObservation = observations.find(
    (item) => item.subjectEntityType === 'competition' && item.fieldName === 'name',
  )
  let candidates = [] as Awaited<ReturnType<IngestRepository['findCompetitionCandidates']>>
  if (nameObservation) {
    try {
      candidates = await repository.findCompetitionCandidates(
        normalizeIdentity(String(nameObservation.normalizedValue)),
      )
    } catch (error) {
      emit(
        event(now, 'resolve', 'error', 'IDENTITY_RESOLUTION_FAILED', 'Competition identity resolution failed.', {
          error: error instanceof Error ? error.message : String(error),
          subject_key: nameObservation.subjectKey,
        }),
      )
      throw error
    }
  }

  let competitionCandidate = null
  const canonicalEntityIds: string[] = []
  const reviewIssueIds: string[] = []

  if (candidates.length > 1) {
    const issue: ReviewIssueDraft = {
      validationIssueId: stableUuid(
        `validation:INGEST_COMPETITION_IDENTITY_AMBIGUOUS:${sourceRecord.sourceRecordId}:competition:mtn-elite-one`,
      ),
      entityId: null,
      subjectLocator: {
        source_record_id: sourceRecord.sourceRecordId,
        subject_key: 'competition:mtn-elite-one',
      },
      ruleCode: 'INGEST_COMPETITION_IDENTITY_AMBIGUOUS',
      severity: 'blocking',
      status: 'open',
      message: 'Multiple canonical competitions match the normalized FECAFOOT competition identity.',
      details: {
        candidate_entity_ids: candidates.map((candidate) => candidate.entityId),
        action: 'human_review_required',
      },
      detectedAt: now,
    }
    reviewIssueIds.push(issue.validationIssueId)
    if (!dryRun) await repository.upsertReviewIssue(issue)
    emit(event(now, 'resolve', 'warning', issue.ruleCode, issue.message, issue.details))
  } else {
    competitionCandidate = buildCompetitionCandidate(observations, candidates[0]?.entityId)
    if (competitionCandidate && competitionCandidate.confidence >= INGEST_V01.confidence.autoAcceptCandidate) {
      emit(
        event(now, 'validate', 'info', 'COMPETITION_AUTO_ACCEPTED', 'Competition candidate passed V0.1 confidence gate.', {
          entity_id: competitionCandidate.canonicalId,
          confidence: competitionCandidate.confidence,
          resolution: competitionCandidate.identityResolution.kind,
        }),
      )
      canonicalEntityIds.push(competitionCandidate.canonicalId)
      if (!dryRun) {
        try {
          await repository.upsertEntity({
            entityId: competitionCandidate.canonicalId,
            entityType: 'competition',
          })
          await repository.upsertCompetition({
            entityId: competitionCandidate.canonicalId,
            name: competitionCandidate.name,
            competitionType: competitionCandidate.competitionType,
            countryCode: competitionCandidate.countryCode,
            organizerName: competitionCandidate.organizerName,
          })
          await repository.acceptObservations(
            competitionCandidate.evidenceObservationIds,
            competitionCandidate.canonicalId,
          )
        } catch (error) {
          emit(
            event(now, 'write', 'error', 'CANONICAL_WRITE_FAILED', 'Canonical competition write failed.', {
              error: error instanceof Error ? error.message : String(error),
              entity_id: competitionCandidate.canonicalId,
            }),
          )
          throw error
        }
      }
    } else if (competitionCandidate) {
      const issue: ReviewIssueDraft = {
        validationIssueId: stableUuid(
          `validation:INGEST_LOW_CONFIDENCE:${sourceRecord.sourceRecordId}:${competitionCandidate.subjectKey}`,
        ),
        entityId: null,
        subjectLocator: {
          source_record_id: sourceRecord.sourceRecordId,
          subject_key: competitionCandidate.subjectKey,
        },
        ruleCode: 'INGEST_LOW_CONFIDENCE',
        severity: 'warning',
        status: 'open',
        message: 'Canonical candidate is below the V0.1 automatic acceptance threshold.',
        details: {
          confidence: competitionCandidate.confidence,
          threshold: INGEST_V01.confidence.autoAcceptCandidate,
          action: 'human_review_required',
        },
        detectedAt: now,
      }
      reviewIssueIds.push(issue.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(issue)
      emit(event(now, 'validate', 'warning', issue.ruleCode, issue.message, issue.details))
    }
  }

  const seasonIssue = buildSeasonReviewIssue(observations, sourceRecord, now)
  if (seasonIssue) {
    reviewIssueIds.push(seasonIssue.validationIssueId)
    if (!dryRun) await repository.upsertReviewIssue(seasonIssue)
    emit(event(now, 'resolve', 'warning', seasonIssue.ruleCode, seasonIssue.message, seasonIssue.details))
  }

  return {
    dryRun,
    sourceRecordId: sourceRecord.sourceRecordId,
    observationIds: observations.map((item) => item.observationId),
    canonicalEntityIds,
    reviewIssueIds,
    events,
  }
}
