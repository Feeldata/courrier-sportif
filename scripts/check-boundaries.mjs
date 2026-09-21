import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('src/modules')
const modules = ['app', 'ingest', 'match']
const violations = []

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(absolute)))
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute)
  }
  return files
}

for (const moduleName of modules) {
  const files = await walk(path.join(root, moduleName))
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const otherModule of modules.filter((name) => name !== moduleName)) {
      if (source.includes(`@/modules/${otherModule}`)) {
        violations.push(`${path.relative(process.cwd(), file)} imports ${otherModule}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Module boundary violations:\n' + violations.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}

console.log('Module boundaries: OK')
