import assert from 'node:assert/strict'
import test from 'node:test'

import { FecafootParseError, parseFecafootHtml } from './fecafoot-source.ts'

test('FECAFOOT HTML parser extracts title, date precision and visible article text', () => {
  const html = `<!doctype html>
    <html><head><meta property="og:title" content="MTN Elite One test" /></head>
    <body><article><p>Le championnat MTN Elite One débutera le 24 janvier 2026.</p></article></body></html>`
  const parsed = parseFecafootHtml(
    'https://fecafoot-officiel.com/actualite/32843/2026/01/13/',
    html,
    '2026-09-19T21:50:00.000Z',
  )
  assert.equal(parsed.title, 'MTN Elite One test')
  assert.equal(parsed.publishedAt, '2026-01-13T00:00:00.000Z')
  assert.equal(parsed.publishedAtPrecision, 'date')
  assert.equal(parsed.captureMode, 'live_html')
  assert.match(parsed.text, /24 janvier 2026/)
})

test('FECAFOOT parser fails explicitly when title metadata is missing', () => {
  assert.throws(
    () => parseFecafootHtml('https://fecafoot-officiel.com/actualite/32843/2026/01/13/', '<article>fact</article>'),
    FecafootParseError,
  )
})
