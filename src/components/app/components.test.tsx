import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MatchCard } from './match-card'
import { NoDataState } from './states'

const match = {
  id: '00000000-0000-4000-8000-000000000001',
  status: 'scheduled',
  scheduledDate: '2026-01-24',
  kickoffAt: null,
  kickoffPrecision: 'unknown',
  matchday: null,
  roundLabel: null,
  homeTeam: { id: 'h', name: 'Home FC', clubId: null },
  awayTeam: { id: 'a', name: 'Away FC', clubId: null },
  scoreHome: null,
  scoreAway: null,
  seasonName: null,
  competitionName: 'MTN Elite One',
}

describe('APP critical components', () => {
  it('renders a match without fabricating a zero score', () => {
    const html = renderToStaticMarkup(<MatchCard match={match} />)
    expect(html).toContain('Home FC')
    expect(html).toContain('Away FC')
    expect(html).not.toContain('0 – 0')
    expect(html).toContain('—')
  })

  it('renders an explicit no-data state', () => {
    const html = renderToStaticMarkup(<NoDataState>Aucune donnée validée.</NoDataState>)
    expect(html).toContain('Aucune donnée validée.')
    expect(html).toContain('no-data')
  })
})
