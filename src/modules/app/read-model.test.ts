import { describe, expect, it } from 'vitest'

import { buildSearchResults, buildStandings, resolveDisplayedScore } from './read-model'
import type { MatchResultRow, MatchRow, TeamSeasonEntryRow } from './types'

const baseResult = {
  match_result_id: '00000000-0000-4000-8000-000000000010',
  match_id: '00000000-0000-4000-8000-000000000100',
  score_90_home: null,
  score_90_away: null,
  score_et_home: null,
  score_et_away: null,
  penalties_home: null,
  penalties_away: null,
  official_score_home: null,
  official_score_away: null,
  decision_type: 'unknown',
  winner_team_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} satisfies MatchResultRow

describe('APP read models', () => {
  it('does not invent a score when the result is missing', () => {
    expect(resolveDisplayedScore(null)).toEqual({ home: null, away: null })
    expect(resolveDisplayedScore(baseResult)).toEqual({ home: null, away: null })
  })

  it('prefers the official score when one exists', () => {
    expect(
      resolveDisplayedScore({ ...baseResult, official_score_home: 2, official_score_away: 1 }),
    ).toEqual({
      home: 2,
      away: 1,
    })
  })

  it('builds standings only from validated score rows', () => {
    const entries = [
      {
        entry_id: '1',
        season_id: 's',
        team_id: 'home',
        entry_status: 'active',
        group_label: null,
        created_at: '',
        updated_at: '',
      },
      {
        entry_id: '2',
        season_id: 's',
        team_id: 'away',
        entry_status: 'active',
        group_label: null,
        created_at: '',
        updated_at: '',
      },
    ] as TeamSeasonEntryRow[]
    const matches = [
      { entity_id: 'm', season_id: 's', home_team_id: 'home', away_team_id: 'away' },
    ] as MatchRow[]
    const results = [
      { ...baseResult, match_id: 'm', official_score_home: 2, official_score_away: 0 },
    ]

    const standings = buildStandings({
      entries,
      teams: [
        { id: 'home', name: 'Home FC', clubId: null },
        { id: 'away', name: 'Away FC', clubId: null },
      ],
      matches,
      results,
    })

    expect(standings[0]).toMatchObject({
      teamName: 'Home FC',
      played: 1,
      won: 1,
      points: 3,
      goalDifference: 2,
    })
    expect(standings[1]).toMatchObject({
      teamName: 'Away FC',
      played: 1,
      lost: 1,
      points: 0,
      goalDifference: -2,
    })
  })

  it('maps search results to navigable entity routes', () => {
    const results = buildSearchResults({
      competitions: [{ entity_id: 'c', name: 'MTN Elite One', competition_type: 'league' }],
      clubs: [{ entity_id: 'club', official_name: 'Canon', city: 'Yaoundé' }],
      players: [{ entity_id: 'p', display_name: 'Jean Test', primary_position: null }],
    })

    expect(results.map((item) => item.href)).toEqual(['/competitions/c', '/club/club', '/joueur/p'])
  })
})
