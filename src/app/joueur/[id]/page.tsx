import Link from 'next/link'
import type { Metadata } from 'next'

import { SectionHeader } from '@/components/app'
import { EntityMissingState, NoDataState } from '@/components/app/states'
import { getPlayerDetail } from '@/modules/app/data/repository'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const detail = await getPlayerDetail(id)
  return { title: detail?.player.display_name ?? 'Joueur' }
}

function formatBirthDate(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-CM', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getPlayerDetail(id)
  if (!detail) return <EntityMissingState kind="Joueur" />

  const birthDate = formatBirthDate(detail.player.date_of_birth)

  return (
    <div className="page-stack">
      <header className="profile-hero player-profile">
        <div className="profile-monogram" aria-hidden="true">
          {detail.player.display_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">Joueur</p>
          <h1>{detail.player.display_name}</h1>
          <div className="meta-row">
            {detail.player.primary_position ? <span>{detail.player.primary_position}</span> : null}
            {detail.player.nationality_code ? <span>{detail.player.nationality_code}</span> : null}
          </div>
        </div>
      </header>

      <section className="info-grid" aria-label="Informations du joueur">
        <div className="info-card">
          <small>Date de naissance</small>
          <strong>{birthDate ?? 'Non renseignée'}</strong>
        </div>
        <div className="info-card">
          <small>Lieu de naissance</small>
          <strong>{detail.player.birth_place ?? 'Non renseigné'}</strong>
        </div>
        <div className="info-card">
          <small>Pied préféré</small>
          <strong>{detail.player.preferred_foot ?? 'Non renseigné'}</strong>
        </div>
        <div className="info-card">
          <small>Statut</small>
          <strong>{detail.player.status}</strong>
        </div>
      </section>

      <section className="page-section">
        <SectionHeader title="Parcours en club" />
        {detail.memberships.length > 0 ? (
          <div className="history-list">
            {detail.memberships.map(({ membership, team, club }) => (
              <div className="history-item" key={membership.membership_id}>
                <div>
                  <strong>
                    {club ? (
                      <Link href={`/club/${club.entity_id}`}>{club.official_name}</Link>
                    ) : (
                      team.name
                    )}
                  </strong>
                  {club ? <span>{team.name}</span> : null}
                </div>
                <small>
                  {[membership.start_date, membership.end_date].filter(Boolean).join(' → ') ||
                    'Dates non renseignées'}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <NoDataState>
            Aucune affiliation validée n’est encore disponible pour ce joueur.
          </NoDataState>
        )}
      </section>
    </div>
  )
}
