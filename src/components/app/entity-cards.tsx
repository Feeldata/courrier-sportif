import Link from 'next/link'

import { competitionTypeLabel } from '@/modules/app/read-model'
import type { CompetitionSummary } from '@/modules/app/types'

import { ChevronRightIcon, ShieldIcon, TrophyIcon, UserIcon } from './icons'

export function CompetitionCard({ competition }: { competition: CompetitionSummary }) {
  return (
    <Link className="entity-card" href={`/competitions/${competition.id}`}>
      <span className="entity-icon"><TrophyIcon /></span>
      <span className="entity-card-copy">
        <strong>{competition.name}</strong>
        <span>{competitionTypeLabel(competition.competitionType)}</span>
        {competition.organizerName ? <small>{competition.organizerName}</small> : null}
      </span>
      <ChevronRightIcon className="entity-chevron" />
    </Link>
  )
}

export function ClubCard({ id, name, city }: { id: string; name: string; city: string | null }) {
  return (
    <Link className="entity-card" href={`/club/${id}`}>
      <span className="entity-icon"><ShieldIcon /></span>
      <span className="entity-card-copy">
        <strong>{name}</strong>
        <span>{city ?? 'Localisation non renseignée'}</span>
      </span>
      <ChevronRightIcon className="entity-chevron" />
    </Link>
  )
}

export function PlayerCard({
  id,
  name,
  position,
  team,
}: {
  id: string
  name: string
  position: string | null
  team?: string | null
}) {
  return (
    <Link className="entity-card" href={`/joueur/${id}`}>
      <span className="entity-icon"><UserIcon /></span>
      <span className="entity-card-copy">
        <strong>{name}</strong>
        <span>{position ?? 'Poste non renseigné'}</span>
        {team ? <small>{team}</small> : null}
      </span>
      <ChevronRightIcon className="entity-chevron" />
    </Link>
  )
}
