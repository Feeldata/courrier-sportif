import { readFile } from 'node:fs/promises'

import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import type { Database } from '@/lib/supabase/database.types'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getPublicEnvironment } from '@/lib/env/public'
import { getCompetitionDetail, getMatchDetail } from '@/modules/app/data/repository'
import { normalizeIdentity as normalizeAiIdentity, stableAiIssueId } from '@/modules/ai/core'
import { AiV01Service } from '@/modules/ai/pipeline'
import { SupabaseAiRepository } from '@/modules/ai/supabase-repository'
import { buildOfflinePlan } from '@/modules/ingest/core'
import { CollectingIngestLogger } from '@/modules/ingest/logger'
import { ingestFecafootDocument } from '@/modules/ingest/pipeline'
import { SupabaseIngestRepository } from '@/modules/ingest/supabase-repository'
import type { FetchedSourceDocument } from '@/modules/ingest/types'
import { MatchService } from '@/modules/match/service'
import { SupabaseMatchRepository } from '@/modules/match/supabase-repository'

const STAGING_REF = 'dlilhxaixpnabefqloxs'
const STAGING_URL = 'https://dlilhxaixpnabefqloxs.supabase.co'
const NOW = '2026-09-22T14:00:00.000Z'

const AMBIG_SOURCE_ID = '91000000-0000-4000-8000-000000000001'
const AMBIG_RECORD_ID = '91000000-0000-4000-8000-000000000002'
const AMBIG_OBSERVATION_ID = '91000000-0000-4000-8000-000000000003'
const AMBIG_ENTITY_A = '91000000-0000-4000-8000-000000000010'
const AMBIG_ENTITY_B = '91000000-0000-4000-8000-000000000011'
const AMBIG_ALIAS_A = '91000000-0000-4000-8000-000000000012'
const AMBIG_ALIAS_B = '91000000-0000-4000-8000-000000000013'
const AMBIG_SUBJECT_KEY = 'staging-smoke:competition:ambiguous'
const AMBIG_IDENTITY = '[STAGING TEST] Ambiguous Identity'

const MATCH_COMPETITION_ID = '92000000-0000-4000-8000-000000000001'
const MATCH_SEASON_ID = '92000000-0000-4000-8000-000000000002'
const MATCH_HOME_TEAM_ID = '92000000-0000-4000-8000-000000000003'
const MATCH_AWAY_TEAM_ID = '92000000-0000-4000-8000-000000000004'
const MATCH_HOME_PLAYER_ID = '92000000-0000-4000-8000-000000000005'
const MATCH_AWAY_PLAYER_ID = '92000000-0000-4000-8000-000000000006'
const MATCH_VENUE_ID = '92000000-0000-4000-8000-000000000007'
const MATCH_ID = '92000000-0000-4000-8000-000000000008'
const MATCH_HOME_PLAYER_ROW_ID = '92000000-0000-4000-8000-000000000009'
const MATCH_AWAY_PLAYER_ROW_ID = '92000000-0000-4000-8000-000000000010'
const MATCH_EVENT_ID = '92000000-0000-4000-8000-000000000011'
const ANON_WRITE_PROBE_ID = '93000000-0000-4000-8000-000000000001'

const fixtureUrl = new URL(
  '../modules/ingest/fixtures/fecafoot-elite-one-launch-2026.json',
  import.meta.url,
)

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

async function loadFixture(): Promise<FetchedSourceDocument> {
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as FetchedSourceDocument
}

function requireStagingEnvironment() {
  const publicEnv = getPublicEnvironment()
  if (publicEnv.appEnvironment !== 'staging') {
    throw new Error('Staging smoke refused: NEXT_PUBLIC_APP_ENV must be staging.')
  }
  if (publicEnv.supabaseUrl !== STAGING_URL) {
    throw new Error(
      'Staging smoke refused: Supabase URL does not match the authorized staging project.',
    )
  }
  if (process.env.SUPABASE_PROJECT_REF !== STAGING_REF) {
    throw new Error('Staging smoke refused: SUPABASE_PROJECT_REF does not match staging.')
  }
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error(
      'Staging smoke refused: SUPABASE_SECRET_KEY is missing from runtime environment.',
    )
  }
  if (publicEnv.supabaseUrl.includes('ligpxqweieuybmupirun')) {
    throw new Error('Staging smoke refused: production project detected.')
  }
  return publicEnv
}

