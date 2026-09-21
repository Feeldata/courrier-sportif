import type { Metadata } from 'next'

import { EmptyState, PlayerCard, SectionHeader } from '@/components/app'
import { EntityMissingState, NoDataState } from '@/components/app/states'
import { getClubDetail } from '@/modules/app/data/repository'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const detail = await getClubDetail(id)
  return { title: detail?.club.official_name ?? 'Club' }
}

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getClubDetail(id)
  if (!detail) return <EntityMissingState kind="Club" />

  return (
    <div className="page-stack">
      <header className="profile-hero">
        <div className="profile-monogram" aria-hidden="true">
          {detail.club.official_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">Club</p>
          <h1>{detail.club.official_name}</h1>
          <div className="meta-row">
            {detail.club.city ? <span>{detail.club.city}</span> : null}
            {detail.club.country_code ? <span>{detail.club.country_code}</span> : null}
            {detail.club.founded_year ? <span>Fondé en {detail.club.founded_year}</span> : null}
          </div>
        </div>
      </header>

      {detail.teams.length === 0 ? (
        <EmptyState
          title="Aucune équipe renseignée"
          description="Le club est validé, mais aucune équipe n’est encore reliée à sa fiche."
        />
      ) : (
        detail.teams.map(({ team, players }) => (
          <section className="page-section" key={team.entity_id}>
            <SectionHeader title={team.name} />
            <p className="section-note">
              {[team.gender, team.age_category].filter(Boolean).join(' · ')}
            </p>
            {players.length > 0 ? (
              <div className="card-list">
                {players.map(({ player }) => (
                  <PlayerCard
                    key={player.entity_id}
                    id={player.entity_id}
                    name={player.display_name}
                    position={player.primary_position}
                    team={team.name}
                  />
                ))}
              </div>
            ) : (
              <NoDataState>Aucun joueur validé n’est encore associé à cette équipe.</NoDataState>
            )}
          </section>
        ))
      )}
    </div>
  )
}
