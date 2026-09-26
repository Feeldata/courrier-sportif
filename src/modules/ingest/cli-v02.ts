import { readFile } from 'node:fs/promises'

import {
  ELITE_ONE_COMPETITION_ID,
  ingestCatalogueDocument,
  type CatalogueDocument,
} from './catalogue-v02.ts'
import { MemoryCatalogueRepository } from './catalogue-v02-memory.ts'
import { fetchFecafootDocument } from './fecafoot-source.ts'
import {
  assertStagingBackfillEnvironment,
  buildBackfillPlan,
  preflightStagingBackfill,
  verifyFrozenOfficialSource,
  type ApprovedIdentityManifest,
  type FrozenCalendarManifest,
} from './backfill-2025-2026.ts'

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

if (process.argv.includes('--backfill-2025-2026-preflight')) {
  if (option('--url') || option('--fixture') || process.argv.includes('--apply-staging')) {
    throw new Error('Backfill preflight accepts no other INGEST V0.2 operation')
  }
  assertStagingBackfillEnvironment(
    process.env.NEXT_PUBLIC_APP_ENV,
    process.env.SUPABASE_PROJECT_REF,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  )
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('Staging Supabase credentials are required')
  const identities = JSON.parse(
    await readFile(
      new URL('./fixtures/elite-one-2025-2026-identities.json', import.meta.url),
      'utf8',
    ),
  ) as ApprovedIdentityManifest
  const calendar = JSON.parse(
    await readFile(
      new URL('./fixtures/fecafoot-elite-one-calendar-2025-2026.full.json', import.meta.url),
      'utf8',
    ),
  ) as FrozenCalendarManifest
  const plan = buildBackfillPlan(identities, calendar)
  await verifyFrozenOfficialSource(calendar.source_url, calendar.source_sha256)
  await verifyFrozenOfficialSource(
    identities.participant_source_url,
    identities.participant_source_sha256,
  )
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const result = await preflightStagingBackfill(client, plan)
  console.log(JSON.stringify(result))
} else {
  const fixturePath = option('--fixture')
  const url = option('--url')
  const applyStaging = process.argv.includes('--apply-staging')
  if (Boolean(fixturePath) === Boolean(url))
    throw new Error('Provide exactly one of --url or --fixture')
  if (applyStaging && fixturePath)
    throw new Error('Frozen excerpts are for offline qualification, not connected writes')

  const document: CatalogueDocument = url
    ? { ...(await fetchFecafootDocument(url)), kind: 'season_regulation' }
    : (JSON.parse(await readFile(fixturePath as string, 'utf8')) as CatalogueDocument)

  if (document.kind !== 'season_regulation')
    throw new Error('CLI V0.2 applies Gate A only; fixtures require approved identity catalogue')

  if (applyStaging) {
    const [{ createClient }, { SupabaseCatalogueRepository }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('./catalogue-v02-supabase.ts'),
    ])
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secret = process.env.SUPABASE_SECRET_KEY
    if (!supabaseUrl || !secret) throw new Error('Staging Supabase credentials are required')
    const client = createClient(supabaseUrl, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const result = await ingestCatalogueDocument(
      new SupabaseCatalogueRepository(client),
      document,
      {
        dryRun: false,
      },
    )
    console.log(JSON.stringify(result))
  } else {
    const repository = new MemoryCatalogueRepository()
    repository.competitions.add(ELITE_ONE_COMPETITION_ID)
    const result = await ingestCatalogueDocument(repository, document, { dryRun: true })
    console.log(JSON.stringify(result))
  }
}