async function expectSmokeIdsAbsent(
  admin: AdminClient,
  ingestPlan: ReturnType<typeof buildOfflinePlan>,
) {
  const entityIds = [
    ingestPlan.competitionCandidate?.canonicalId,
    AMBIG_ENTITY_A,
    AMBIG_ENTITY_B,
    MATCH_COMPETITION_ID,
    MATCH_SEASON_ID,
    MATCH_HOME_TEAM_ID,
    MATCH_AWAY_TEAM_ID,
    MATCH_HOME_PLAYER_ID,
    MATCH_AWAY_PLAYER_ID,
    MATCH_VENUE_ID,
    MATCH_ID,
    ANON_WRITE_PROBE_ID,
  ].filter((value): value is string => Boolean(value))

  const [entities, sources, records, observations, aliases] = await Promise.all([
    admin.from('entities').select('entity_id').in('entity_id', entityIds),
    admin
      .from('sources')
      .select('source_id')
      .in('source_id', [ingestPlan.source.sourceId, AMBIG_SOURCE_ID]),
    admin
      .from('source_records')
      .select('source_record_id')
      .in('source_record_id', [ingestPlan.sourceRecord.sourceRecordId, AMBIG_RECORD_ID]),
    admin
      .from('source_observations')
      .select('observation_id')
      .in('observation_id', [
        ...ingestPlan.observations.map((item) => item.observationId),
        AMBIG_OBSERVATION_ID,
      ]),
    admin.from('entity_aliases').select('alias_id').in('alias_id', [AMBIG_ALIAS_A, AMBIG_ALIAS_B]),
  ])

  for (const [label, response] of [
    ['entities', entities],
    ['sources', sources],
    ['source_records', records],
    ['source_observations', observations],
    ['entity_aliases', aliases],
  ] as const) {
    expect(response.error, `preflight ${label}`).toBeNull()
    expect(response.data, `stale staging smoke rows found in ${label}`).toEqual([])
  }
}

async function seedAmbiguousAiFixture(admin: AdminClient) {
  const entityInsert = await admin.from('entities').insert([
    { entity_id: AMBIG_ENTITY_A, entity_type: 'competition' },
    { entity_id: AMBIG_ENTITY_B, entity_type: 'competition' },
  ])
  expect(entityInsert.error).toBeNull()

  const competitionInsert = await admin.from('competitions').insert([
    {
      entity_id: AMBIG_ENTITY_A,
      name: '[STAGING TEST] Ambiguous Candidate A',
      competition_type: 'other',
      country_code: 'CM',
      organizer_name: 'Courrier Sportif staging smoke',
    },
    {
      entity_id: AMBIG_ENTITY_B,
      name: '[STAGING TEST] Ambiguous Candidate B',
      competition_type: 'other',
      country_code: 'CM',
      organizer_name: 'Courrier Sportif staging smoke',
    },
  ])
  expect(competitionInsert.error).toBeNull()

  const normalizedAlias = normalizeAiIdentity(AMBIG_IDENTITY)
  const aliasInsert = await admin.from('entity_aliases').insert([
    {
      alias_id: AMBIG_ALIAS_A,
      entity_id: AMBIG_ENTITY_A,
      alias: AMBIG_IDENTITY,
      normalized_alias: normalizedAlias,
      alias_type: 'other',
    },
    {
      alias_id: AMBIG_ALIAS_B,
      entity_id: AMBIG_ENTITY_B,
      alias: AMBIG_IDENTITY,
      normalized_alias: normalizedAlias,
      alias_type: 'other',
    },
  ])
  expect(aliasInsert.error).toBeNull()

  const sourceInsert = await admin.from('sources').insert({
    source_id: AMBIG_SOURCE_ID,
    name: '[STAGING TEST] AI ambiguity fixture',
    source_type: 'other',
    publisher: 'Courrier Sportif staging smoke',
    reliability_level: 5,
    status: 'active',
  })
  expect(sourceInsert.error).toBeNull()

  const recordInsert = await admin.from('source_records').insert({
    source_record_id: AMBIG_RECORD_ID,
    source_id: AMBIG_SOURCE_ID,
    record_type: 'manual',
    external_ref: 'staging-smoke:ai-ambiguity',
    collected_at: NOW,
    content_hash: 'staging-smoke:ai-ambiguity:v0.1',
    metadata: { staging_test: true, synthetic: true },
  })
  expect(recordInsert.error).toBeNull()

  const observationInsert = await admin.from('source_observations').insert({
    observation_id: AMBIG_OBSERVATION_ID,
    source_record_id: AMBIG_RECORD_ID,
    subject_entity_type: 'competition',
    subject_key: AMBIG_SUBJECT_KEY,
    field_name: 'name',
    raw_value: AMBIG_IDENTITY,
    normalized_value: AMBIG_IDENTITY,
    confidence: 0.99,
    status: 'candidate',
    observed_at: NOW,
  })
  expect(observationInsert.error).toBeNull()
}

