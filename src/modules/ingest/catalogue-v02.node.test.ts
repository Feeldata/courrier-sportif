import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { stableUuid } from './core.ts'
import {
  ELITE_ONE_COMPETITION_ID,
  ingestCatalogueDocument,
  seasonEntityId,
  type CatalogueDocument,
} from './catalogue-v02.ts'
import { MemoryCatalogueRepository } from './catalogue-v02-memory.ts'
import { SupabaseCatalogueRepository } from './catalogue-v02-supabase.ts'
import { parseFecafootFixtures } from './fixtures-v02.ts'

const now = '2026-09-25T07:00:00.000Z'
async function fixture(name: string): Promise<CatalogueDocument> {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
}
function repository(): MemoryCatalogueRepository {
  const repo = new MemoryCatalogueRepository()
  repo.competitions.add(ELITE_ONE_COMPETITION_ID)
  repo.entities.set(ELITE_ONE_COMPETITION_ID, 'competition')
  return repo
}
async function seed2025(repo: MemoryCatalogueRepository): Promise<string> {
  const seasonId = seasonEntityId('2025-2026')
  repo.seasons.set(seasonId, { competitionId: ELITE_ONE_COMPETITION_ID, name: '2025-2026' })
  repo.entities.set(seasonId, 'season')
  const rows = [
    ['CANON SPORTIF DE YAOUNDE', 'CANON SPORTIF'],
    ['STADE RENARD DE MELONG', 'STADE RENARD'],
    ['UNISPORT DE BAFANG', 'UNISPORT'],
    ['AIGLE ROYAL DE LA MENOUA', 'AIGLE DE LA MENOUA'],
  ]
  for (const [name, alias] of rows) {
    const teamId = stableUuid(`test-team:${name}`)
    const clubId = stableUuid(`test-club:${name}`)
    repo.entities.set(teamId, 'team')
    repo.entities.set(clubId, 'club')
    repo.clubs.set(clubId, name)
    repo.teams.set(teamId, { name, clubId })
    repo.entries.set(stableUuid(`entry:${seasonId}:${teamId}`), { seasonId, teamId })
    await repo.addIdentityNames('team', teamId, alias)
  }
  return seasonId
}

test('Gate A reuses the canonical competition, is deterministic and dry-run writes nothing', async () => {
  const repo = repository()
  const regulation = await fixture('fecafoot-elite-one-regulation-2026-2027')
  const dry = await ingestCatalogueDocument(repo, regulation, { dryRun: true, now })
  assert.equal(dry.seasonId, seasonEntityId('2026-2027'))
  assert.equal(dry.canonicalIds.length, 1)
  assert.equal(repo.seasons.size, 0)
  assert.equal(repo.sourceRecords.size, 0)
  assert.equal(repo.observations.size, 0)

  const first = await ingestCatalogueDocument(repo, regulation, { dryRun: false, now })
  const second = await ingestCatalogueDocument(repo, regulation, { dryRun: false, now })
  assert.deepEqual(first.canonicalIds, second.canonicalIds)
  assert.equal(repo.competitions.size, 1)
  assert.equal(repo.seasons.size, 1)
  assert.equal(repo.seasons.get(first.seasonId)?.competitionId, ELITE_ONE_COMPETITION_ID)
  assert.equal(repo.sourceRecords.size, 1)
  assert.equal(
    [...repo.observations.values()].filter(
      (x) => x.subjectEntityId === first.seasonId && x.status === 'accepted',
    ).length,
    2,
  )
})

test('Gate A fails without the pre-existing canonical competition or official role', async () => {
  const regulation = await fixture('fecafoot-elite-one-regulation-2026-2027')
  await assert.rejects(
    ingestCatalogueDocument(new MemoryCatalogueRepository(), regulation),
    /Canonical MTN Elite One competition is absent/,
  )
  const repo = repository()
  await assert.rejects(
    ingestCatalogueDocument(repo, { ...regulation, url: 'https://example.org/reglement' }),
    /official FECAFOOT/,
  )
  await assert.rejects(
    ingestCatalogueDocument(repo, { ...regulation, title: 'MTN Elite One 2026-2027 blog post' }),
    /official role/,
  )
})

test('2026-2027 participant and fixture gates remain closed without published evidence', async () => {
  const repo = repository()
  const regulation = await fixture('fecafoot-elite-one-regulation-2026-2027')
  await ingestCatalogueDocument(repo, regulation, { dryRun: false, now })
  const forgedParticipants: CatalogueDocument = {
    ...regulation,
    url: 'https://fecafoot-officiel.com/actualite/liste-clubs-2026-2027/',
    title: 'LISTE DES CLUBS MTN ELITE ONE 2026-2027',
    text: 'MTN ELITE ONE 2026-2027 - CLUB: Fake; TEAM: Fake',
    kind: 'participant_list',
    participants: [{ club: 'Fake', team: 'Fake' }],
  }
  await assert.rejects(
    ingestCatalogueDocument(repo, forgedParticipants, { dryRun: false, now }),
    /Gate B\/C 2026-2027 closed/,
  )
  assert.equal(repo.clubs.size, 0)
  assert.equal(repo.teams.size, 0)
  assert.equal(repo.sourceRecords.size, 1)
})

