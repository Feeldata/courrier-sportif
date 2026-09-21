import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import type { Database, Tables } from '@/lib/supabase/database.types'

import {
  buildSearchResults,
  buildStandings,
  isUuid,
  toCompetitionSummary,
  toMatchSummary,
} from '../read-model'
import type {
  ClubDetail,
  CompetitionDetail,
  CompetitionSummary,
  HomeData,
  MatchDetail,
  MatchSummary,
  PlayerDetail,
  SearchResultItem,
  TeamSummary,
} from '../types'

export class AppDataError extends Error {
  constructor(
    message: string,
    readonly causeDetail?: unknown,
  ) {
    super(message)
    this.name = 'AppDataError'
  }
}

type Client = ReturnType<typeof createAdminSupabaseClient>

type TeamRow = Tables<'teams'>
type SeasonRow = Tables<'seasons'>
type CompetitionRow = Tables<'competitions'>
type MatchRow = Tables<'matches'>
type MatchResultRow = Tables<'match_results'>
type MatchEventRow = Tables<'match_events'>
type MatchPlayerRow = Tables<'match_players'>
type PlayerRow = Tables<'players'>
type ClubRow = Tables<'clubs'>
type MembershipRow = Tables<'player_team_memberships'>
type TeamSeasonEntryRow = Tables<'team_season_entries'>

function getClient() {
  // DATA V0.1 currently has RLS enabled with no public SELECT policies.
  // APP V0.1 therefore reads through this server-only facade. No secret reaches client code.
  return createAdminSupabaseClient()
}

