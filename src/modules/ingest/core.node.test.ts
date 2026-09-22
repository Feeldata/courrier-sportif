import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  FECAFOOT_SOURCE,
  buildOfflinePlan,
  extractFrenchDate,
  normalizeIdentity,
  stableUuid,
} from './core.ts'
import type { FetchedSourceDocument } from './types.ts'

const fixtureUrl = new URL('./fixtures/fecafoot-elite-one-launch-2026.json', import.meta.url)

async function fixture(): Promise<FetchedSourceDocument> {
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as FetchedSourceDocument
}

test('identity normalization is accent/case/punctuation stable', () => {
  assert.equal(normalizeIdentity('  MTN Élite-One  '), 'mtn elite one')
  assert.equal(normalizeIdentity('MTN Elite One'), 'mtn elite one')
})

test('stable UUIDs are deterministic and valid-shaped', () => {
  const one = stableUuid('source:fecafoot-officiel.com')
  const two = stableUuid('source:fecafoot-officiel.com')
  assert.equal(one, two)
  assert.match(one, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(one, FECAFOOT_SOURCE.sourceId)
})

test('French source date extraction normalizes to ISO date', () => {
  assert.equal(extractFrenchDate('24 janvier 2026'), '2026-01-24')
  assert.equal(extractFrenchDate('1er janvier 2026'), '2026-01-01')
})

test('real FECAFOOT sample yields provenance, canonical competition candidate and season review', async () => {
  const plan = buildOfflinePlan(await fixture(), '2026-09-19T21:50:00.000Z')
  assert.equal(plan.source.name, 'FECAFOOT — site officiel')
  assert.match(plan.sourceRecord.contentHash, /^sha256:[0-9a-f]{64}$/)
  assert.equal(plan.observations.length, 5)
  assert.ok(plan.observations.every((item) => item.status === 'candidate'))
  assert.equal(plan.competitionCandidate?.name, 'MTN Elite One')
  assert.equal(plan.competitionCandidate?.competitionType, 'league')
  assert.ok((plan.competitionCandidate?.confidence ?? 0) >= 0.95)
  assert.equal(plan.reviewIssues.length, 1)
  assert.equal(plan.reviewIssues[0]?.ruleCode, 'INGEST_SEASON_IDENTITY_UNRESOLVED')
})
