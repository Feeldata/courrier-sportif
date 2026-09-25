import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { buildSourceRecord } from '@/modules/ingest/core'
import {
  ELITE_ONE_COMPETITION_ID,
  ingestCatalogueDocument,
  seasonEntityId,
  type CatalogueDocument,
} from '@/modules/ingest/catalogue-v02'
import { SupabaseCatalogueRepository } from '@/modules/ingest/catalogue-v02-supabase'

const STAGING_REF = 'dlilhxaixpnabefqloxs'
const STAGING_URL = `https://${STAGING_REF}.supabase.co`
const NOW = '2026-09-25T07:00:00.000Z'
const SEASON = '2026-2027'
const fixtureUrl = new URL(
  '../modules/ingest/fixtures/fecafoot-elite-one-regulation-2026-2027.json',
  import.meta.url,
)

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

function requireStaging(): void {
  if (
    process.env.NEXT_PUBLIC_APP_ENV !== 'staging' ||
    process.env.SUPABASE_PROJECT_REF !== STAGING_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL ||
    !process.env.SUPABASE_SECRET_KEY
  ) {
    throw new Error('INGEST V0.2 smoke requires the authorized staging environment')
  }
}

async function forbiddenRowCounts(admin: AdminClient): Promise<number[]> {
  const responses = await Promise.all([
    admin.from('clubs').select('entity_id', { count: 'exact', head: true }),
    admin.from('teams').select('entity_id', { count: 'exact', head: true }),
    admin.from('team_season_entries').select('entry_id', { count: 'exact', head: true }),
    admin.from('matches').select('entity_id', { count: 'exact', head: true }),
    admin.from('players').select('entity_id', { count: 'exact', head: true }),
    admin.from('player_team_memberships').select('membership_id', { count: 'exact', head: true }),
    admin.from('stat_values').select('stat_value_id', { count: 'exact', head: true }),
    admin.from('match_events').select('event_id', { count: 'exact', head: true }),
    admin.from('match_players').select('match_player_id', { count: 'exact', head: true }),
    admin.from('match_results').select('match_id', { count: 'exact', head: true }),
  ])
  for (const response of responses) {
    expect(response.error).toBeNull()
    expect(response.count).not.toBeNull()
  }
  return responses.map((response) => response.count as number)
}

describe('INGEST V0.2 connected Gate A staging smoke', () => {
  it('reuses Elite One, persists one deterministic season with provenance, and is idempotent', async () => {
    requireStaging()
    const admin = createAdminSupabaseClient()
    const repository = new SupabaseCatalogueRepository(admin)
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as CatalogueDocument
    const expectedSource = buildSourceRecord(fixture, NOW)
    const expectedSeasonId = seasonEntityId(SEASON)
    const beforeForbidden = await forbiddenRowCounts(admin)

    const competitionBefore = await admin
      .from('competitions')
      .select('*')
      .eq('entity_id', ELITE_ONE_COMPETITION_ID)
      .single()
    expect(competitionBefore.error).toBeNull()
    expect(competitionBefore.data?.entity_id).toBe(ELITE_ONE_COMPETITION_ID)

    const seasonBefore = await admin
      .from('seasons')
      .select('entity_id')
      .eq('competition_id', ELITE_ONE_COMPETITION_ID)
      .eq('name', SEASON)
    expect(seasonBefore.error).toBeNull()
    expect(seasonBefore.data?.every((row) => row.entity_id === expectedSeasonId)).toBe(true)
    expect(seasonBefore.data?.length).toBeLessThanOrEqual(1)

    const first = await ingestCatalogueDocument(repository, fixture, { dryRun: false, now: NOW })
    const second = await ingestCatalogueDocument(repository, fixture, { dryRun: false, now: NOW })
    expect(first.seasonId).toBe(expectedSeasonId)
    expect(second).toEqual(first)
    expect(first.canonicalIds).toEqual([expectedSeasonId])
    expect(first.reviewIssueIds).toEqual([])
    expect(first.observationIds).toHaveLength(2)

    const [competitionAfter, season, entity, source, record, observations, forbiddenAfter] =
      await Promise.all([
        admin.from('competitions').select('*').eq('entity_id', ELITE_ONE_COMPETITION_ID).single(),
        admin
          .from('seasons')
          .select('entity_id,competition_id,name')
          .eq('competition_id', ELITE_ONE_COMPETITION_ID)
          .eq('name', SEASON),
        admin.from('entities').select('entity_id,entity_type').eq('entity_id', expectedSeasonId),
        admin.from('sources').select('source_id').eq('source_id', expectedSource.sourceId),
        admin.from('source_records').select('*').eq('source_record_id', first.sourceRecordId),
        admin
          .from('source_observations')
          .select('observation_id,source_record_id,subject_entity_id,status')
          .eq('source_record_id', first.sourceRecordId),
        forbiddenRowCounts(admin),
      ])
    for (const response of [competitionAfter, season, entity, source, record, observations]) {
      expect(response.error).toBeNull()
    }
    expect(competitionAfter.data).toEqual(competitionBefore.data)
    expect(season.data).toEqual([
      {
        entity_id: expectedSeasonId,
        competition_id: ELITE_ONE_COMPETITION_ID,
        name: SEASON,
      },
    ])
    expect(entity.data).toEqual([{ entity_id: expectedSeasonId, entity_type: 'season' }])
    expect(source.data).toHaveLength(1)
    expect(record.data).toHaveLength(1)
    expect(record.data?.[0]).toMatchObject({
      source_record_id: expectedSource.sourceRecordId,
      source_id: expectedSource.sourceId,
      url: fixture.url,
      content_hash: expectedSource.contentHash,
    })
    expect(record.data?.[0]?.metadata).toMatchObject({
      parser_version: 'fecafoot-catalogue-v0.2.0',
      document_kind: 'season_regulation',
    })
    expect(observations.data).toHaveLength(2)
    expect(
      observations.data?.every(
        (row) =>
          first.observationIds.includes(row.observation_id) &&
          row.source_record_id === first.sourceRecordId &&
          row.subject_entity_id === expectedSeasonId &&
          row.status === 'accepted',
      ),
    ).toBe(true)
    expect(forbiddenAfter).toEqual(beforeForbidden)

    console.info(
      JSON.stringify({
        component: 'ingest-v02-gate-a-staging',
        status: 'verified',
        staging_ref: STAGING_REF,
        competition_id: ELITE_ONE_COMPETITION_ID,
        season_id: expectedSeasonId,
        source_record_id: first.sourceRecordId,
        observations: first.observationIds.length,
        idempotent: true,
        forbidden_table_counts_unchanged: true,
        final_state: 'canonical_season_and_provenance_retained',
      }),
    )
  }, 90_000)
})