async function seedMatchPrerequisites(admin: AdminClient) {
  const entityInsert = await admin.from('entities').insert([
    { entity_id: MATCH_COMPETITION_ID, entity_type: 'competition' },
    { entity_id: MATCH_SEASON_ID, entity_type: 'season' },
    { entity_id: MATCH_HOME_TEAM_ID, entity_type: 'team' },
    { entity_id: MATCH_AWAY_TEAM_ID, entity_type: 'team' },
    { entity_id: MATCH_HOME_PLAYER_ID, entity_type: 'player' },
    { entity_id: MATCH_AWAY_PLAYER_ID, entity_type: 'player' },
    { entity_id: MATCH_VENUE_ID, entity_type: 'venue' },
  ])
  expect(entityInsert.error).toBeNull()

  const competitionInsert = await admin.from('competitions').insert({
    entity_id: MATCH_COMPETITION_ID,
    name: '[STAGING TEST] Courrier Sportif Smoke League',
    competition_type: 'league',
    country_code: 'CM',
    organizer_name: 'Courrier Sportif staging smoke',
  })
  expect(competitionInsert.error).toBeNull()

  const seasonInsert = await admin.from('seasons').insert({
    entity_id: MATCH_SEASON_ID,
    competition_id: MATCH_COMPETITION_ID,
    name: '[STAGING TEST] 2026 Smoke Season',
    start_date: '2026-09-01',
    end_date: '2026-12-31',
    status: 'active',
  })
  expect(seasonInsert.error).toBeNull()

  const teamInsert = await admin.from('teams').insert([
    {
      entity_id: MATCH_HOME_TEAM_ID,
      name: '[STAGING TEST] Yaoundé Smoke XI',
      team_scope: 'independent',
      country_code: 'CM',
      gender: 'male',
      age_category: 'senior',
      status: 'active',
    },
    {
      entity_id: MATCH_AWAY_TEAM_ID,
      name: '[STAGING TEST] Garoua Smoke XI',
      team_scope: 'independent',
      country_code: 'CM',
      gender: 'male',
      age_category: 'senior',
      status: 'active',
    },
  ])
  expect(teamInsert.error).toBeNull()

  const playerInsert = await admin.from('players').insert([
    {
      entity_id: MATCH_HOME_PLAYER_ID,
      display_name: '[STAGING TEST] Home Player',
      nationality_code: 'CM',
      gender: 'male',
      status: 'active',
    },
    {
      entity_id: MATCH_AWAY_PLAYER_ID,
      display_name: '[STAGING TEST] Away Player',
      nationality_code: 'CM',
      gender: 'male',
      status: 'active',
    },
  ])
  expect(playerInsert.error).toBeNull()

  const venueInsert = await admin.from('venues').insert({
    entity_id: MATCH_VENUE_ID,
    name: '[STAGING TEST] Smoke Stadium',
    city: 'Yaoundé',
    country_code: 'CM',
    status: 'active',
  })
  expect(venueInsert.error).toBeNull()
}

async function snapshotMatchRows(admin: AdminClient) {
  const [match, result, events, lineups] = await Promise.all([
    admin.from('matches').select('*').eq('entity_id', MATCH_ID).maybeSingle(),
    admin.from('match_results').select('*').eq('match_id', MATCH_ID).maybeSingle(),
    admin.from('match_events').select('*').eq('match_id', MATCH_ID).order('event_id'),
    admin.from('match_players').select('*').eq('match_id', MATCH_ID).order('match_player_id'),
  ])
  expect(match.error).toBeNull()
  expect(result.error).toBeNull()
  expect(events.error).toBeNull()
  expect(lineups.error).toBeNull()
  return {
    match: match.data,
    result: result.data,
    events: events.data,
    lineups: lineups.data,
  }
}

