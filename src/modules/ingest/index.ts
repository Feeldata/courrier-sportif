export { FECAFOOT_SOURCE, INGEST_V01 } from './core'
export { fetchFecafootDocument, parseFecafootHtml } from './fecafoot-source'
export { ingestFecafootDocument } from './pipeline'
export type { IngestRepository } from './repository'
export type {
  FetchedSourceDocument,
  IngestRunResult,
  ObservationDraft,
  PipelineEvent,
  ReviewIssueDraft,
} from './types'

export const INGEST_MODULE = {
  name: 'ingest',
  responsibility: 'Server-side source ingestion orchestration and review workflows',
  version: '0.1',
  primarySource: 'FECAFOOT official website',
} as const
