import type { Metadata } from 'next'

import { CompetitionCard, EmptyState, PageHeader } from '@/components/app'
import { listCompetitions } from '@/modules/app/data/repository'

export const metadata: Metadata = { title: 'Compétitions' }
export const dynamic = 'force-dynamic'

export default async function CompetitionsPage() {
  const competitions = await listCompetitions()

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Football camerounais"
        title="Compétitions"
        description="Les compétitions présentes dans le catalogue validé Courrier Sportif."
      />
      {competitions.length > 0 ? (
        <div className="card-list">
          {competitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucune compétition"
          description="Aucune compétition n’a encore été publiée dans la base validée."
        />
      )}
    </div>
  )
}
