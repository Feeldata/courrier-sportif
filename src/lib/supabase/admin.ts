import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getPublicEnvironment } from '../env/public.ts'
import { getServerEnvironment } from '../env/server.ts'
import type { Database } from './database.types.ts'

export function createAdminSupabaseClient() {
  const { supabaseUrl } = getPublicEnvironment()
  const { supabaseSecretKey } = getServerEnvironment()

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