test('source URL hash mutation fails closed before any write', async () => {
  const repo = repository()
  const regulation = await fixture('fecafoot-elite-one-regulation-2026-2027')
  await ingestCatalogueDocument(repo, regulation, { dryRun: false, now })
  const priorRecords = repo.sourceRecords.size
  const priorObs = repo.observations.size
  await assert.rejects(
    ingestCatalogueDocument(
      repo,
      { ...regulation, text: regulation.text + ' changed' },
      { dryRun: false, now },
    ),
    /INGEST_SOURCE_URL_CONTENT_CHANGED/,
  )
  assert.equal(repo.sourceRecords.size, priorRecords)
  assert.equal(repo.observations.size, priorObs)
  assert.equal(repo.seasons.size, 1)
})

test('identity bootstrap requires an explicit reviewed batch; exact alias and external ID resolve', async () => {
  const repo = repository()
  await seed2025(repo)
  // Synthetic memory-only participant extract exercises review; it is not a 2026-2027 publication.
  const participants: CatalogueDocument = {
    url: 'https://fecafoot-officiel.com/actualite/liste-clubs-elite-one-2025-2026/2026/01/01/',
    title: 'LISTE DES CLUBS MTN ELITE ONE 2025-2026',
    text: 'MTN ELITE ONE 2025-2026\nCLUB: FC TEST DE YAOUNDE; TEAM: FC TEST DE YAOUNDE',
    publishedAt: '2026-01-01T00:00:00.000Z',
    publishedAtPrecision: 'date',
    captureMode: 'verified_excerpt',
    kind: 'participant_list',
    participants: [
      { club: 'FC TEST DE YAOUNDE', team: 'FC TEST DE YAOUNDE', externalId: 'FC-TEST' },
    ],
  }
  const dry = await ingestCatalogueDocument(repo, participants, { dryRun: true, now })
  assert.equal(dry.canonicalIds.length, 0)
  assert.equal(repo.reviewIssues.size, 0)
  const pending = await ingestCatalogueDocument(repo, participants, { dryRun: false, now })
  assert.equal(pending.canonicalIds.length, 0)
  assert.equal(pending.reviewIssueIds.length, 2)
  assert.equal(repo.clubs.size, 4)
  assert.equal(repo.teams.size, 4)
  assert.equal(repo.sourceRecords.size, 1)
  for (const id of pending.reviewIssueIds) {
    const proposed = repo.reviewIssues.get(id)?.details.proposed_entity_id
    assert.equal(typeof proposed, 'string')
    repo.approvals.set(id, { entityId: proposed as string, createNew: true })
  }
  const accepted = await ingestCatalogueDocument(repo, participants, { dryRun: false, now })
  assert.equal(accepted.canonicalIds.length, 3)
  assert.equal(repo.clubs.size, 5)
  assert.equal(repo.teams.size, 5)
  assert.equal(repo.entries.size, 5)
  const club = await repo.findIdentityMatches('club', 'fc test de yaounde', 'FC-TEST')
  const team = await repo.findIdentityMatches('team', 'fc test de yaounde', 'FC-TEST')
  assert.equal(club.length, 1)
  assert.equal(team.length, 1)
  assert.notEqual(club[0], team[0])
  assert.equal(repo.observations.size, 3)
  assert.ok(
    [...repo.observations.values()].every((x) => x.status === 'accepted' && x.subjectEntityId),
  )
  const again = await ingestCatalogueDocument(repo, participants, { dryRun: false, now })
  assert.deepEqual(again.canonicalIds, accepted.canonicalIds)
  assert.equal(repo.clubs.size, 5)
})

test('ambiguous exact aliases block canonical team/fixture writes', async () => {
  const repo = repository()
  await seed2025(repo)
  const calendar = await fixture('fecafoot-elite-one-calendar-2025-2026')
  const another = stableUuid('another-canon-team')
  repo.entities.set(another, 'team')
  repo.teams.set(another, { name: 'Another Team', clubId: stableUuid('another-club') })
  await repo.addIdentityNames('team', another, 'CANON SPORTIF')
  const result = await ingestCatalogueDocument(repo, calendar, { dryRun: false, now })
  assert.equal(repo.matches.size, 2)
  assert.ok(
    result.reviewIssueIds.some(
      (id) => repo.reviewIssues.get(id)?.ruleCode === 'INGEST_V02_MATCH_IDENTITY_UNRESOLVED',
    ),
  )
})

