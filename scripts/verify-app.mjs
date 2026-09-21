import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const requiredRoutes = [
  'src/app/page.tsx',
  'src/app/competitions/page.tsx',
  'src/app/competitions/[id]/page.tsx',
  'src/app/match/[id]/page.tsx',
  'src/app/club/[id]/page.tsx',
  'src/app/joueur/[id]/page.tsx',
  'src/app/recherche/page.tsx',
  'src/app/loading.tsx',
  'src/app/error.tsx',
]

const requiredComponents = [
  'src/components/app/match-card.tsx',
  'src/components/app/entity-cards.tsx',
  'src/components/app/standings.tsx',
  'src/components/app/match-timeline.tsx',
  'src/components/app/competition-header.tsx',
  'src/components/app/states.tsx',
]

for (const file of [...requiredRoutes, ...requiredComponents]) await access(file)

const repository = await readFile('src/modules/app/data/repository.ts', 'utf8')
if (!repository.startsWith("import 'server-only'")) {
  throw new Error('APP data repository must remain server-only')
}
if (!repository.includes('createAdminSupabaseClient')) {
  throw new Error('APP data repository must use the server-only Supabase read facade while public RLS policies are absent')
}
if (repository.includes('@/modules/ingest') || repository.includes('@/modules/match')) {
  throw new Error('APP repository crosses a protected module boundary')
}

const clientFiles = await readdir('src/components/app')
for (const filename of clientFiles) {
  const source = await readFile(path.join('src/components/app', filename), 'utf8')
  if (source.includes('SUPABASE_SECRET_KEY') || source.includes('createAdminSupabaseClient')) {
    throw new Error(`Server secret access leaked into client/presentation component: ${filename}`)
  }
}

const css = await readFile('src/app/globals.css', 'utf8')
if (!css.includes('@media (min-width: 680px)') || !css.includes('.bottom-nav')) {
  throw new Error('Mobile-first responsive shell is incomplete')
}

const searchPage = await readFile('src/app/recherche/page.tsx', 'utf8')
if (!searchPage.includes('searchPublicData') || !searchPage.includes('Aucun résultat validé')) {
  throw new Error('Search route must use real data and expose a no-data state')
}

console.log('APP routes/components: OK')
console.log('APP server-only Supabase boundary: OK')
console.log('APP loading/error/no-data product states: OK')
console.log('APP responsive shell: OK')
