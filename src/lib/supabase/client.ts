'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getPublicEnvironment } from '@/lib/env/public'
import type { Database } from '@/lib/supabase/database.types'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createBrowserSupabaseClient() {
  if (browserClient) return browserClient

  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment()
  browserClient = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)

  return browserClient
}
