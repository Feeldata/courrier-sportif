import type { MatchEventView } from '@/modules/app/types'

import { NoDataState } from './states'

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    goal: 'But',
    own_goal: 'But contre son camp',
    penalty_goal: 'Penalty marqué',
    penalty_missed: 'Penalty manqué',
    yellow_card: 'Carton jaune',
    red_card: 'Carton rouge',
    substitution: 'Remplacement',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}

export function MatchTimeline({ events }: { events: MatchEventView[] }) {
  if (events.length === 0) {
    return <NoDataState>Aucun événement de match validé n’est disponible.</NoDataState>
  }

  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.id}>
          <div className="timeline-time">
            {event.minute === null
              ? '—'
              : `${event.minute}${event.stoppageMinute ? `+${event.stoppageMinute}` : ''}’`}
          </div>
          <div className="timeline-dot" aria-hidden="true" />
          <div className="timeline-content">
            <strong>{eventLabel(event.eventType)}</strong>
            {event.playerName ? <span>{event.playerName}</span> : null}
            {event.relatedPlayerName ? <small>Avec {event.relatedPlayerName}</small> : null}
            {event.teamName ? <small>{event.teamName}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
