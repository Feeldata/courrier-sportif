import Link from 'next/link'
import type { Metadata } from 'next'

import { MatchTimeline, NoDataState, SectionHeader } from '@/components/app'
import { EntityMissingState } from '@/components/app/states'
import { formatMatchDate, matchStatusLabel } from '@/modules/app/read-model'
import { getMatchDetail } from '@/modules/app/data/repository'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const detail = await getMatchDetail(id)
  return {
    title: detail ? `${detail.match.homeTeam.name} – ${detail.match.awayTeam.name}` : 'Match',
  }
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getMatchDetail(id)
  if (!detail) return <EntityMissingState kind="Match" />

  const match = detail.match
  const hasScore = match.scoreHome !== null && match.scoreAway !== null
  const date = formatMatchDate(match)

  return (
    <div className="page-stack">
      <section className="match-hero">
        <div className="match-hero-meta">
          <span className={`status-pill status-${match.status}`}>{matchStatusLabel(match.status)}</span>
          {date ? <span>{date}</span> : <span>Date à confirmer</span>}
        </div>
        {match.competitionName ? <p className="eyebrow">{match.competitionName}</p> : null}
        <div className="scoreboard">
          <div>
            {match.homeTeam.clubId ? <Link href={`/club/${match.homeTeam.clubId}`}>{match.homeTeam.name}</Link> : <strong>{match.homeTeam.name}</strong>}
          </div>
          <div className="scoreboard-score">{hasScore ? `${match.scoreHome} – ${match.scoreAway}` : '—'}</div>
          <div>
            {match.awayTeam.clubId ? <Link href={`/club/${match.awayTeam.clubId}`}>{match.awayTeam.name}</Link> : <strong>{match.awayTeam.name}</strong>}
          </div>
        </div>
        <div className="match-detail-meta">
          {detail.venueName ? <span>{[detail.venueName, detail.venueCity].filter(Boolean).join(', ')}</span> : <span>Stade non renseigné</span>}
          {match.roundLabel ? <span>{match.roundLabel}</span> : match.matchday ? <span>Journée {match.matchday}</span> : null}
        </div>
      </section>

      <section className="page-section">
        <SectionHeader title="Fil du match" />
        <MatchTimeline events={detail.events} />
      </section>

      <section className="page-section">
        <SectionHeader title="Compositions" />
        {detail.lineups.length > 0 ? (
          <div className="lineup-grid">
            {[match.homeTeam, match.awayTeam].map((team) => (
              <div className="lineup-card" key={team.id}>
                <h3>{team.name}</h3>
                <ul>
                  {detail.lineups.filter((item) => item.teamId === team.id).map((item) => (
                    <li key={item.id}>
                      <span>{item.shirtNumber ?? '—'}</span>
                      <Link href={`/joueur/${item.playerId}`}>{item.playerName}</Link>
                      {item.captain ? <small>C</small> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <NoDataState>Aucune composition validée n’est disponible pour ce match.</NoDataState>
        )}
      </section>
    </div>
  )
}
