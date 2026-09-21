import Link from 'next/link'

import { formatMatchDate, matchStatusLabel } from '@/modules/app/read-model'
import type { MatchSummary } from '@/modules/app/types'

export function MatchCard({ match }: { match: MatchSummary }) {
  const date = formatMatchDate(match)
  const hasScore = match.scoreHome !== null && match.scoreAway !== null

  return (
    <Link className="match-card" href={`/match/${match.id}`}>
      <div className="match-meta">
        <span className={`status-pill status-${match.status}`}>
          {matchStatusLabel(match.status)}
        </span>
        <span>{date ?? 'Date à confirmer'}</span>
      </div>
      {match.competitionName || match.seasonName ? (
        <p className="match-context">
          {[match.competitionName, match.seasonName].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <div className="match-team-row">
        <span>{match.homeTeam.name}</span>
        <strong>{hasScore ? match.scoreHome : '—'}</strong>
      </div>
      <div className="match-team-row">
        <span>{match.awayTeam.name}</span>
        <strong>{hasScore ? match.scoreAway : '—'}</strong>
      </div>
      {match.matchday || match.roundLabel ? (
        <div className="match-footer">{match.roundLabel ?? `Journée ${match.matchday}`}</div>
      ) : null}
    </Link>
  )
}
