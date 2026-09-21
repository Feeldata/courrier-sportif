import { describe, expect, it } from 'vitest'

import { APP_MODULE } from '@/modules/app'
import { INGEST_MODULE } from '@/modules/ingest'
import { MATCH_MODULE } from '@/modules/match'

describe('module contracts', () => {
  it('keeps the three V0.1 domains explicit', () => {
    expect([APP_MODULE.name, INGEST_MODULE.name, MATCH_MODULE.name]).toEqual([
      'app',
      'ingest',
      'match',
    ])
  })
})
