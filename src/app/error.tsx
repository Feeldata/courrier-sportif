'use client'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="state-panel state-panel-error" role="alert">
      <div className="state-dot" aria-hidden="true" />
      <h1>Données indisponibles</h1>
      <p>Courrier Sportif n’a pas pu charger les données depuis Supabase.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Réessayer
      </button>
    </section>
  )
}
