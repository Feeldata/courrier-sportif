import { afterEach, describe, expect, it } from 'vitest'

import { getPublicEnvironment } from './public'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('getPublicEnvironment', () => {
  it('reads an explicit staging configuration', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'

    expect(getPublicEnvironment()).toEqual({
      appEnvironment: 'staging',
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'publishable-key',
    })
  })

  it('rejects a missing Supabase URL', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key'

    expect(() => getPublicEnvironment()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
