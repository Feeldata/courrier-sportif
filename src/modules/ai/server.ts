import 'server-only'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'

import { AiV01Service } from './pipeline'
import { SupabaseAiRepository } from './supabase-repository'

export function createServerAiV01Service() {
  return new AiV01Service(new SupabaseAiRepository(createAdminSupabaseClient()))
}
