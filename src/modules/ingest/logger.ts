import type { PipelineEvent } from './types.ts'

export interface IngestLogger {
  log(event: PipelineEvent): void
}

export class JsonConsoleIngestLogger implements IngestLogger {
  log(event: PipelineEvent): void {
    const method =
      event.level === 'error'
        ? console.error
        : event.level === 'warning'
          ? console.warn
          : console.info
    method(JSON.stringify({ component: 'cs-ingest', ...event }))
  }
}

export class CollectingIngestLogger implements IngestLogger {
  readonly events: PipelineEvent[] = []

  log(event: PipelineEvent): void {
    this.events.push(event)
  }
}
