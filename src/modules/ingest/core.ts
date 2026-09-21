import { createHash } from 'node:crypto'

import type {
  CompetitionCandidate,
  FetchedSourceDocument,
  IngestWritePlan,
  ObservationDraft,
  ReviewIssueDraft,
  SourceDefinition,
  SourceRecordDraft,
} from './types.ts'

export const INGEST_V01 = {
  parserVersion: 'fecafoot-html-v0.1.0',
  confidence: {
    directOfficialFact: 0.99,
    normalizedOfficialFact: 0.97,
    sourceProfileFact: 0.98,
    derivedCalendarFact: 0.9,
    autoAcceptCandidate: 0.95,
    humanReview: 0.7,
  },
} as const

const SOURCE_NAMESPACE = 'courrier-sportif:ingest:v0.1'

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function normalizeIdentity(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function slugify(value: string): string {
  return normalizeIdentity(value).replace(/\s+/g, '-')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function stableUuid(name: string): string {
  const digest = createHash('sha256').update(`${SOURCE_NAMESPACE}:${name}`, 'utf8').digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const FECAFOOT_SOURCE: SourceDefinition = {
  sourceId: stableUuid('source:fecafoot-officiel.com'),
  name: 'FECAFOOT — site officiel',
  sourceType: 'official_federation',
  baseUrl: 'https://fecafoot-officiel.com',
  publisher: 'Fédération Camerounaise de Football',
  reliabilityLevel: 5,
  status: 'active',
}

export function buildSourceRecord(document: FetchedSourceDocument, now: string): SourceRecordDraft {
  const canonicalContent = JSON.stringify({
    url: document.url,
    title: normalizeWhitespace(document.title),
    publishedAt: document.publishedAt,
    text: normalizeWhitespace(document.text),
  })
  const contentHash = `sha256:${sha256(canonicalContent)}`
  const sourceRecordId = stableUuid(
    `source-record:${FECAFOOT_SOURCE.sourceId}:${document.url}:${contentHash}`,
  )

  return {
    sourceRecordId,
    sourceId: FECAFOOT_SOURCE.sourceId,
    recordType: 'webpage',
    url: document.url,
    externalRef: document.externalRef ?? document.url,
    publishedAt: document.publishedAt,
    collectedAt: document.fetchedAt ?? now,
    contentHash,
    metadata: {
      title: normalizeWhitespace(document.title),
      parser_version: INGEST_V01.parserVersion,
      published_at_precision: document.publishedAtPrecision,
      source_reliability_level: FECAFOOT_SOURCE.reliabilityLevel,
      capture_mode: document.captureMode ?? 'live_html',
    },
  }
}

function observation(
  sourceRecord: SourceRecordDraft,
  input: Omit<
    ObservationDraft,
    'observationId' | 'sourceRecordId' | 'subjectEntityId' | 'status' | 'observedAt'
  >,
): ObservationDraft {
  const observationId = stableUuid(
    `observation:${sourceRecord.sourceRecordId}:${input.subjectEntityType}:${input.subjectKey}:${input.fieldName}`,
  )

  return {
    ...input,
    observationId,
    sourceRecordId: sourceRecord.sourceRecordId,
    subjectEntityId: null,
    status: 'candidate',
    observedAt: sourceRecord.collectedAt,
  }
}

function frenchMonthToNumber(month: string): number | null {
  const months: Record<string, number> = {
    janvier: 1,
    fevrier: 2,
    février: 2,
    mars: 3,
    avril: 4,
    mai: 5,
    juin: 6,
    juillet: 7,
    aout: 8,
    août: 8,
    septembre: 9,
    octobre: 10,
    novembre: 11,
    decembre: 12,
    décembre: 12,
  }
  return months[month.toLocaleLowerCase('fr')] ?? null
}

export function extractFrenchDate(text: string): string | null {
  const match = normalizeWhitespace(text).match(
    /\b(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(20\d{2})\b/i,
  )
  if (!match) return null
  const month = frenchMonthToNumber(match[2])
  if (!month) return null
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

export function extractFecafootObservations(
  document: FetchedSourceDocument,
  sourceRecord: SourceRecordDraft,
): ObservationDraft[] {
  const text = normalizeWhitespace(`${document.title} ${document.text}`)
  const observations: ObservationDraft[] = []

  if (/\bMTN\s+Elite\s+One\b/i.test(text)) {
    const subjectKey = 'competition:mtn-elite-one'
    observations.push(
      observation(sourceRecord, {
        subjectEntityType: 'competition',
        subjectKey,
        fieldName: 'name',
        rawValue: 'MTN Elite One',
        normalizedValue: 'MTN Elite One',
        confidence: INGEST_V01.confidence.directOfficialFact,
      }),
    )

    if (/\bchampionnat\b/i.test(text)) {
      observations.push(
        observation(sourceRecord, {
          subjectEntityType: 'competition',
          subjectKey,
          fieldName: 'competition_type',
          rawValue: 'championnat',
          normalizedValue: 'league',
          confidence: INGEST_V01.confidence.normalizedOfficialFact,
        }),
      )
    }

    observations.push(
      observation(sourceRecord, {
        subjectEntityType: 'competition',
        subjectKey,
        fieldName: 'organizer_name',
        rawValue: FECAFOOT_SOURCE.publisher,
        normalizedValue: FECAFOOT_SOURCE.publisher,
        confidence: INGEST_V01.confidence.sourceProfileFact,
      }),
      observation(sourceRecord, {
        subjectEntityType: 'competition',
        subjectKey,
        fieldName: 'country_code',
        rawValue: 'Cameroon',
        normalizedValue: 'CM',
        confidence: INGEST_V01.confidence.sourceProfileFact,
      }),
    )
  }

  const startDateMatch = text.match(/\bd[ée]butera\s+le\s+([^,.]+)/i)
  const startDate = startDateMatch ? extractFrenchDate(startDateMatch[1]) : null
  if (startDate) {
    observations.push(
      observation(sourceRecord, {
        subjectEntityType: 'season',
        subjectKey: `season:mtn-elite-one:unresolved:${startDate}`,
        fieldName: 'start_date',
        rawValue: normalizeWhitespace(startDateMatch?.[1] ?? startDate),
        normalizedValue: startDate,
        confidence: INGEST_V01.confidence.directOfficialFact,
      }),
    )
  }

  return observations
}

export function buildCompetitionCandidate(
  observations: ObservationDraft[],
  existingEntityId?: string,
): CompetitionCandidate | null {
  const competitionObservations = observations.filter(
    (item) =>
      item.subjectEntityType === 'competition' && item.subjectKey === 'competition:mtn-elite-one',
  )
  const name = competitionObservations.find((item) => item.fieldName === 'name')
  const competitionType = competitionObservations.find(
    (item) => item.fieldName === 'competition_type',
  )
  if (typeof name?.normalizedValue !== 'string' || competitionType?.normalizedValue !== 'league') {
    return null
  }

  const confidence = Math.min(...competitionObservations.map((item) => item.confidence))
  const canonicalId =
    existingEntityId ?? stableUuid('entity:competition:CM:mtn-elite-one:male:senior')

  return {
    kind: 'competition',
    subjectKey: 'competition:mtn-elite-one',
    canonicalId,
    name: name.normalizedValue,
    competitionType: 'league',
    countryCode: 'CM',
    organizerName: FECAFOOT_SOURCE.publisher,
    confidence,
    evidenceObservationIds: competitionObservations.map((item) => item.observationId),
    identityResolution: existingEntityId
      ? { kind: 'existing_exact', entityId: existingEntityId, score: 1 }
      : { kind: 'new_deterministic', entityId: canonicalId, score: confidence },
  }
}

export function buildSeasonReviewIssue(
  observations: ObservationDraft[],
  sourceRecord: SourceRecordDraft,
  now: string,
): ReviewIssueDraft | null {
  const seasonObservation = observations.find(
    (item) => item.subjectEntityType === 'season' && item.fieldName === 'start_date',
  )
  if (!seasonObservation) return null

  const validationIssueId = stableUuid(
    `validation:INGEST_SEASON_IDENTITY_UNRESOLVED:${sourceRecord.sourceRecordId}:${seasonObservation.subjectKey}`,
  )
  return {
    validationIssueId,
    entityId: null,
    subjectLocator: {
      source_record_id: sourceRecord.sourceRecordId,
      source_url: sourceRecord.url,
      subject_key: seasonObservation.subjectKey,
    },
    ruleCode: 'INGEST_SEASON_IDENTITY_UNRESOLVED',
    severity: 'warning',
    status: 'open',
    message:
      'The source states a competition start date but does not identify the season precisely enough for automatic canonical season resolution.',
    details: {
      observation_id: seasonObservation.observationId,
      normalized_start_date: seasonObservation.normalizedValue,
      action: 'human_review_required',
    },
    detectedAt: now,
  }
}

export function buildOfflinePlan(document: FetchedSourceDocument, now: string): IngestWritePlan {
  const sourceRecord = buildSourceRecord(document, now)
  const observations = extractFecafootObservations(document, sourceRecord)
  const competitionCandidate = buildCompetitionCandidate(observations)
  const seasonIssue = buildSeasonReviewIssue(observations, sourceRecord, now)
  return {
    source: FECAFOOT_SOURCE,
    sourceRecord,
    observations,
    competitionCandidate,
    reviewIssues: seasonIssue ? [seasonIssue] : [],
  }
}
