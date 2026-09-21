import Link from 'next/link'

import type { SearchResultItem } from '@/modules/app/types'

import { ChevronRightIcon, ShieldIcon, TrophyIcon, UserIcon } from './icons'

const icons = {
  competition: TrophyIcon,
  club: ShieldIcon,
  player: UserIcon,
}

const labels = {
  competition: 'Compétition',
  club: 'Club',
  player: 'Joueur',
}

export function SearchResult({ result }: { result: SearchResultItem }) {
  const Icon = icons[result.kind]
  return (
    <Link className="search-result" href={result.href}>
      <span className="search-result-icon"><Icon /></span>
      <span className="search-result-copy">
        <small>{labels[result.kind]}</small>
        <strong>{result.title}</strong>
        {result.subtitle ? <span>{result.subtitle}</span> : null}
      </span>
      <ChevronRightIcon className="entity-chevron" />
    </Link>
  )
}
