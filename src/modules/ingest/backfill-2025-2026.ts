import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeIdentity, stableUuid } from './core.ts'
import { ELITE_ONE_COMPETITION_ID, seasonEntityId } from './catalogue-v02.ts'
import type { Database } from '../../lib/supabase/database.types.ts'

export const BACKFILL_SEASON = '2025-2026'
export const BACKFILL_SEASON_ID = '0f8a8cd9-f265-5943-adcb-fa758823d96c'
export const BACKFILL_STAGING_REF = 'dlilhxaixpnabefqloxs'

export type ApprovedIdentity = {
  name: string
  club_id: string
  team_id: string
  source_header: string
  calendar_alias: string
  aliases: string[]
}

export type ApprovedIdentityManifest = {
  season_id: string
  competition_id: string
  approval: string
  participant_source_url: string
  participant_source_sha256: string
  identities: ApprovedIdentity[]
}

export type FrozenCalendarFixture = {
  source_fixture_number: number
  matchday: number
  home: string
  away: string
  scheduled_date: string
  raw_date: string
}

export type FrozenCalendarManifest = {
  schema_version: string
  source_url: string
  source_sha256: string
  extractor: string
  fixtures: FrozenCalendarFixture[]
}

export type PlannedFixture = FrozenCalendarFixture & {
  home_team_id: string
  away_team_id: string
  match_id: string
}

export type BackfillPlan = {
  seasonId: string
  competitionId: string
  manifestSha256: string
  identities: ApprovedIdentity[]
  fixtures: PlannedFixture[]
}

const trackedTables = [
  'competitions',
  'seasons',
  'clubs',
  'teams',
  'team_season_entries',
  'matches',
  'match_results',
  'sources',
  'source_records',
  'source_observations',
  'validation_issues',
  'players',
  'player_team_memberships',
  'match_players',
  'match_events',
  'stat_values',
  'stat_definitions',
] as const

export type StagingPreflight = {
  manifestSha256: string
  baselineCounts: Record<(typeof trackedTables)[number], number>
  existingSeason: boolean
  existingClubs: number
  existingTeams: number
  existingEntries: number
  existingFixtures: number
  missingFixtures: number
  writeCount: 0
}

function checked(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`BACKFILL_PREFLIGHT_${operation}: ${error.message}`)
}

export async function preflightStagingBackfill(
  client: SupabaseClient<Database>,
  plan: BackfillPlan,
): Promise<StagingPreflight> {
  assertStagingBackfillEnvironment(
    process.env.NEXT_PUBLIC_APP_ENV,
    process.env.SUPABASE_PROJECT_REF,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
  if (
    (client as unknown as { supabaseUrl?: string }).supabaseUrl !==
    `https://${BACKFILL_STAGING_REF}.supabase.co`
  ) {
    throw new Error('BACKFILL_STAGING_ONLY')
  }
  const baselineCounts = {} as StagingPreflight['baselineCounts']
  for (const table of trackedTables) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
    checked(error, `count_${table}`)
    if (count === null) throw new Error(`BACKFILL_PREFLIGHT_COUNT_UNAVAILABLE: ${table}`)
    baselineCounts[table] = count
  }
  const [competition, seasons, clubs, teams, entries, matches] = await Promise.all([
    client.from('competitions').select('entity_id').eq('entity_id', plan.competitionId),
    client
      .from('seasons')
      .select('entity_id,competition_id,name')
      .eq('competition_id', plan.competitionId)
      .eq('name', BACKFILL_SEASON),
    client.from('clubs').select('entity_id,official_name'),
    client.from('teams').select('entity_id,name,club_id'),
    client
      .from('team_season_entries')
      .select('entry_id,season_id,team_id')
      .eq('season_id', plan.seasonId),
    client
      .from('matches')
      .select('entity_id,season_id,matchday,home_team_id,away_team_id')
      .eq('season_id', plan.seasonId),
  ])
  checked(competition.error, 'competition')
  checked(seasons.error, 'season')
  checked(clubs.error, 'clubs')
  checked(teams.error, 'teams')
  checked(entries.error, 'entries')
  checked(matches.error, 'matches')
  if (competition.data?.length !== 1) throw new Error('BACKFILL_COMPETITION_NOT_REUSED')
  if (
    (seasons.data ?? []).length > 1 ||
    (seasons.data?.[0] && seasons.data[0].entity_id !== plan.seasonId)
  ) {
    throw new Error('BACKFILL_SEASON_ID_COLLISION')
  }
  const approvedClubs = new Map(plan.identities.map((row) => [row.club_id, row]))
  const approvedTeams = new Map(plan.identities.map((row) => [row.team_id, row]))
  for (const club of clubs.data ?? []) {
    const approved = approvedClubs.get(club.entity_id)
    if (approved && club.official_name !== approved.name) {
      throw new Error(`BACKFILL_CLUB_ID_COLLISION: ${club.entity_id}`)
    }
    if (
      !approved &&
      plan.identities.some(
        (identity) => normalizeIdentity(identity.name) === normalizeIdentity(club.official_name),
      )
    ) {
      throw new Error(`BACKFILL_CLUB_NAME_COLLISION: ${club.entity_id}`)
    }
  }
  for (const team of teams.data ?? []) {
    const approved = approvedTeams.get(team.entity_id)
    if (approved && (team.name !== approved.name || team.club_id !== approved.club_id)) {
      throw new Error(`BACKFILL_TEAM_ID_COLLISION: ${team.entity_id}`)
    }
    if (
      !approved &&
      plan.identities.some(
        (identity) => normalizeIdentity(identity.name) === normalizeIdentity(team.name),
      )
    ) {
      throw new Error(`BACKFILL_TEAM_NAME_COLLISION: ${team.entity_id}`)
    }
  }
  for (const entry of entries.data ?? []) {
    const approved = approvedTeams.get(entry.team_id)
    if (!approved || entry.entry_id !== stableUuid(`entry:${plan.seasonId}:${entry.team_id}`)) {
      throw new Error(`BACKFILL_ENTRY_COLLISION: ${entry.entry_id}`)
    }
  }
  const plannedById = new Map(plan.fixtures.map((row) => [row.match_id, row]))
  const existingLogical = new Set<string>()
  for (const match of matches.data ?? []) {
    const key = `${match.matchday}:${match.home_team_id}:${match.away_team_id}`
    const expected = plannedById.get(match.entity_id)
    if (
      !expected ||
      expected.matchday !== match.matchday ||
      expected.home_team_id !== match.home_team_id ||
      expected.away_team_id !== match.away_team_id ||
      existingLogical.has(key)
    ) {
      throw new Error(`BACKFILL_LOGICAL_FIXTURE_COLLISION: ${key}`)
    }
    existingLogical.add(key)
  }
  return {
    manifestSha256: plan.manifestSha256,
    baselineCounts,
    existingSeason: seasons.data?.length === 1,
    existingClubs: (clubs.data ?? []).filter((row) => approvedClubs.has(row.entity_id)).length,
    existingTeams: (teams.data ?? []).filter((row) => approvedTeams.has(row.entity_id)).length,
    existingEntries: entries.data?.length ?? 0,
    existingFixtures: matches.data?.length ?? 0,
    missingFixtures: plan.fixtures.length - (matches.data?.length ?? 0),
    writeCount: 0,
  }
}

