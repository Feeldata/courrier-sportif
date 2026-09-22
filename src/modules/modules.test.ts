import { describe, expect, it } from 'vitest'

import { AI_MODULE } from '@/modules/ai'
import { APP_MODULE } from '@/modules/app'
import { INGEST_MODULE } from '@/modules/ingest'
import { MATCH_MODULE } from '@/modules/match'

describe('module contracts', () => {
  it('keeps the four V0.1 domains explicit', () => {
    expect([APP_MODULE.name, INGEST_MODULE.name, MATCH_MODULE.name, AI_MODULE.name]).toEqual([
      'app',
      'ingest',
      'match',
      'ai',
    ])
  })
})
