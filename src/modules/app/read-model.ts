import type {
  CompetitionRow,
  CompetitionSummary,
  MatchResultRow,
  MatchRow,
  MatchSummary,
  SearchResultItem,
  StandingRow,
  TeamSeasonEntryRow,
  TeamSummary,
} from './types'

export function toCompetitionSummary(row: CompetitionRow): CompetitionSummary {
  return {
    id: row.entity_id,
    name: row.name,
    shortName: row.short_name,
    competitionType: row.competition_type,
    organizerName: row.organizer_name,
    countryCode: row.country_code,
    status: row.status,
  }
}

export function resolveDisplayedScore(result: MatchResultRow | null | undefined) {
  if (!result) return { home: null, away: null }

  if (result.official_score_home !== null && result.official_score_away !== null) {
    return { home: result.official_score_home, away: result.official_score_away }
  }

  if (result.score_et_home !== null && result.score_et_away !== null) {
    return { home: result.score_et_home, away: result.score_et_away }
  }

  if (result.score_90_home !== null && result.score_90_away !== null) {
    return { home: result.score_90_home, away: result.score_90_away }
  }

  return { home: null, away: null }
}

export function toMatchSummary(input: {
  match: MatchRow
  homeTeam: TeamSummary
  awayTeam: TeamSummary
  result?: MatchResultRow | null
  seasonName?: string | null
  competitionName?: string | null
}): MatchSummary {
  const score = resolveDisplayedScore(input.result)

  return {
    id: input.match.entity_id,
    status: input.match.status,
    scheduledDate: input.match.scheduled_date,
    kickoffAt: input.match.kickoff_at,
    kickoffPrecision: input.match.kickoff_precision,
    matchday: input.match.matchday,
    roundLabel: input.match.round_label,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    scoreHome: score.home,
    scoreAway: score.away,
    seasonName: input.seasonName ?? null,
    competitionName: input.competitionName ?? null,
  }
}

export function buildStandings(input: {
  entries: TeamSeasonEntryRow[]
  teams: TeamSummary[]
  matches: MatchRow[]
  results: MatchResultRow[]
}): StandingRow[] {
  const teamMap = new Map(input.teams.map((team) => [team.id, team]))
  const rows = new Map<string, StandingRow>()

  for (const entry of input.entries) {
    const team = teamMap.get(entry.team_id)
    if (!team) continue
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    })
  }

  const resultMap = new Map(input.results.map((result) => [result.match_id, result]))

  for (const match of input.matches) {
    const result = resultMap.get(match.entity_id)
    if (!result) continue
    const score = resolveDisplayedScore(result)
    if (score.home === null || score.away === null) continue

    const home = rows.get(match.home_team_id)
    const away = rows.get(match.away_team_id)
    if (!home || !away) continue

    home.played += 1
    away.played += 1
    home.goalsFor += score.home
    home.goalsAgainst += score.away
    away.goalsFor += score.away
    away.goalsAgainst += score.home

    if (score.home > score.away) {
      home.won += 1
      away.lost += 1
      home.points += 3
    } else if (score.home < score.away) {
      away.won += 1
      home.lost += 1
      away.points += 3
    } else {
      home.drawn += 1
      away.drawn += 1
      home.points += 1
      away.points += 1
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, 'fr'),
  )
}

export function buildSearchResults(input: {
  competitions: Array<{ entity_id: string; name: string; competition_type: string }>
  clubs: Array<{ entity_id: string; official_name: string; city: string | null }>
  players: Array<{ entity_id: string; display_name: string; primary_position: string | null }>
}): SearchResultItem[] {
  return [
    ...input.competitions.map((item) => ({
      kind: 'competition' as const,
      id: item.entity_id,
      title: item.name,
      subtitle: competitionTypeLabel(item.competition_type),
      href: `/competitions/${item.entity_id}`,
    })),
    ...input.clubs.map((item) => ({
      kind: 'club' as const,
      id: item.entity_id,
      title: item.official_name,
      subtitle: item.city,
      href: `/club/${item.entity_id}`,
    })),
    ...input.players.map((item) => ({
      kind: 'player' as const,
      id: item.entity_id,
      title: item.display_name,
      subtitle: item.primary_position,
      href: `/joueur/${item.entity_id}`,
    })),
  ]
}

export function competitionTypeLabel(value: string) {
  const labels: Record<string, string> = {
    league: 'Championnat',
    cup: 'Coupe',
    super_cup: 'Supercoupe',
    playoff: 'Playoffs',
    continental: 'Compétition continentale',
    friendly: 'Amical',
    other: 'Compétition',
  }
  return labels[value] ?? 'Compétition'
}

export function matchStatusLabel(value: string) {
  const labels: Record<string, string> = {
    scheduled: 'À venir',
    postponed: 'Reporté',
    delayed: 'Retardé',
    live: 'En direct',
    halftime: 'Mi-temps',
    suspended: 'Suspendu',
    finished: 'Terminé',
    abandoned: 'Abandonné',
    cancelled: 'Annulé',
  }
  return labels[value] ?? value
}

export function formatMatchDate(match: Pick<MatchSummary, 'kickoffAt' | 'scheduledDate'>) {
  const value = match.kickoffAt ?? (match.scheduledDate ? `${match.scheduledDate}T12:00:00Z` : null)
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('fr-CM', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(match.kickoffAt ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