test('frozen FECAFOOT calendar and matchday program parse; priority and reschedule keep the match ID', async () => {
  const repo = repository()
  await seed2025(repo)
  const calendar = await fixture('fecafoot-elite-one-calendar-2025-2026')
  const program = await fixture('fecafoot-elite-one-program-j1-2025-2026')
  assert.equal(parseFecafootFixtures(calendar, await repo.listTeamNames()).length, 4)
  assert.equal(parseFecafootFixtures(program, await repo.listTeamNames()).length, 1)
  const dry = await ingestCatalogueDocument(repo, calendar, { dryRun: true, now })
  assert.equal(dry.canonicalIds.length, 4)
  assert.equal(repo.matches.size, 0)
  assert.equal(repo.sourceRecords.size, 0)
  const general = await ingestCatalogueDocument(repo, calendar, { dryRun: false, now })
  assert.equal(repo.matches.size, 4)
  assert.equal(repo.matches.get(general.canonicalIds[0])?.kickoffAt, null)
  assert.equal(await repo.getSchedulePriority(general.canonicalIds[0]), 1)
  const second = await ingestCatalogueDocument(repo, calendar, { dryRun: false, now })
  assert.deepEqual(second.canonicalIds, general.canonicalIds)
  assert.equal(repo.matches.size, 4)
  const specific = await ingestCatalogueDocument(repo, program, { dryRun: false, now })
  assert.equal(specific.canonicalIds[0], general.canonicalIds[0])
  assert.match(repo.matches.get(general.canonicalIds[0])?.kickoffAt ?? '', /^2026-01-25T14:30:00/)
  assert.equal(await repo.getSchedulePriority(general.canonicalIds[0]), 2)
  const syntheticReschedule: CatalogueDocument = {
    ...program,
    url: 'https://fecafoot-officiel.com/actualite/reprogrammation-test-2025-2026/2026/01/24/',
    title: 'REPROGRAMMATION MTN ELITE ONE 2025-2026',
    text: program.text.replace('25 JANVIER', '26 JANVIER').replace('15H30', '18H00'),
    kind: 'reschedule',
  }
  const moved = await ingestCatalogueDocument(repo, syntheticReschedule, { dryRun: false, now })
  assert.equal(moved.canonicalIds[0], general.canonicalIds[0])
  assert.equal(repo.matches.get(general.canonicalIds[0])?.scheduledDate, '2026-01-26')
  assert.equal(await repo.getSchedulePriority(general.canonicalIds[0]), 3)
  await ingestCatalogueDocument(repo, program, { dryRun: false, now })
  assert.equal(repo.matches.get(general.canonicalIds[0])?.scheduledDate, '2026-01-26')
  assert.equal(repo.matches.size, 4)
  assert.equal(repo.sourceRecords.size, 3)
  assert.ok(
    [...repo.observations.values()].some(
      (x) =>
        x.subjectEntityId === moved.canonicalIds[0] && repo.sourceRecords.has(x.sourceRecordId),
    ),
  )
  assert.equal('players' in repo || 'statistics' in repo || 'transfers' in repo, false)
})

test('logical match collision and finished match are blocked for review', async () => {
  const repo = repository()
  await seed2025(repo)
  const calendar = await fixture('fecafoot-elite-one-calendar-2025-2026')
  const first = await ingestCatalogueDocument(repo, calendar, { dryRun: false, now })
  const match = repo.matches.get(first.canonicalIds[0])
  assert.ok(match)
  repo.matches.set(stableUuid('same-logical-fixture'), {
    ...match,
    entityId: stableUuid('same-logical-fixture'),
  })
  const collision = await ingestCatalogueDocument(repo, calendar, { dryRun: false, now })
  assert.ok(
    collision.reviewIssueIds.some(
      (id) => repo.reviewIssues.get(id)?.ruleCode === 'INGEST_V02_MATCH_LOGICAL_COLLISION',
    ),
  )
  repo.matches.delete(stableUuid('same-logical-fixture'))
  repo.matches.set(match.entityId, { ...match, status: 'finished' })
  const locked = await ingestCatalogueDocument(
    repo,
    await fixture('fecafoot-elite-one-program-j1-2025-2026'),
    { dryRun: false, now },
  )
  assert.ok(
    locked.reviewIssueIds.some(
      (id) => repo.reviewIssues.get(id)?.ruleCode === 'INGEST_V02_MATCH_STATUS_LOCKED',
    ),
  )
  assert.equal(repo.matches.get(match.entityId)?.status, 'finished')
})

test('Supabase adapter rejects both production mode and a non-staging client URL', () => {
  const names = ['NEXT_PUBLIC_APP_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_PROJECT_REF'] as const
  const before = names.map((name) => process.env[name])
  try {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    process.env.SUPABASE_PROJECT_REF = 'dlilhxaixpnabefqloxs'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dlilhxaixpnabefqloxs.supabase.co'
    assert.throws(
      () =>
        new SupabaseCatalogueRepository({
          supabaseUrl: 'https://other.supabase.co',
        } as never),
      /authorized staging/,
    )
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    assert.throws(
      () =>
        new SupabaseCatalogueRepository({
          supabaseUrl: 'https://dlilhxaixpnabefqloxs.supabase.co',
        } as never),
      /authorized staging/,
    )
  } finally {
    names.forEach((name, index) => {
      if (before[index] === undefined) delete process.env[name]
      else process.env[name] = before[index]
    })
  }
})
