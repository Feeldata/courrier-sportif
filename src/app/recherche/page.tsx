import type { Metadata } from 'next'

import { NoDataState, PageHeader, SearchResult } from '@/components/app'
import { searchPublicData } from '@/modules/app/data/repository'

export const metadata: Metadata = { title: 'Recherche' }
export const dynamic = 'force-dynamic'

function readQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const query = readQuery(params.q).trim()
  const results = query.length >= 2 ? await searchPublicData(query) : []

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Catalogue"
        title="Recherche"
        description="Cherchez uniquement dans les compétitions, clubs et joueurs réellement présents dans la base."
      />
      <form className="search-form" action="/recherche" method="get" role="search">
        <label className="sr-only" htmlFor="search-q">
          Rechercher
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Nom d’une compétition, d’un club ou d’un joueur"
          autoComplete="off"
        />
        <button className="button button-primary" type="submit">
          Rechercher
        </button>
      </form>

      {query.length < 2 ? (
        <NoDataState>Saisissez au moins deux caractères pour lancer une recherche.</NoDataState>
      ) : results.length > 0 ? (
        <section className="page-section">
          <div className="section-header">
            <h2>
              {results.length} résultat{results.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="card-list">
            {results.map((result) => (
              <SearchResult key={`${result.kind}-${result.id}`} result={result} />
            ))}
          </div>
        </section>
      ) : (
        <NoDataState>Aucun résultat validé pour « {query} ».</NoDataState>
      )}
    </div>
  )
}
