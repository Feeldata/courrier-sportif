import { FECAFOOT_SOURCE, buildSourceRecord, normalizeIdentity, stableUuid } from './core.ts'
import { parseFecafootFixtures } from './fixtures-v02.ts'
import type { CatalogueRepository, IdentityKind, MatchRow } from './catalogue-v02-repository.ts'
import type {
  FetchedSourceDocument,
  ObservationDraft,
  ReviewIssueDraft,
  SourceRecordDraft,
} from './types.ts'

export const ELITE_ONE_COMPETITION_ID = 'c92a7b55-4d4c-5c68-be3f-b333dbadd405'
export const INGEST_V02 = { parserVersion: 'fecafoot-catalogue-v0.2.0' } as const
export type CatalogueDocument = FetchedSourceDocument & {
  kind:
    | 'season_regulation'
    | 'participant_list'
    | 'general_calendar'
    | 'matchday_program'
    | 'reschedule'
  participants?: Array<{ club: string; team: string; externalId?: string }>
}
export type CatalogueResult = {
  dryRun: boolean
  sourceRecordId: string
  seasonId: string
  canonicalIds: string[]
  reviewIssueIds: string[]
  observationIds: string[]
}
const priorities = { general_calendar: 1, matchday_program: 2, reschedule: 3 } as const

export function seasonEntityId(label: string): string {
  return stableUuid(`entity:season:${ELITE_ONE_COMPETITION_ID}:${label}`)
}

function verifyDocument(document: CatalogueDocument): string {
  const url = new URL(document.url)
  if (url.protocol !== 'https:' || url.hostname !== 'fecafoot-officiel.com')
    throw new Error('Only official FECAFOOT HTTPS documents are accepted')
  const fullText = `${document.title} ${document.text}`
  if (!/\bMTN\s+ELITE\s+ONE\b/i.test(fullText)) throw new Error('MTN Elite One evidence absent')
  const label = fullText.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/)
  if (!label || Number(label[2]) !== Number(label[1]) + 1)
    throw new Error('Exact season label absent')
  const title = normalizeIdentity(document.title)
  const required = {
    season_regulation: /reglement/,
    participant_list: /liste|engag|participant/,
    general_calendar: /calendrier/,
    matchday_program: /programme|journee|chronogramme/,
    reschedule: /reprogramm|report|modification/,
  }[document.kind]
  if (!required.test(title)) throw new Error('Document title does not establish its official role')
  return `${label[1]}-${label[2]}`
}

function sourceRecord(document: CatalogueDocument, now: string): SourceRecordDraft {
  const record = buildSourceRecord(document, now)
  return {
    ...record,
    recordType: document.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'webpage',
    metadata: {
      ...record.metadata,
      parser_version: INGEST_V02.parserVersion,
      document_kind: document.kind,
      planning_priority:
        document.kind in priorities ? priorities[document.kind as keyof typeof priorities] : null,
    },
  }
}

function observation(
  record: SourceRecordDraft,
  type: ObservationDraft['subjectEntityType'],
  subject: string,
  field: string,
  raw: unknown,
  normalized: unknown,
): ObservationDraft {
  return {
    observationId: stableUuid(`observation:${record.sourceRecordId}:${type}:${subject}:${field}`),
    sourceRecordId: record.sourceRecordId,
    subjectEntityId: null,
    subjectEntityType: type,
    subjectKey: subject,
    fieldName: field,
    rawValue: raw,
    normalizedValue: normalized,
    confidence: 0.99,
    status: 'candidate',
    observedAt: record.collectedAt,
  }
}

function review(
  record: SourceRecordDraft,
  code: string,
  subject: string,
  details: Record<string, unknown>,
): ReviewIssueDraft {
  return {
    validationIssueId: stableUuid(`validation:${code}:${record.sourceRecordId}:${subject}`),
    entityId: null,
    subjectLocator: {
      source_record_id: record.sourceRecordId,
      source_url: record.url,
      subject_key: subject,
    },
    ruleCode: code,
    severity: 'blocking',
    status: 'open',
    message: `INGEST V0.2 blocked ${subject}: ${code}`,
    details: { ...details, action: 'human_review_required' },
    detectedAt: record.collectedAt,
  }
}

