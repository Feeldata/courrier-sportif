import { EmptyState } from '@/components/app'

export default function NotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Cette page n’existe pas ou n’est pas encore disponible."
      action={{ href: '/', label: 'Retour à l’accueil' }}
    />
  )
}
