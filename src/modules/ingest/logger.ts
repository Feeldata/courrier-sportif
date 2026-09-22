import type { PipelineEvent } from './types.ts'

export interface IngestLogger {
  log(event: PipelineEvent): void
}

const SENSITIVE_LOG_KEY =
  /^(authorization|cookie|password|token|secret|api[_-]?key|.*_secret_key|.*_service_role_key)$/i

function redactLogValue(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_LOG_KEY.test(key)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    )
  }
  return value
}

export class JsonConsoleIngestLogger implements IngestLogger {
  log(event: PipelineEvent): void {
    const method =
      event.level === 'error'
        ? console.error
        : event.level === 'warning'
          ? console.warn
          : console.info
    method(JSON.stringify(redactLogValue({ component: 'cs-ingest', ...event })))
  }
}

export class CollectingIngestLogger implements IngestLogger {
  readonly events: PipelineEvent[] = []

  log(event: PipelineEvent): void {
    this.events.push(event)
  }
}