async function evidence(
  repository: CatalogueRepository,
  record: SourceRecordDraft,
  observations: ObservationDraft[],
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return
  await repository.upsertSource(FECAFOOT_SOURCE)
  await repository.upsertSourceRecord(record)
  await repository.upsertObservations(observations)
}

async function resolve(
  repository: CatalogueRepository,
  kind: IdentityKind,
  name: string,
  externalId: string | undefined,
  record: SourceRecordDraft,
  dryRun: boolean,
  result: CatalogueResult,
): Promise<{ id: string; create: boolean } | null> {
  const subject = `${kind}:${normalizeIdentity(name)}`
  const matches = [
    ...new Set(await repository.findIdentityMatches(kind, normalizeIdentity(name), externalId)),
  ]
  if (matches.length > 1) {
    const item = review(record, 'INGEST_V02_IDENTITY_AMBIGUOUS', subject, {
      candidate_entity_ids: matches,
    })
    result.reviewIssueIds.push(item.validationIssueId)
    if (!dryRun) await repository.upsertReviewIssue(item)
    return null
  }
  if (matches.length === 1) return { id: matches[0], create: false }
  const proposed = stableUuid(`entity:${kind}:CM:${normalizeIdentity(name)}`)
  const item = review(record, 'INGEST_V02_IDENTITY_BOOTSTRAP', subject, {
    proposed_entity_id: proposed,
    entity_type: kind,
    name,
    external_id: externalId ?? null,
  })
  const approved = await repository.findIdentityApproval(item.validationIssueId)
  if (approved?.createNew && approved.entityId === proposed) return { id: proposed, create: true }
  if (
    approved &&
    !approved.createNew &&
    (await repository.getEntityType(approved.entityId)) === kind
  )
    return { id: approved.entityId, create: false }
  if (approved) throw new Error('Invalid human identity approval')
  result.reviewIssueIds.push(item.validationIssueId)
  if (!dryRun) await repository.upsertReviewIssue(item)
  return null
}

function sameMatch(
  a: MatchRow,
  b: Pick<MatchRow, 'seasonId' | 'matchday' | 'homeTeamId' | 'awayTeamId'>,
): boolean {
  return (
    a.seasonId === b.seasonId &&
    a.matchday === b.matchday &&
    a.homeTeamId === b.homeTeamId &&
    a.awayTeamId === b.awayTeamId
  )
}

