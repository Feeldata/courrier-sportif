import type { Tables } from '@/lib/supabase/database.types'

export type CompetitionRow = Tables<'competitions'>
export type SeasonRow = Tables<'seasons'>
export type ClubRow = Tables<'clubs'>
export type TeamRow = Tables<'teams'>
export type PlayerRow = Tables<'players'>
export type MatchRow = Tables<'matches'>
export type MatchResultRow = Tables<'match_results'>
export type MatchEventRow = Tables<'match_events'>
export type MatchPlayerRow = Tables<'match_players'>
export type MembershipRow = Tables<'player_team_memberships'>
export type TeamSeasonEntryRow = Tables<'team_season_entries'>

export interface CompetitionSummary {
  id: string
  name: string
  shortName: string | null
  competitionType: string
  organizerName: string | null
  countryCode: string | null
  status: string
}

export interface TeamSummary {
  id: string
  name: string
  clubId: string | null
}

export interface MatchSummary {
  id: string
  status: string
  scheduledDate: string | null
  kickoffAt: string | null
  kickoffPrecision: string
  matchday: number | null
  roundLabel: string | null
  homeTeam: TeamSummary
  awayTeam: TeamSummary
  scoreHome: number | null
  scoreAway: number | null
  seasonName: string | null
  competitionName: string | null
}

export interface HomeData {
  competitions: CompetitionSummary[]
  matches: MatchSummary[]
  counts: {
    competitions: number
    matches: number
    clubs: number
    players: number
  }
}

export interface StandingRow {
  teamId: string
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface CompetitionDetail {
  competition: CompetitionRow
  seasons: Array<{
    season: SeasonRow
    teams: TeamSummary[]
    matches: MatchSummary[]
    standings: StandingRow[]
  }>
}

export interface MatchEventView {
  id: string
  eventType: string
  period: string
  minute: number | null
  stoppageMinute: number | null
  teamName: string | null
  playerName: string | null
  relatedPlayerName: string | null
}

export interface MatchDetail {
  match: MatchSummary
  venueName: string | null
  venueCity: string | null
  result: MatchResultRow | null
  events: MatchEventView[]
  lineups: Array<{
    id: string
    teamId: string
    teamName: string
    playerId: string
    playerName: string
    shirtNumber: number | null
    squadRole: string
    captain: boolean
    startingPosition: string | null
  }>
}

export interface ClubDetail {
  club: ClubRow
  teams: Array<{
    team: TeamRow
    players: Array<{
      player: PlayerRow
      membership: MembershipRow
    }>
  }>
}

export interface PlayerDetail {
  player: PlayerRow
  memberships: Array<{
    membership: MembershipRow
    team: TeamRow
    club: ClubRow | null
  }>
}

export type SearchResultKind = 'competition' | 'club' | 'player'

export interface SearchResultItem {
  kind: SearchResultKind
  id: string
  title: string
  subtitle: string | null
  href: string
}
