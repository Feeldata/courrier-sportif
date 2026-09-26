import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  BACKFILL_SEASON_ID,
  assertStagingBackfillEnvironment,
  buildBackfillPlan,
  type ApprovedIdentityManifest,
  type FrozenCalendarManifest,
} from './backfill-2025-2026.ts'

async function manifests(): Promise<[ApprovedIdentityManifest, FrozenCalendarManifest]> {
  const [identities, calendar] = await Promise.all([
    readFile(new URL('./fixtures/elite-one-2025-2026-identities.json', import.meta.url), 'utf8'),
    readFile(
      new URL('./fixtures/fecafoot-elite-one-calendar-2025-2026.full.json', import.meta.url),
      'utf8',
    ),
  ])
  return [JSON.parse(identities), JSON.parse(calendar)]
}

test('approved frozen calendar yields exactly 182 deterministic round-robin fixture IDs', async () => {
  const [identities, calendar] = await manifests()
  const first = buildBackfillPlan(identities, calendar)
  const second = buildBackfillPlan(identities, calendar)
  assert.equal(first.seasonId, BACKFILL_SEASON_ID)
  assert.equal(first.identities.length, 14)
  assert.equal(first.fixtures.length, 182)
  assert.equal(new Set(first.fixtures.map((row) => row.match_id)).size, 182)
  assert.deepEqual(
    first.fixtures.map((row) => row.source_fixture_number),
    Array.from({ length: 182 }, (_, index) => index + 1),
  )
  assert.deepEqual(first, second)
})

test('unknown identity and logical fixture collision fail closed before any write', async () => {
  const [identities, calendar] = await manifests()
  const unknown: FrozenCalendarManifest = structuredClone(calendar)
  unknown.fixtures[0].home = 'INCONNU'
  assert.throws(() => buildBackfillPlan(identities, unknown), /BACKFILL_UNAPPROVED_IDENTITY/)
  const collision: FrozenCalendarManifest = structuredClone(calendar)
  collision.fixtures[1] = { ...collision.fixtures[0], source_fixture_number: 2 }
  assert.throws(
    () => buildBackfillPlan(identities, collision),
    /BACKFILL_LOGICAL_FIXTURE_COLLISION/,
  )
  const wrongApproval: ApprovedIdentityManifest = structuredClone(identities)
  wrongApproval.identities[0].club_id = '00000000-0000-0000-0000-000000000000'
  assert.throws(() => buildBackfillPlan(wrongApproval, calendar), /BACKFILL_UNAPPROVED_IDENTITY/)
})

test('connected backfill cannot target production or an arbitrary staging project', () => {
  assert.throws(
    () =>
      assertStagingBackfillEnvironment(
        'production',
        'ligpxqweieuybmupirun',
        'https://ligpxqweieuybmupirun.supabase.co',
      ),
    /BACKFILL_STAGING_ONLY/,
  )
  assert.throws(
    () => assertStagingBackfillEnvironment('staging', 'other', 'https://other.supabase.co'),
    /BACKFILL_STAGING_ONLY/,
  )
})
