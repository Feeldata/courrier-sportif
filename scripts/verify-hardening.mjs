import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const requiredPaths = [
  'package-lock.json',
  'docs/staging-v0.1.md',
  'src/integration/hardening.test.ts',
]
for (const file of requiredPaths) await access(file)

const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
if (!packageJson.scripts?.check?.includes('test:ingest:core')) {
  throw new Error('Full check must include INGEST node:test coverage')
}
if (!packageJson.scripts?.check?.includes('verify:hardening')) {
  throw new Error('Full check must include verify:hardening')
}
if (!packageJson.scripts?.check?.includes('npm run typegen')) {
  throw new Error('Full check must generate Next types before typecheck')
}

const ci = await readFile('.github/workflows/ci.yml', 'utf8')
if (!ci.includes('npm ci') || ci.includes('npm install')) {
  throw new Error('CI must be reproducible with npm ci only')
}
if (!ci.includes('NEXT_PUBLIC_APP_ENV: staging')) {
  throw new Error('CI must exercise the staging environment mode')
}

const gitignore = await readFile('.gitignore', 'utf8')
if (!gitignore.includes('next-env.d.ts')) {
  throw new Error('Generated next-env.d.ts must remain ignored')
}

const envExample = await readFile('.env.example', 'utf8')
for (const name of [
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_SECRET_KEY',
]) {
  if (!envExample.includes(name)) throw new Error(`.env.example missing ${name}`)
}
if (envExample.includes('NEXT_PUBLIC_SUPABASE_SECRET_KEY')) {
  throw new Error('Supabase secret must never be exposed through NEXT_PUBLIC_*')
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(absolute)))
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

const appFiles = [
  ...(await walk('src/app')),
  ...(await walk('src/components/app')),
  ...(await walk('src/modules/app')),
]
for (const file of appFiles) {
  const source = await readFile(file, 'utf8')
  if (/\.(insert|update|upsert|delete|rpc)\s*\(/.test(source)) {
    throw new Error(`APP write primitive detected: ${file}`)
  }
  if (
    (source.includes("'use client'") || source.includes('"use client"')) &&
    (source.includes('SUPABASE_SECRET_KEY') || source.includes('createAdminSupabaseClient'))
  ) {
    throw new Error(`Server Supabase secret boundary leaked into client code: ${file}`)
  }
}

const appRepository = await readFile('src/modules/app/data/repository.ts', 'utf8')
if (!appRepository.startsWith("import 'server-only'")) {
  throw new Error('APP data repository must remain server-only')
}
if (!appRepository.includes('createAdminSupabaseClient')) {
  throw new Error('APP server reads must use the explicit server-only facade under current RLS')
}

const adminClient = await readFile('src/lib/supabase/admin.ts', 'utf8')
if (!adminClient.startsWith("import 'server-only'")) {
  throw new Error('Supabase admin client must remain server-only')
}
for (const expected of [
  'autoRefreshToken: false',
  'persistSession: false',
  'detectSessionInUrl: false',
]) {
  if (!adminClient.includes(expected)) throw new Error(`Admin client missing ${expected}`)
}

const errorBoundary = await readFile('src/app/error.tsx', 'utf8')
if (
  errorBoundary.includes('error.message') ||
  errorBoundary.includes('error.stack') ||
  errorBoundary.includes('causeDetail')
) {
  throw new Error('Public APP error boundary must not expose server error details')
}

const sourceFiles = [...(await walk('src')), ...(await walk('scripts'))]
for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8')
  if (/sb_secret_[A-Za-z0-9._-]{8,}/.test(source)) {
    throw new Error(`Secret-like Supabase key committed in ${file}`)
  }
}

console.log('Hardening reproducibility: OK')
console.log('APP read-only boundary: OK')
console.log('Supabase secret boundary: OK')
console.log('Public error disclosure guard: OK')
