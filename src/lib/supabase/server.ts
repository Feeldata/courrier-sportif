import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getPublicEnvironment } from '@/lib/env/public'
import type { Database } from '@/lib/supabase/database.types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getPublicEnvironment()

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot always write cookies. A future auth task can
          // add the framework proxy/session-refresh path when authentication enters scope.
        }
      },
    },
  })
}
