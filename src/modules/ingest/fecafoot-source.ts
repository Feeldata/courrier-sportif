import type { FetchedSourceDocument } from './types.ts'

export class FecafootFetchError extends Error {
  override readonly name = 'FecafootFetchError'
}

export class FecafootParseError extends Error {
  override readonly name = 'FecafootParseError'
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(?:8217|x2019);/gi, '’')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  if (og?.[1]) return decodeHtml(og[1]).trim()
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1?.[1]) return stripHtml(h1[1])
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  if (title?.[1]) return stripHtml(title[1])
  throw new FecafootParseError('FECAFOOT page title not found')
}

function extractPublishedAt(
  html: string,
  url: string,
): Pick<FetchedSourceDocument, 'publishedAt' | 'publishedAtPrecision'> {
  const time = html.match(/<time\b[^>]+datetime=["']([^"']+)["'][^>]*>/i)
  if (time?.[1])
    return { publishedAt: new Date(time[1]).toISOString(), publishedAtPrecision: 'exact' }

  const urlDate = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\/?(?:$|[?#])/)
  if (urlDate) {
    return {
      publishedAt: `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}T00:00:00.000Z`,
      publishedAtPrecision: 'date',
    }
  }
  return { publishedAt: null, publishedAtPrecision: 'unknown' }
}

export function parseFecafootHtml(
  url: string,
  html: string,
  fetchedAt?: string,
): FetchedSourceDocument {
  const title = extractTitle(html)
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html
  const text = stripHtml(article)
  const published = extractPublishedAt(html, url)
  return {
    url,
    title,
    text,
    fetchedAt,
    externalRef: url,
    captureMode: 'live_html',
    ...published,
  }
}

export async function fetchFecafootDocument(url: string): Promise<FetchedSourceDocument> {
  const target = new URL(url)
  if (target.protocol !== 'https:' || target.hostname !== 'fecafoot-officiel.com') {
    throw new FecafootFetchError('INGEST V0.1 only accepts https://fecafoot-officiel.com URLs')
  }

  const response = await fetch(target, {
    headers: {
      'user-agent': 'CourrierSportif-Ingest/0.1 (+source provenance)',
      accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  })
  if (!response.ok)
    throw new FecafootFetchError(`FECAFOOT fetch failed with HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    throw new FecafootFetchError(`Unsupported FECAFOOT content type: ${contentType}`)
  }
  const html = await response.text()
  return parseFecafootHtml(target.toString(), html, new Date().toISOString())
}