export async function ingestCatalogueDocument(
  repository: CatalogueRepository,
  document: CatalogueDocument,
  options: { dryRun?: boolean; now?: string } = {},
): Promise<CatalogueResult> {
  const label = verifyDocument(document)
  if (label === '2026-2027' && document.kind !== 'season_regulation') {
    throw new Error(
      'Gate B/C 2026-2027 closed until official participant list or calendar is verified',
    )
  }
  const dryRun = options.dryRun ?? true
  const record = sourceRecord(document, options.now ?? new Date().toISOString())
  const prior = await repository.findSourceRecordByUrl(record.sourceId, record.url)
  if (
    prior &&
    (prior.contentHash !== record.contentHash || prior.sourceRecordId !== record.sourceRecordId)
  )
    throw new Error('INGEST_SOURCE_URL_CONTENT_CHANGED: DATA V0.1 cannot version a reused URL')
  if (!(await repository.hasCompetition(ELITE_ONE_COMPETITION_ID)))
    throw new Error('Canonical MTN Elite One competition is absent')
  const seasons = await repository.findSeasons(ELITE_ONE_COMPETITION_ID, label)
  if (seasons.length > 1) throw new Error('Ambiguous canonical season')
  const seasonId = seasonEntityId(label)
  if (seasons[0] && seasons[0] !== seasonId)
    throw new Error('Existing season ID differs from deterministic competition-season ID')
  const result: CatalogueResult = {
    dryRun,
    sourceRecordId: record.sourceRecordId,
    seasonId,
    canonicalIds: [],
    reviewIssueIds: [],
    observationIds: [],
  }
  if (document.kind === 'season_regulation') {
    const observations = [
      observation(record, 'season', `season:${label}`, 'name', label, label),
      observation(
        record,
        'season',
        `season:${label}`,
        'competition_id',
        'MTN Elite One',
        ELITE_ONE_COMPETITION_ID,
      ),
    ]
    await evidence(repository, record, observations, dryRun)
    if (!dryRun) {
      await repository.upsertEntity({ entityId: seasonId, entityType: 'season' })
      await repository.upsertSeason({
        entityId: seasonId,
        competitionId: ELITE_ONE_COMPETITION_ID,
        name: label,
      })
      await repository.acceptObservations(
        observations.map((x) => x.observationId),
        seasonId,
      )
    }
    result.observationIds.push(...observations.map((x) => x.observationId))
    result.canonicalIds.push(seasonId)
    return result
  }
  if (seasons.length !== 1) throw new Error('Gate A season must exist first')
  await evidence(repository, record, [], dryRun)

  if (document.kind === 'participant_list') {
    const rows = document.participants ?? []
    if (!rows.length) throw new Error('Participant publication has no transcribed rows')
    for (const row of rows) {
      if (!document.text.includes(row.club) || !document.text.includes(row.team))
        throw new Error('Participant name absent from frozen official extract')
      const club = await resolve(
        repository,
        'club',
        row.club,
        row.externalId,
        record,
        dryRun,
        result,
      )
      const team = await resolve(
        repository,
        'team',
        row.team,
        row.externalId,
        record,
        dryRun,
        result,
      )
      if (!club || !team) continue
      if (!team.create) {
        const linkedClub = await repository.getTeamClubId(team.id)
        if (linkedClub !== club.id) {
          const item = review(record, 'INGEST_V02_TEAM_CLUB_CONFLICT', `team:${team.id}`, {
            existing_club_id: linkedClub,
            proposed_club_id: club.id,
          })
          result.reviewIssueIds.push(item.validationIssueId)
          if (!dryRun) await repository.upsertReviewIssue(item)
          continue
        }
      }
      const entryId = stableUuid(`entry:${seasonId}:${team.id}`)
      const observations = [
        observation(record, 'club', `club:${club.id}`, 'official_name', row.club, row.club),
        observation(record, 'team', `team:${team.id}`, 'name', row.team, row.team),
        observation(record, 'team', `entry:${seasonId}:${team.id}`, 'season_id', label, seasonId),
      ]
      await evidence(repository, record, observations, dryRun)
      if (!dryRun) {
        if (club.create) {
          await repository.upsertEntity({ entityId: club.id, entityType: 'club' })
          await repository.upsertClub({ entityId: club.id, officialName: row.club })
        }
        if (team.create) {
          await repository.upsertEntity({ entityId: team.id, entityType: 'team' })
          await repository.upsertTeam({ entityId: team.id, name: row.team, clubId: club.id })
        }
        await repository.upsertEntry({ entryId, seasonId, teamId: team.id })
        await repository.acceptObservations([observations[0].observationId], club.id)
        await repository.acceptObservations(
          observations.slice(1).map((x) => x.observationId),
          team.id,
        )
        await repository.addIdentityNames('club', club.id, row.club, row.externalId)
        await repository.addIdentityNames('team', team.id, row.team, row.externalId)
      }
      result.observationIds.push(...observations.map((x) => x.observationId))
      result.canonicalIds.push(club.id, team.id, entryId)
    }
    return result
  }

  const fixtures = parseFecafootFixtures(document, await repository.listTeamNames())
  const priority = priorities[document.kind]
  for (const fixture of fixtures) {
    const home = [
      ...new Set(await repository.findIdentityMatches('team', normalizeIdentity(fixture.home))),
    ]
    const away = [
      ...new Set(await repository.findIdentityMatches('team', normalizeIdentity(fixture.away))),
    ]
    const subject = `match:${seasonId}:${fixture.matchday}:${normalizeIdentity(fixture.home)}:${normalizeIdentity(fixture.away)}`
    if (home.length !== 1 || away.length !== 1 || home[0] === away[0]) {
      const item = review(record, 'INGEST_V02_MATCH_IDENTITY_UNRESOLVED', subject, {
        home_candidates: home,
        away_candidates: away,
      })
      result.reviewIssueIds.push(item.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(item)
      continue
    }
    if (
      !(await repository.hasEntry(seasonId, home[0])) ||
      !(await repository.hasEntry(seasonId, away[0]))
    ) {
      const item = review(record, 'INGEST_V02_MATCH_TEAM_NOT_ENTERED', subject, {
        home_team_id: home[0],
        away_team_id: away[0],
      })
      result.reviewIssueIds.push(item.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(item)
      continue
    }
    const logical = {
      seasonId,
      matchday: fixture.matchday,
      homeTeamId: home[0],
      awayTeamId: away[0],
    }
    const proposed = stableUuid(
      `entity:match:${seasonId}:${fixture.matchday}:${home[0]}:${away[0]}`,
    )
    const matches = await repository.findLogicalMatches(logical)
    const atId = await repository.findMatchById(proposed)
    if (
      matches.length > 1 ||
      (atId && !sameMatch(atId, logical)) ||
      (matches.length === 1 && atId && matches[0].entityId !== atId.entityId)
    ) {
      const item = review(record, 'INGEST_V02_MATCH_LOGICAL_COLLISION', subject, {
        candidate_match_ids: matches.map((x) => x.entityId),
        proposed_id: proposed,
      })
      result.reviewIssueIds.push(item.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(item)
      continue
    }
    const matchId = matches[0]?.entityId ?? proposed
    const rank = await repository.getSchedulePriority(matchId)
    const existing = matches[0] ?? atId
    if (existing?.status && !['scheduled', 'delayed', 'postponed'].includes(existing.status)) {
      const item = review(record, 'INGEST_V02_MATCH_STATUS_LOCKED', subject, {
        match_id: matchId,
        status: existing.status,
      })
      result.reviewIssueIds.push(item.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(item)
      continue
    }
    if (
      rank === priority &&
      existing &&
      (existing.scheduledDate !== fixture.scheduledDate || existing.kickoffAt !== fixture.kickoffAt)
    ) {
      const item = review(record, 'INGEST_V02_SCHEDULE_SAME_RANK_CONFLICT', subject, {
        match_id: matchId,
        priority,
      })
      result.reviewIssueIds.push(item.validationIssueId)
      if (!dryRun) await repository.upsertReviewIssue(item)
      continue
    }
    const observations = [
      observation(
        record,
        'match',
        subject,
        'scheduled_date',
        fixture.rawDate,
        fixture.scheduledDate,
      ),
      observation(record, 'match', subject, 'kickoff_at', fixture.rawTime, fixture.kickoffAt),
      observation(record, 'match', subject, 'venue_name', fixture.venueName, fixture.venueName),
    ]
    await evidence(repository, record, observations, dryRun)
    if (!dryRun && priority >= rank) {
      await repository.upsertEntity({ entityId: matchId, entityType: 'match' })
      await repository.upsertMatch({
        entityId: matchId,
        ...logical,
        scheduledDate: fixture.scheduledDate,
        kickoffAt: fixture.kickoffAt,
        kickoffPrecision: fixture.kickoffAt ? 'exact' : 'date',
      })
      await repository.acceptObservations(
        observations.map((x) => x.observationId),
        matchId,
      )
    }
    result.observationIds.push(...observations.map((x) => x.observationId))
    result.canonicalIds.push(matchId)
  }
  return result
}
