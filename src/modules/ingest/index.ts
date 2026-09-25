export { FECAFOOT_SOURCE, INGEST_V01 } from './core'
export { fetchFecafootDocument, parseFecafootHtml } from './fecafoot-source'
export { ingestFecafootDocument } from './pipeline'
export {
  ELITE_ONE_COMPETITION_ID,
  INGEST_V02,
  ingestCatalogueDocument,
  seasonEntityId,
} from './catalogue-v02'
export { MemoryCatalogueRepository } from './catalogue-v02-memory'
export { SupabaseCatalogueRepository } from './catalogue-v02-supabase'
export { parseFecafootFixtures } from './fixtures-v02'
export type { CatalogueDocument, CatalogueResult } from './catalogue-v02'
export type { CatalogueRepository } from './catalogue-v02-repository'
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
