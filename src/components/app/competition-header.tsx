import { competitionTypeLabel } from '@/modules/app/read-model'
import type { CompetitionRow } from '@/modules/app/types'

import { TrophyIcon } from './icons'

export function CompetitionHeader({ competition }: { competition: CompetitionRow }) {
  return (
    <section className="competition-hero">
      <span className="competition-hero-icon"><TrophyIcon /></span>
      <div>
        <p className="eyebrow">{competitionTypeLabel(competition.competition_type)}</p>
        <h1>{competition.name}</h1>
        <div className="meta-row">
          {competition.organizer_name ? <span>{competition.organizer_name}</span> : null}
          {competition.country_code ? <span>{competition.country_code}</span> : null}
        </div>
      </div>
    </section>
  )
}
