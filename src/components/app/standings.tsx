import type { StandingRow } from '@/modules/app/types'

import { NoDataState } from './states'

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return <NoDataState>Aucun classement calculable avec les résultats validés actuellement.</NoDataState>
  }

  return (
    <div className="table-scroll" role="region" aria-label="Classement" tabIndex={0}>
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Équipe</th>
            <th>J</th>
            <th>G</th>
            <th>N</th>
            <th>P</th>
            <th>Diff.</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teamId}>
              <td>{index + 1}</td>
              <td>{row.teamName}</td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.drawn}</td>
              <td>{row.lost}</td>
              <td>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
              <td><strong>{row.points}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