async function cleanup(admin: AdminClient, ingestPlan: ReturnType<typeof buildOfflinePlan>) {
  const knownIssueIds = [
    ...ingestPlan.reviewIssues.map((issue) => issue.validationIssueId),
    stableAiIssueId(
      ingestPlan.sourceRecord.sourceRecordId,
      'season:mtn-elite-one:unresolved:2026-01-24',
      'AI_IDENTITY_EVIDENCE_MISSING',
    ),
    stableAiIssueId(AMBIG_RECORD_ID, AMBIG_SUBJECT_KEY, 'AI_IDENTITY_AMBIGUOUS'),
  ]

  const issueDelete = await admin
    .from('validation_issues')
    .delete()
    .in('validation_issue_id', knownIssueIds)
  expect(issueDelete.error).toBeNull()

  const matchIssueDelete = await admin.from('validation_issues').delete().eq('entity_id', MATCH_ID)
  expect(matchIssueDelete.error).toBeNull()

  const observationDelete = await admin
    .from('source_observations')
    .delete()
    .in('source_record_id', [ingestPlan.sourceRecord.sourceRecordId, AMBIG_RECORD_ID])
  expect(observationDelete.error).toBeNull()

  const recordDelete = await admin
    .from('source_records')
    .delete()
    .in('source_record_id', [ingestPlan.sourceRecord.sourceRecordId, AMBIG_RECORD_ID])
  expect(recordDelete.error).toBeNull()

  const sourceDelete = await admin
    .from('sources')
    .delete()
    .in('source_id', [ingestPlan.source.sourceId, AMBIG_SOURCE_ID])
  expect(sourceDelete.error).toBeNull()

  const matchEntityDelete = await admin.from('entities').delete().eq('entity_id', MATCH_ID)
  expect(matchEntityDelete.error).toBeNull()

  const dependentEntityDelete = await admin
    .from('entities')
    .delete()
    .in('entity_id', [
      MATCH_HOME_PLAYER_ID,
      MATCH_AWAY_PLAYER_ID,
      MATCH_HOME_TEAM_ID,
      MATCH_AWAY_TEAM_ID,
      MATCH_VENUE_ID,
      MATCH_SEASON_ID,
    ])
  expect(dependentEntityDelete.error).toBeNull()

  const rootEntityIds = [
    MATCH_COMPETITION_ID,
    AMBIG_ENTITY_A,
    AMBIG_ENTITY_B,
    ingestPlan.competitionCandidate?.canonicalId,
  ].filter((value): value is string => Boolean(value))
  const rootEntityDelete = await admin.from('entities').delete().in('entity_id', rootEntityIds)
  expect(rootEntityDelete.error).toBeNull()

  const anonProbeDelete = await admin.from('entities').delete().eq('entity_id', ANON_WRITE_PROBE_ID)
  expect(anonProbeDelete.error).toBeNull()
}

