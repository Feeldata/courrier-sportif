import Link from 'next/link'

import { CompetitionCard, EmptyState, MatchCard, SectionHeader } from '@/components/app'
import { BallIcon, ShieldIcon, TrophyIcon, UsersIcon } from '@/components/app/icons'
import { getHomeData } from '@/modules/app/data/repository'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const data = await getHomeData()

  return (
    <div className="page-stack">
      <section className="home-hero">
        <p className="eyebrow">Courrier Sportif</p>
        <h1>Tout le sport camerounais au même endroit.</h1>
        <p>Données, statistique, tendance et plus.</p>
        <Link className="button button-primary" href="/competitions">
          Voir les compétitions
        </Link>
      </section>

      <section className="stats-grid" aria-label="Catalogue disponible">
        <div className="stat-card">
          <TrophyIcon />
          <strong>{data.counts.competitions}</strong>
          <span>Compétition{data.counts.competitions === 1 ? '' : 's'}</span>
        </div>
        <div className="stat-card">
          <BallIcon />
          <strong>{data.counts.matches}</strong>
          <span>Match{data.counts.matches === 1 ? '' : 's'}</span>
        </div>
        <div className="stat-card">
          <ShieldIcon />
          <strong>{data.counts.clubs}</strong>
          <span>Club{data.counts.clubs === 1 ? '' : 's'}</span>
        </div>
        <div className="stat-card">
          <UsersIcon />
          <strong>{data.counts.players}</strong>
          <span>Joueur{data.counts.players === 1 ? '' : 's'}</span>
        </div>
      </section>

      <section className="page-section">
        <SectionHeader title="Compétitions" link={{ href: '/competitions', label: 'Tout voir' }} />
        {data.competitions.length > 0 ? (
          <div className="card-list">
            {data.competitions.map((competition) => (
              <CompetitionCard key={competition.id} competition={competition} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Aucune compétition"
            description="Aucune compétition validée n’est encore disponible."
          />
        )}
      </section>

      <section className="page-section">
        <SectionHeader title="Matchs" />
        {data.matches.length > 0 ? (
          <div className="match-grid">
            {data.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Pas encore de matchs"
            description="Le catalogue ne contient actuellement aucun match validé. Cet état est normal tant que l’ingestion se poursuit."
          />
        )}
      </section>
    </div>
  )
}
