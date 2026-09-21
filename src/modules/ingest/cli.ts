import { readFile } from 'node:fs/promises'

import { MemoryIngestRepository } from './memory-repository.ts'
import { ingestFecafootDocument } from './pipeline.ts'
import { FecafootParseError, fetchFecafootDocument } from './fecafoot-source.ts'
import type { FetchedSourceDocument } from './types.ts'

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const dryRun = process.argv.includes('--dry-run')
const fixturePath = option('--fixture')
const url = option('--url')

if (!fixturePath && !url) {
  throw new Error('Provide --url <FECAFOOT URL> or --fixture <JSON file>')
}

let document: FetchedSourceDocument
if (fixturePath) {
  document = JSON.parse(await readFile(fixturePath, 'utf8')) as FetchedSourceDocument
} else {
  try {
    document = await fetchFecafootDocument(url as string)
  } catch (error) {
    const parseFailure = error instanceof FecafootParseError
    console.error(
      JSON.stringify({
        component: 'cs-ingest',
        timestamp: new Date().toISOString(),
        stage: parseFailure ? 'extract' : 'fetch',
        level: 'error',
        code: parseFailure ? 'SOURCE_PARSE_FAILED' : 'SOURCE_FETCH_FAILED',
        message: error instanceof Error ? error.message : String(error),
        source_url: url,
      }),
    )
    throw error
  }
}

if (dryRun) {
  const result = await ingestFecafootDocument(new MemoryIngestRepository(), document, { dryRun: true })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

const [{ createClient }, { SupabaseIngestRepository }] = await Promise.all([
  import('@supabase/supabase-js'),
  import('./supabase-repository.ts'),
])
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Live ingest requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY')
}
const client = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const result = await ingestFecafootDocument(new SupabaseIngestRepository(client), document)
console.log(JSON.stringify(result, null, 2))
