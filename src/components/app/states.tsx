import Link from 'next/link'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Chargement des données…' }: { label?: string }) {
  return (
    <div className="loading-stack" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card short" />
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { href: string; label: string }
}) {
  return (
    <section className="state-panel state-panel-empty">
      <div className="state-dot" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <Link className="button button-secondary" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </section>
  )
}

export function NoDataState({ children }: { children: ReactNode }) {
  return <div className="no-data">{children}</div>
}

export function EntityMissingState({ kind }: { kind: string }) {
  return (
    <section className="page-section">
      <EmptyState
        title={`${kind} introuvable`}
        description="Cette donnée n’existe pas encore dans le catalogue validé de Courrier Sportif."
        action={{ href: '/recherche', label: 'Rechercher autre chose' }}
      />
    </section>
  )
}