describe('Supabase staging smoke V0.1', () => {
  it('validates INGEST -> AI -> MATCH -> APP against the real staging project and cleans up', async () => {
    const publicEnv = requireStagingEnvironment()
    const fixture = await loadFixture()
    const ingestPlan = buildOfflinePlan(fixture, NOW)
    const admin = createAdminSupabaseClient()
    const anon = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    await expectSmokeIdsAbsent(admin, ingestPlan)

    const summary = {
      staging_ref: STAGING_REF,
      ingest: { source_records: 0, observations: 0, idempotent: false },
      ai: { source_backed: false, ambiguity_review: false },
      match: { fixture: false, lineup_rows: 0, events: 0, official_result: false },
      app: { read_match: false, read_competition: false, write_free: false },
      rls: { anon_read_blocked: false, anon_write_blocked: false },
      cleanup: false,
    }

    try {
      const ingestRepository = new SupabaseIngestRepository(admin)
      const logger = new CollectingIngestLogger()
      const firstIngest = await ingestFecafootDocument(ingestRepository, fixture, {
        now: NOW,
        logger,
      })

      const recordCheck = await admin
        .from('source_records')
        .select('source_record_id')
        .eq('source_record_id', firstIngest.sourceRecordId)
      const observationCheck = await admin
        .from('source_observations')
        .select('observation_id')
        .eq('source_record_id', firstIngest.sourceRecordId)
      expect(recordCheck.error).toBeNull()
      expect(recordCheck.data).toHaveLength(1)
      expect(observationCheck.error).toBeNull()
      expect(observationCheck.data).toHaveLength(firstIngest.observationIds.length)
      summary.ingest.source_records = recordCheck.data?.length ?? 0
      summary.ingest.observations = observationCheck.data?.length ?? 0

      const secondIngest = await ingestFecafootDocument(ingestRepository, fixture, {
        now: NOW,
        logger,
      })
      expect(secondIngest.sourceRecordId).toBe(firstIngest.sourceRecordId)
      expect(secondIngest.observationIds).toEqual(firstIngest.observationIds)

      const recordCountAfter = await admin
        .from('source_records')
        .select('source_record_id')
        .eq('source_record_id', firstIngest.sourceRecordId)
      const observationCountAfter = await admin
        .from('source_observations')
        .select('observation_id')
        .eq('source_record_id', firstIngest.sourceRecordId)
      expect(recordCountAfter.data).toHaveLength(1)
      expect(observationCountAfter.data).toHaveLength(firstIngest.observationIds.length)
      summary.ingest.idempotent = true

      const aiService = new AiV01Service(new SupabaseAiRepository(admin))
      const aiIngest = await aiService.analyzeSourceRecord(firstIngest.sourceRecordId, {
        apply: true,
        now: NOW,
      })
      expect(aiIngest.extractedFacts).toHaveLength(firstIngest.observationIds.length)
      expect(
        aiIngest.extractedFacts.every(
          (fact) =>
            fact.sourceRecordId === firstIngest.sourceRecordId &&
            firstIngest.observationIds.includes(fact.observationId),
        ),
      ).toBe(true)
      expect(
        aiIngest.decisions.some(
          (decision) =>
            decision.entityType === 'season' &&
            decision.decision === 'review_required' &&
            decision.reasonCode === 'AI_IDENTITY_EVIDENCE_MISSING',
        ),
      ).toBe(true)
      summary.ai.source_backed = true

      await seedAmbiguousAiFixture(admin)
      const ambiguous = await aiService.analyzeSourceRecord(AMBIG_RECORD_ID, {
        apply: true,
        now: NOW,
      })
      expect(ambiguous.decisions[0]).toMatchObject({
        decision: 'review_required',
        reasonCode: 'AI_IDENTITY_AMBIGUOUS',
        canonicalEntityId: null,
      })
      const ambiguousIssueId = ambiguous.decisions[0]?.validationIssueId
      expect(ambiguousIssueId).toBeTruthy()
      const ambiguousIssue = await admin
        .from('validation_issues')
        .select('validation_issue_id,rule_code')
        .eq('validation_issue_id', ambiguousIssueId as string)
        .maybeSingle()
      expect(ambiguousIssue.error).toBeNull()
      expect(ambiguousIssue.data?.rule_code).toBe('AI_IDENTITY_AMBIGUOUS')
      const ambiguousObservation = await admin
        .from('source_observations')
        .select('subject_entity_id,status')
        .eq('observation_id', AMBIG_OBSERVATION_ID)
        .single()
      expect(ambiguousObservation.error).toBeNull()
      expect(ambiguousObservation.data).toMatchObject({
        subject_entity_id: null,
        status: 'candidate',
      })
      summary.ai.ambiguity_review = true

      await seedMatchPrerequisites(admin)
      const matchService = new MatchService(new SupabaseMatchRepository())
      await matchService.createFixture({
        matchId: MATCH_ID,
        seasonId: MATCH_SEASON_ID,
        homeTeamId: MATCH_HOME_TEAM_ID,
        awayTeamId: MATCH_AWAY_TEAM_ID,
        scheduledDate: '2026-10-04',
        kickoffPrecision: 'unknown',
        venueId: MATCH_VENUE_ID,
        matchday: 1,
        roundLabel: '[STAGING TEST] Smoke Round',
      })
      summary.match.fixture = true

      const lineup = await matchService.setLineup(MATCH_ID, {
        players: [
          {
            matchPlayerId: MATCH_HOME_PLAYER_ROW_ID,
            playerId: MATCH_HOME_PLAYER_ID,
            teamId: MATCH_HOME_TEAM_ID,
            squadRole: 'starter',
            shirtNumber: 9,
            captain: true,
          },
          {
            matchPlayerId: MATCH_AWAY_PLAYER_ROW_ID,
            playerId: MATCH_AWAY_PLAYER_ID,
            teamId: MATCH_AWAY_TEAM_ID,
            squadRole: 'starter',
            shirtNumber: 10,
            captain: true,
          },
        ],
      })
      expect(lineup).toHaveLength(2)
      summary.match.lineup_rows = lineup.length

      await matchService.transitionStatus(MATCH_ID, 'live')
      const events = await matchService.recordEvent(MATCH_ID, {
        eventId: MATCH_EVENT_ID,
        eventType: 'goal',
        period: '1H',
        sequenceNumber: 1,
        minute: 31,
        teamId: MATCH_HOME_TEAM_ID,
        playerId: MATCH_HOME_PLAYER_ID,
        metadata: { staging_test: true, synthetic: true },
      })
      expect(events).toHaveLength(1)
      summary.match.events = events.length

      const observed = await matchService.finishMatch(MATCH_ID, { eventFeedComplete: true })
      expect(observed).toMatchObject({ score90Home: 1, score90Away: 0 })
      const official = await matchService.validateOfficialResult(MATCH_ID, {
        officialScoreHome: 1,
        officialScoreAway: 0,
        decisionType: 'regulation',
        winnerTeamId: MATCH_HOME_TEAM_ID,
      })
      expect(official).toEqual({ status: 'validated' })
      summary.match.official_result = true

      const beforeAppRead = await snapshotMatchRows(admin)
      const appMatch = await getMatchDetail(MATCH_ID)
      const appCompetition = await getCompetitionDetail(MATCH_COMPETITION_ID)
      expect(appMatch?.match).toMatchObject({
        id: MATCH_ID,
        scoreHome: 1,
        scoreAway: 0,
        status: 'finished',
      })
      expect(appMatch?.events).toHaveLength(1)
      expect(appMatch?.lineups).toHaveLength(2)
      expect(appCompetition?.competition.entity_id).toBe(MATCH_COMPETITION_ID)
      expect(appCompetition?.seasons[0]?.matches[0]?.id).toBe(MATCH_ID)
      summary.app.read_match = true
      summary.app.read_competition = true

      const afterAppRead = await snapshotMatchRows(admin)
      expect(afterAppRead).toEqual(beforeAppRead)
      summary.app.write_free = true

      const anonRead = await anon.from('matches').select('entity_id').eq('entity_id', MATCH_ID)
      expect(anonRead.error).toBeNull()
      expect(anonRead.data).toEqual([])
      summary.rls.anon_read_blocked = true

      const anonWrite = await anon
        .from('entities')
        .insert({ entity_id: ANON_WRITE_PROBE_ID, entity_type: 'match' })
      expect(anonWrite.error).not.toBeNull()
      const probeCheck = await admin
        .from('entities')
        .select('entity_id')
        .eq('entity_id', ANON_WRITE_PROBE_ID)
      expect(probeCheck.error).toBeNull()
      expect(probeCheck.data).toEqual([])
      summary.rls.anon_write_blocked = true

      console.info(JSON.stringify({ component: 'staging-smoke', phase: 'verified', summary }))
    } finally {
      await cleanup(admin, ingestPlan)
      await expectSmokeIdsAbsent(admin, ingestPlan)
      summary.cleanup = true
      console.info(
        JSON.stringify({
          component: 'staging-smoke',
          phase: 'cleanup',
          cleanup: 'complete',
          staging_ref: STAGING_REF,
        }),
      )
    }

    expect(summary).toMatchObject({
      ingest: { source_records: 1, observations: 5, idempotent: true },
      ai: { source_backed: true, ambiguity_review: true },
      match: { fixture: true, lineup_rows: 2, events: 1, official_result: true },
      app: { read_match: true, read_competition: true, write_free: true },
      rls: { anon_read_blocked: true, anon_write_blocked: true },
      cleanup: true,
    })
  }, 90_000)
})
