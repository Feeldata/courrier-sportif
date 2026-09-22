import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const requiredPaths = [
  '.env.example',
  '.gitignore',
  'package.json',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
  'src/lib/supabase/client.ts',
  'src/lib/supabase/server.ts',
  'src/lib/supabase/database.types.ts',
  'src/modules/app/index.ts',
  'src/modules/ingest/index.ts',
  'src/modules/match/index.ts',
  'scripts/generate-supabase-types.sh',
]

for (const file of requiredPaths) await access(file)

const envExample = await readFile('.env.example', 'utf8')
if (!envExample.includes('YOUR_PROJECT_REF') || !envExample.includes('YOUR_PUBLISHABLE_KEY')) {
  throw new Error('.env.example must contain placeholders, not live environment values')
}

if (/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}/i.test(envExample)) {
  throw new Error('.env.example contains a secret-like value')
}

const gitignore = await readFile('.gitignore', 'utf8')
if (!gitignore.includes('.env.*') || !gitignore.includes('!.env.example')) {
  throw new Error('.gitignore must block environment files while allowing .env.example')
}

const rootEntries = await readdir('.')
for (const entry of rootEntries) {
  if (entry.startsWith('.env') && entry !== '.env.example') {
    throw new Error(`Unexpected environment file in repository root: ${entry}`)
  }
}

console.log('Foundation structure: OK')
console.log('Secret hygiene checks: OK')