function officialUrl(url: string): void {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'fecafoot-officiel.com') {
    throw new Error('BACKFILL_NON_OFFICIAL_SOURCE')
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function assertStagingBackfillEnvironment(
  appEnv: string | undefined,
  projectRef: string | undefined,
  projectUrl: string | undefined,
): void {
  if (
    appEnv !== 'staging' ||
    projectRef !== BACKFILL_STAGING_REF ||
    projectUrl !== `https://${BACKFILL_STAGING_REF}.supabase.co`
  ) {
    throw new Error('BACKFILL_STAGING_ONLY')
  }
}

export async function verifyFrozenOfficialSource(
  url: string,
  expectedSha256: string,
): Promise<void> {
  officialUrl(url)
  if (!/^[0-9a-f]{64}$/.test(expectedSha256)) throw new Error('BACKFILL_SOURCE_HASH_MISSING')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`BACKFILL_SOURCE_FETCH_FAILED: HTTP ${response.status}`)
  const actual = createHash('sha256')
    .update(Buffer.from(await response.arrayBuffer()))
    .digest('hex')
  if (actual !== expectedSha256) {
    throw new Error('INGEST_SOURCE_URL_CONTENT_CHANGED: frozen FECAFOOT SHA-256 mismatch')
  }
}

export function buildBackfillPlan(
  identities: ApprovedIdentityManifest,
  calendar: FrozenCalendarManifest,
): BackfillPlan {
  if (
    identities.competition_id !== ELITE_ONE_COMPETITION_ID ||
    identities.season_id !== BACKFILL_SEASON_ID ||
    seasonEntityId(BACKFILL_SEASON) !== BACKFILL_SEASON_ID ||
    identities.approval !==
      'https://github.com/Feeldata/courrier-sportif/issues/7#issuecomment-5838269968'
  ) {
    throw new Error('BACKFILL_APPROVED_BASELINE_MISMATCH')
  }
  officialUrl(identities.participant_source_url)
  officialUrl(calendar.source_url)
  if (
    !/^[0-9a-f]{64}$/.test(identities.participant_source_sha256) ||
    !/^[0-9a-f]{64}$/.test(calendar.source_sha256)
  ) {
    throw new Error('BACKFILL_SOURCE_HASH_MISSING')
  }
  if (identities.identities.length !== 14 || calendar.fixtures.length !== 182) {
    throw new Error('BACKFILL_CANONICAL_COUNT_MISMATCH')
  }

  const aliasToIdentity = new Map<string, ApprovedIdentity>()
  const clubIds = new Set<string>()
  const teamIds = new Set<string>()
  for (const identity of identities.identities) {
    const normalized = normalizeIdentity(identity.name)
    if (
      identity.club_id !== stableUuid(`entity:club:CM:${normalized}`) ||
      identity.team_id !== stableUuid(`entity:team:CM:${normalized}`) ||
      clubIds.has(identity.club_id) ||
      teamIds.has(identity.team_id)
    ) {
      throw new Error(`BACKFILL_UNAPPROVED_IDENTITY: ${identity.name}`)
    }
    clubIds.add(identity.club_id)
    teamIds.add(identity.team_id)
    for (const name of [
      identity.name,
      identity.source_header,
      identity.calendar_alias,
      ...identity.aliases,
    ]) {
      const alias = normalizeIdentity(name)
      const prior = aliasToIdentity.get(alias)
      if (prior && prior.team_id !== identity.team_id) {
        throw new Error(`BACKFILL_AMBIGUOUS_ALIAS: ${name}`)
      }
      aliasToIdentity.set(alias, identity)
    }
  }

  const fixtureNumbers = new Set<number>()
  const fixtureIds = new Set<string>()
  const logical = new Set<string>()
  const matchdays = new Map<number, number>()
  const homeCounts = new Map<string, number>()
  const awayCounts = new Map<string, number>()
  const pairCounts = new Map<string, { total: number; directions: Set<string> }>()
  const fixtures = calendar.fixtures.map((fixture): PlannedFixture => {
    const expectedMatchday =
      fixture.source_fixture_number <= 91
        ? Math.ceil(fixture.source_fixture_number / 7)
        : 14 + Math.floor((fixture.source_fixture_number - 92) / 7)
    const home = aliasToIdentity.get(normalizeIdentity(fixture.home))
    const away = aliasToIdentity.get(normalizeIdentity(fixture.away))
    if (!home || !away || home.team_id === away.team_id) {
      throw new Error(`BACKFILL_UNAPPROVED_IDENTITY: fixture ${fixture.source_fixture_number}`)
    }
    if (
      !Number.isInteger(fixture.source_fixture_number) ||
      fixture.matchday !== expectedMatchday ||
      fixtureNumbers.has(fixture.source_fixture_number) ||
      !/^2026-\d{2}-\d{2}$/.test(fixture.scheduled_date)
    ) {
      throw new Error(`BACKFILL_CALENDAR_ROW_INVALID: ${fixture.source_fixture_number}`)
    }
    fixtureNumbers.add(fixture.source_fixture_number)
    const key = `${fixture.matchday}:${home.team_id}:${away.team_id}`
    const matchId = stableUuid(
      `entity:match:${BACKFILL_SEASON_ID}:${fixture.matchday}:${home.team_id}:${away.team_id}`,
    )
    if (logical.has(key) || fixtureIds.has(matchId)) {
      throw new Error(`BACKFILL_LOGICAL_FIXTURE_COLLISION: ${key}`)
    }
    logical.add(key)
    fixtureIds.add(matchId)
    matchdays.set(fixture.matchday, (matchdays.get(fixture.matchday) ?? 0) + 1)
    homeCounts.set(home.team_id, (homeCounts.get(home.team_id) ?? 0) + 1)
    awayCounts.set(away.team_id, (awayCounts.get(away.team_id) ?? 0) + 1)
    const pair = [home.team_id, away.team_id].sort().join(':')
    const pairCount = pairCounts.get(pair) ?? { total: 0, directions: new Set<string>() }
    pairCount.total += 1
    pairCount.directions.add(`${home.team_id}:${away.team_id}`)
    pairCounts.set(pair, pairCount)
    return {
      ...fixture,
      home_team_id: home.team_id,
      away_team_id: away.team_id,
      match_id: matchId,
    }
  })

  if (
    [...fixtureNumbers].sort((a, b) => a - b).some((number, index) => number !== index + 1) ||
    matchdays.size !== 26 ||
    [...matchdays.values()].some((count) => count !== 7) ||
    pairCounts.size !== 91 ||
    [...pairCounts.values()].some((pair) => pair.total !== 2 || pair.directions.size !== 2) ||
    identities.identities.some(
      (identity) =>
        homeCounts.get(identity.team_id) !== 13 || awayCounts.get(identity.team_id) !== 13,
    )
  ) {
    throw new Error('BACKFILL_ROUND_ROBIN_INVARIANT_FAILED')
  }

  const manifestSha256 = sha256(JSON.stringify({ identities, calendar }))
  return {
    seasonId: BACKFILL_SEASON_ID,
    competitionId: ELITE_ONE_COMPETITION_ID,
    manifestSha256,
    identities: identities.identities,
    fixtures,
  }
}
