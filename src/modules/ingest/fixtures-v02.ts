import { extractFrenchDate, normalizeIdentity } from './core.ts'
import type { CatalogueDocument } from './catalogue-v02.ts'

export type ParsedFixture = {
  matchday: number
  home: string
  away: string
  rawDate: string
  scheduledDate: string
  rawTime: string | null
  kickoffAt: string | null
  venueName: string | null
}

function isoDate(day: string, month: string, year: string): string {
  const date = `${year}-${month}-${day}`
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid fixture date: ${date}`)
  }
  return date
}

function splitCalendarTeams(value: string, knownNames: string[]): [string, string] {
  const normalized = normalizeIdentity(value)
  const names = [...new Set(knownNames.map(normalizeIdentity))]
  const pairs = names.flatMap((home) =>
    names
      .filter((away) => `${home} ${away}` === normalized)
      .map((away) => [home, away] as [string, string]),
  )
  if (pairs.length !== 1) throw new Error(`Calendar team split is ambiguous: ${value}`)
  return pairs[0]
}

export function parseFecafootFixtures(
  document: CatalogueDocument,
  knownTeamNames: string[],
): ParsedFixture[] {
  if (
    document.kind !== 'general_calendar' &&
    document.kind !== 'matchday_program' &&
    document.kind !== 'reschedule'
  )
    return []
  const lines = document.text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
  const fixtures: ParsedFixture[] = []
  let matchdays: number[] = []
  let date: string | null = null
  let rawDate = ''
  let venue: string | null = null
  for (const line of lines) {
    const rounds = [...line.matchAll(/\b(\d{1,2})(?:er|ere|ère|e|ème)?\s+Journ[ée]e\b/gi)]
    if (rounds.length) matchdays = rounds.map((round) => Number(round[1]))
    if (document.kind === 'general_calendar') {
      const rows = [
        ...line.matchAll(
          /(?:^|\s)(\d{1,3})\s+(.+?)\s+(\d{2})\/(\d{2})\/(20\d{2})(?=\s+\d{1,3}\s+|$)/g,
        ),
      ]
      if (rows.length > matchdays.length || (rows.length && !matchdays.length))
        throw new Error('Calendar fixture has no matching matchday header')
      for (const [index, row] of rows.entries()) {
        const [home, away] = splitCalendarTeams(row[2], knownTeamNames)
        fixtures.push({
          matchday: matchdays[index],
          home,
          away,
          rawDate: `${row[3]}/${row[4]}/${row[5]}`,
          scheduledDate: isoDate(row[3], row[4], row[5]),
          rawTime: null,
          kickoffAt: null,
          venueName: null,
        })
      }
      continue
    }
    const frenchDate = extractFrenchDate(line)
    if (frenchDate && /\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(line)) {
      date = frenchDate
      rawDate = line
      venue = null
      continue
    }
    if (/^(?:STADE|STADIUM|CENTENARY|BAMENDA PROXIMITY)/i.test(line) && /[:.]$/.test(line)) {
      venue = line.replace(/[:.]$/, '').trim()
      continue
    }
    const row = line.match(/^(\d{1,2})H(\d{2})\s*:\s*(.+?)\s+vs\s+(.+)$/i)
    if (!row) continue
    if (!matchdays[0] || !date) throw new Error('Program fixture has no explicit matchday or date')
    const hours = Number(row[1])
    const minutes = Number(row[2])
    if (hours > 23 || minutes > 59) throw new Error('Invalid fixture time')
    const rawTime = `${row[1]}H${row[2]}`
    fixtures.push({
      matchday: matchdays[0],
      home: row[3].trim(),
      away: row[4].trim(),
      rawDate,
      scheduledDate: date,
      rawTime,
      kickoffAt: new Date(
        `${date}T${String(hours).padStart(2, '0')}:${row[2]}:00+01:00`,
      ).toISOString(),
      venueName: venue,
    })
  }
  if (fixtures.length === 0) throw new Error('No supported FECAFOOT fixture rows')
  return fixtures
}
