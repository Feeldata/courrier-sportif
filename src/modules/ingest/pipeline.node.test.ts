import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { CollectingIngestLogger } from './logger.ts'
import { MemoryIngestRepository } from './memory-repository.ts'
import { ingestFecafootDocument } from './pipeline.ts'
import type { FetchedSourceDocument } from './types.ts'

const fixtureUrl = new URL('./fixtures/fecafoot-elite-one-launch-2026.json', import.meta.url)

async function fixture(): Promise<FetchedSourceDocument> {
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as FetchedSourceDocument
}

test('critical path persists provenance, canonical competition and review issue', async () => {
  const repository = new MemoryIngestRepository()
  const logger = new CollectingIngestLogger()
  const document = await fixture()
  const first = await ingestFecafootDocument(repository, document, {
    now: '2026-09-19T21:50:00.000Z',
    logger,
  })

  assert.equal(first.canonicalEntityIds.length, 1)
  assert.equal(first.reviewIssueIds.length, 1)
  assert.equal(repository.sources.size, 1)
  assert.equal(repository.sourceRecords.size, 1)
  assert.equal(repository.observations.size, 5)
  assert.equal(repository.competitions.size, 1)
  assert.equal(repository.reviewIssues.size, 1)
  assert.equal(
    [...repository.observations.values()].filter((item) => item.status === 'accepted').length,
    4,
  )
  assert.equal(
    [...repository.observations.values()].filter((item) => item.status === 'candidate').length,
    1,
  )

  const second = await ingestFecafootDocument(repository, document, {
    now: '2026-09-19T21:50:00.000Z',
    logger,
  })
  assert.deepEqual(second.canonicalEntityIds, first.canonicalEntityIds)
  assert.equal(repository.sources.size, 1)
  assert.equal(repository.sourceRecords.size, 1)
  assert.equal(repository.observations.size, 5)
  assert.equal(repository.competitions.size, 1)
  assert.equal(repository.reviewIssues.size, 1)
})

test('dry-run performs zero writes', async () => {
  const repository = new MemoryIngestRepository()
  const result = await ingestFecafootDocument(repository, await fixture(), {
    dryRun: true,
    now: '2026-09-19T21:50:00.000Z',
    logger: new CollectingIngestLogger(),
  })
  assert.equal(result.dryRun, true)
  assert.equal(result.canonicalEntityIds.length, 1)
  assert.equal(repository.sources.size, 0)
  assert.equal(repository.sourceRecords.size, 0)
  assert.equal(repository.observations.size, 0)
  assert.equal(repository.competitions.size, 0)
  assert.equal(repository.reviewIssues.size, 0)
})

test('multiple normalized identity matches are queued instead of guessed', async () => {
  const repository = new MemoryIngestRepository()
  repository.competitions.set('00000000-0000-5000-8000-000000000001', {
    entityId: '00000000-0000-5000-8000-000000000001',
    name: 'MTN Elite One',
    competitionType: 'league',
    countryCode: 'CM',
    organizerName: 'Fédération Camerounaise de Football',
    gender: 'male',
    ageCategory: 'senior',
  })
  repository.competitions.set('00000000-0000-5000-8000-000000000002', {
    entityId: '00000000-0000-5000-8000-000000000002',
    name: 'MTN Élite One',
    competitionType: 'league',
    countryCode: 'CM',
    organizerName: 'Fédération Camerounaise de Football',
    gender: 'male',
    ageCategory: 'senior',
  })

  const result = await ingestFecafootDocument(repository, await fixture(), {
    now: '2026-09-19T21:50:00.000Z',
    logger: new CollectingIngestLogger(),
  })
  assert.equal(result.canonicalEntityIds.length, 0)
  assert.ok(
    [...repository.reviewIssues.values()].some(
      (issue) => issue.ruleCode === 'INGEST_COMPETITION_IDENTITY_AMBIGUOUS',
    ),
  )
})
