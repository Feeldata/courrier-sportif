import type { Metadata } from 'next'

import {
  CompetitionHeader,
  EmptyState,
  MatchCard,
  NoDataState,
  SectionHeader,
  StandingsTable,
} from '@/components/app'
import { EntityMissingState } from '@/components/app/states'
import { getCompetitionDetail } from '@/modules/app/data/repository'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const detail = await getCompetitionDetail(id)
  return { title: detail?.competition.name ?? 'Compétition' }
}

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getCompetitionDetail(id)
  if (!detail) return <EntityMissingState kind="Compétition" />

  return (
    <div className="page-stack">
      <CompetitionHeader competition={detail.competition} />

      {detail.seasons.length === 0 ? (
        <EmptyState
          title="Aucune saison validée"
          description="La compétition existe, mais aucune saison canonique n’est encore disponible."
        />
      ) : (
        detail.seasons.map(({ season, teams, matches, standings }) => (
          <section className="season-panel" key={season.entity_id}>
            <div className="season-heading">
              <div>
                <p className="eyebrow">Saison</p>
                <h2>{season.name}</h2>
              </div>
              <span className="status-pill">{season.status}</span>
            </div>

            <div className="page-section compact">
              <SectionHeader title="Classement" />
              <StandingsTable rows={standings} />
            </div>

            <div className="page-section compact">
              <SectionHeader title="Matchs" />
              {matches.length > 0 ? (
                <div className="match-grid">
                  {matches.map((match) => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              ) : (
                <NoDataState>Aucun match validé n’est associé à cette saison.</NoDataState>
              )}
            </div>

            <div className="page-section compact">
              <SectionHeader title="Équipes engagées" />
              {teams.length > 0 ? (
                <ul className="simple-list">
                  {teams.map((team) => (
                    <li key={team.id}>{team.name}</li>
                  ))}
                </ul>
              ) : (
                <NoDataState>Aucune équipe engagée n’est encore renseignée.</NoDataState>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