function fail(scope: string, error: unknown): never {
  throw new AppDataError(`Impossible de charger les données ${scope}.`, error)
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

async function fetchTeams(client: Client, ids: string[]): Promise<TeamRow[]> {
  if (ids.length === 0) return [] as TeamRow[]
  const { data, error } = await client.from('teams').select('*').in('entity_id', ids)
  if (error) fail('des équipes', error)
  return (data ?? []) as TeamRow[]
}

async function hydrateMatches(client: Client, matches: MatchRow[]): Promise<MatchSummary[]> {
  if (matches.length === 0) return []

  const teamIds = unique(matches.flatMap((match) => [match.home_team_id, match.away_team_id]))
  const seasonIds = unique(matches.map((match) => match.season_id))

  const [teamsResponse, seasonsResponse, resultsResponse] = await Promise.all([
    fetchTeams(client, teamIds),
    client.from('seasons').select('*').in('entity_id', seasonIds),
    client
      .from('match_results')
      .select('*')
      .in(
        'match_id',
        matches.map((match) => match.entity_id),
      ),
  ])

  if ('error' in seasonsResponse && seasonsResponse.error)
    fail('des saisons', seasonsResponse.error)
  if ('error' in resultsResponse && resultsResponse.error)
    fail('des résultats', resultsResponse.error)

  const teams = teamsResponse
  const seasons = (seasonsResponse.data ?? []) as SeasonRow[]
  const results = (resultsResponse.data ?? []) as MatchResultRow[]
  const competitionIds = unique(seasons.map((season) => season.competition_id))
  let competitions: CompetitionRow[] = []

  if (competitionIds.length > 0) {
    const response = await client.from('competitions').select('*').in('entity_id', competitionIds)
    if (response.error) fail('des compétitions', response.error)
    competitions = (response.data ?? []) as CompetitionRow[]
  }

  const teamMap = new Map(teams.map((team) => [team.entity_id, team]))
  const seasonMap = new Map(seasons.map((season) => [season.entity_id, season]))
  const competitionMap = new Map(
    competitions.map((competition) => [competition.entity_id, competition]),
  )
  const resultMap = new Map(results.map((result) => [result.match_id, result]))

  return matches.flatMap((match) => {
    const home = teamMap.get(match.home_team_id)
    const away = teamMap.get(match.away_team_id)
    if (!home || !away) return []

    const season = seasonMap.get(match.season_id)
    const competition = season ? competitionMap.get(season.competition_id) : undefined

    return [
      toMatchSummary({
        match,
        homeTeam: { id: home.entity_id, name: home.name, clubId: home.club_id },
        awayTeam: { id: away.entity_id, name: away.name, clubId: away.club_id },
        result: resultMap.get(match.entity_id),
        seasonName: season?.name,
        competitionName: competition?.name,
      }),
    ]
  })
}

async function countRows<TableName extends keyof Database['public']['Tables']>(
  client: Client,
  table: TableName,
) {
  const query = client.from(table).select('*', { count: 'exact', head: true })
  const { count, error } = await query
  if (error) fail(`de ${table}`, error)
  return count ?? 0
}

export async function getHomeData(): Promise<HomeData> {
  const client = getClient()
  const [competitionResponse, matchResponse, competitionCount, matchCount, clubCount, playerCount] =
    await Promise.all([
      client.from('competitions').select('*').order('name').limit(4),
      client
        .from('matches')
        .select('*')
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .limit(6),
      countRows(client, 'competitions'),
      countRows(client, 'matches'),
      countRows(client, 'clubs'),
      countRows(client, 'players'),
    ])

  if (competitionResponse.error) fail('des compétitions', competitionResponse.error)
  if (matchResponse.error) fail('des matchs', matchResponse.error)

  return {
    competitions: (competitionResponse.data ?? []).map(toCompetitionSummary),
    matches: await hydrateMatches(client, matchResponse.data ?? []),
    counts: {
      competitions: competitionCount,
      matches: matchCount,
      clubs: clubCount,
      players: playerCount,
    },
  }
}

export async function listCompetitions(): Promise<CompetitionSummary[]> {
  const client = getClient()
  const { data, error } = await client.from('competitions').select('*').order('name')
  if (error) fail('des compétitions', error)
  return (data ?? []).map(toCompetitionSummary)
}

export async function getCompetitionDetail(id: string): Promise<CompetitionDetail | null> {
  if (!isUuid(id)) return null
  const client = getClient()
  const competitionResponse = await client
    .from('competitions')
    .select('*')
    .eq('entity_id', id)
    .maybeSingle()
  if (competitionResponse.error) fail('de la compétition', competitionResponse.error)
  if (!competitionResponse.data) return null

  const seasonsResponse = await client
    .from('seasons')
    .select('*')
    .eq('competition_id', id)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (seasonsResponse.error) fail('des saisons', seasonsResponse.error)

  const seasons = (seasonsResponse.data ?? []) as SeasonRow[]
  const seasonViews: CompetitionDetail['seasons'] = []

  for (const season of seasons) {
    const [entryResponse, matchResponse] = await Promise.all([
      client.from('team_season_entries').select('*').eq('season_id', season.entity_id),
      client
        .from('matches')
        .select('*')
        .eq('season_id', season.entity_id)
        .order('scheduled_date', { ascending: true, nullsFirst: false }),
    ])
    if (entryResponse.error) fail('des engagés', entryResponse.error)
    if (matchResponse.error) fail('des matchs', matchResponse.error)

    const entries = (entryResponse.data ?? []) as TeamSeasonEntryRow[]
    const matches = (matchResponse.data ?? []) as MatchRow[]
    const teamIds = unique([
      ...entries.map((entry) => entry.team_id),
      ...matches.flatMap((match) => [match.home_team_id, match.away_team_id]),
    ])
    const teams = await fetchTeams(client, teamIds)
    const teamSummaries: TeamSummary[] = teams.map((team) => ({
      id: team.entity_id,
      name: team.name,
      clubId: team.club_id,
    }))

    let results: MatchResultRow[] = []
    if (matches.length > 0) {
      const response = await client
        .from('match_results')
        .select('*')
        .in(
          'match_id',
          matches.map((match) => match.entity_id),
        )
      if (response.error) fail('des résultats', response.error)
      results = response.data ?? []
    }

    seasonViews.push({
      season,
      teams: teamSummaries,
      matches: await hydrateMatches(client, matches),
      standings: buildStandings({ entries, teams: teamSummaries, matches, results }),
    })
  }

  return { competition: competitionResponse.data, seasons: seasonViews }
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
  if (!isUuid(id)) return null
  const client = getClient()
  const matchResponse = await client.from('matches').select('*').eq('entity_id', id).maybeSingle()
  if (matchResponse.error) fail('du match', matchResponse.error)
  if (!matchResponse.data) return null

  const match = matchResponse.data
  const [teams, seasonResponse, resultResponse, eventResponse, lineupResponse] = await Promise.all([
    fetchTeams(client, [match.home_team_id, match.away_team_id]),
    client.from('seasons').select('*').eq('entity_id', match.season_id).maybeSingle(),
    client.from('match_results').select('*').eq('match_id', id).maybeSingle(),
    client
      .from('match_events')
      .select('*')
      .eq('match_id', id)
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('minute', { ascending: true, nullsFirst: false }),
    client.from('match_players').select('*').eq('match_id', id).order('squad_role'),
  ])

  if (seasonResponse.error) fail('de la saison', seasonResponse.error)
  if (resultResponse.error) fail('du résultat', resultResponse.error)
  if (eventResponse.error) fail('des événements', eventResponse.error)
  if (lineupResponse.error) fail('des compositions', lineupResponse.error)

  const home = teams.find((team) => team.entity_id === match.home_team_id)
  const away = teams.find((team) => team.entity_id === match.away_team_id)
  if (!home || !away) fail('des équipes du match', new Error('Référence équipe manquante'))

  let competition: CompetitionRow | null = null
  if (seasonResponse.data) {
    const response = await client
      .from('competitions')
      .select('*')
      .eq('entity_id', seasonResponse.data.competition_id)
      .maybeSingle()
    if (response.error) fail('de la compétition du match', response.error)
    competition = response.data
  }

  let venueName: string | null = null
  let venueCity: string | null = null
  if (match.venue_id) {
    const response = await client
      .from('venues')
      .select('name,city')
      .eq('entity_id', match.venue_id)
      .maybeSingle()
    if (response.error) fail('du stade', response.error)
    venueName = response.data?.name ?? null
    venueCity = response.data?.city ?? null
  }

  const events = (eventResponse.data ?? []) as MatchEventRow[]
  const lineupRows = (lineupResponse.data ?? []) as MatchPlayerRow[]
  const playerIds = unique([
    ...events.flatMap((event) => [event.player_id, event.related_player_id]),
    ...lineupRows.map((lineup) => lineup.player_id),
  ])
  let players: PlayerRow[] = []
  if (playerIds.length > 0) {
    const response = await client.from('players').select('*').in('entity_id', playerIds)
    if (response.error) fail('des joueurs', response.error)
    players = (response.data ?? []) as PlayerRow[]
  }

  const playerMap = new Map(players.map((player) => [player.entity_id, player]))
  const teamMap = new Map(teams.map((team) => [team.entity_id, team]))

  return {
    match: toMatchSummary({
      match,
      homeTeam: { id: home.entity_id, name: home.name, clubId: home.club_id },
      awayTeam: { id: away.entity_id, name: away.name, clubId: away.club_id },
      result: resultResponse.data,
      seasonName: seasonResponse.data?.name,
      competitionName: competition?.name,
    }),
    venueName,
    venueCity,
    result: resultResponse.data,
    events: events.map((event) => ({
      id: event.event_id,
      eventType: event.event_type,
      period: event.period,
      minute: event.minute,
      stoppageMinute: event.stoppage_minute,
      teamName: event.team_id ? (teamMap.get(event.team_id)?.name ?? null) : null,
      playerName: event.player_id ? (playerMap.get(event.player_id)?.display_name ?? null) : null,
      relatedPlayerName: event.related_player_id
        ? (playerMap.get(event.related_player_id)?.display_name ?? null)
        : null,
    })),
    lineups: lineupRows.flatMap((lineup) => {
      const player = playerMap.get(lineup.player_id)
      const team = teamMap.get(lineup.team_id)
      if (!player || !team) return []
      return [
        {
          id: lineup.match_player_id,
          teamId: team.entity_id,
          teamName: team.name,
          playerId: player.entity_id,
          playerName: player.display_name,
          shirtNumber: lineup.shirt_number,
          squadRole: lineup.squad_role,
          captain: lineup.captain,
          startingPosition: lineup.starting_position,
        },
      ]
    }),
  }
}

export async function getClubDetail(id: string): Promise<ClubDetail | null> {
  if (!isUuid(id)) return null
  const client = getClient()
  const clubResponse = await client.from('clubs').select('*').eq('entity_id', id).maybeSingle()
  if (clubResponse.error) fail('du club', clubResponse.error)
  if (!clubResponse.data) return null

  const teamResponse = await client.from('teams').select('*').eq('club_id', id).order('name')
  if (teamResponse.error) fail('des équipes du club', teamResponse.error)
  const teams = (teamResponse.data ?? []) as TeamRow[]
  const teamViews: ClubDetail['teams'] = []

  for (const team of teams) {
    const membershipResponse = await client
      .from('player_team_memberships')
      .select('*')
      .eq('team_id', team.entity_id)
      .order('start_date', { ascending: false, nullsFirst: false })
    if (membershipResponse.error) fail('de l’effectif', membershipResponse.error)

    const memberships = (membershipResponse.data ?? []) as MembershipRow[]
    const playerIds = unique(memberships.map((membership) => membership.player_id))
    let players: PlayerRow[] = []
    if (playerIds.length > 0) {
      const response = await client.from('players').select('*').in('entity_id', playerIds)
      if (response.error) fail('des joueurs du club', response.error)
      players = (response.data ?? []) as PlayerRow[]
    }
    const playerMap = new Map(players.map((player) => [player.entity_id, player]))

    teamViews.push({
      team,
      players: memberships.flatMap((membership) => {
        const player = playerMap.get(membership.player_id)
        return player ? [{ player, membership }] : []
      }),
    })
  }

  return { club: clubResponse.data, teams: teamViews }
}

export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  if (!isUuid(id)) return null
  const client = getClient()
  const playerResponse = await client.from('players').select('*').eq('entity_id', id).maybeSingle()
  if (playerResponse.error) fail('du joueur', playerResponse.error)
  if (!playerResponse.data) return null

  const membershipResponse = await client
    .from('player_team_memberships')
    .select('*')
    .eq('player_id', id)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (membershipResponse.error) fail('du parcours du joueur', membershipResponse.error)
  const memberships = (membershipResponse.data ?? []) as MembershipRow[]
  const teamIds = unique(memberships.map((membership) => membership.team_id))
  const teams = await fetchTeams(client, teamIds)
  const teamMap = new Map(teams.map((team) => [team.entity_id, team]))
  const clubIds = unique(teams.map((team) => team.club_id))
  let clubs: ClubRow[] = []
  if (clubIds.length > 0) {
    const response = await client.from('clubs').select('*').in('entity_id', clubIds)
    if (response.error) fail('des clubs du joueur', response.error)
    clubs = (response.data ?? []) as ClubRow[]
  }
  const clubMap = new Map(clubs.map((club) => [club.entity_id, club]))

  return {
    player: playerResponse.data,
    memberships: memberships.flatMap((membership) => {
      const team = teamMap.get(membership.team_id)
      if (!team) return []
      return [
        {
          membership,
          team,
          club: team.club_id ? (clubMap.get(team.club_id) ?? null) : null,
        },
      ]
    }),
  }
}

function normalizeSearchQuery(value: string) {
  return value.trim().replace(/[%,]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export async function searchPublicData(query: string): Promise<SearchResultItem[]> {
  const normalized = normalizeSearchQuery(query)
  if (normalized.length < 2) return []

  const client = getClient()
  const pattern = `%${normalized}%`
  const [competitionResponse, clubResponse, playerResponse] = await Promise.all([
    client
      .from('competitions')
      .select('entity_id,name,competition_type')
      .ilike('name', pattern)
      .order('name')
      .limit(12),
    client
      .from('clubs')
      .select('entity_id,official_name,city')
      .ilike('official_name', pattern)
      .order('official_name')
      .limit(12),
    client
      .from('players')
      .select('entity_id,display_name,primary_position')
      .ilike('display_name', pattern)
      .order('display_name')
      .limit(12),
  ])

  if (competitionResponse.error) fail('de la recherche compétitions', competitionResponse.error)
  if (clubResponse.error) fail('de la recherche clubs', clubResponse.error)
  if (playerResponse.error) fail('de la recherche joueurs', playerResponse.error)

  return buildSearchResults({
    competitions: competitionResponse.data ?? [],
    clubs: clubResponse.data ?? [],
    players: playerResponse.data ?? [],
  })
}
