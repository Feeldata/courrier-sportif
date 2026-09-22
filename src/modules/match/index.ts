export {
  MATCH_STATUS_TRANSITIONS,
  MatchDomainError,
  deriveObservedScoreFromEvents,
} from './lifecycle'
export type { MatchRepository } from './repository'
export { MatchService, sortMatchEvents } from './service'
export type {
  DecisionType,
  FinishMatchInput,
  FixtureInput,
  LineupInput,
  MatchEventInput,
  MatchEventType,
  MatchPeriod,
  MatchSheetInput,
  MatchStatus,
  ObservedScore,
  OfficialResultInput,
  OfficialValidationResult,
  ProvenanceInput,
  SquadRole,
} from './types'

export const MATCH_MODULE = {
  name: 'match',
  responsibility: 'Match lifecycle, lineups, events, scores and official validation orchestration',
  version: '0.1',
} as const
