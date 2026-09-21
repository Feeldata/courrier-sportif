export type AppEnvironment = 'local' | 'staging' | 'production'

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value === undefined || value === '') return 'local'
  if (value === 'local' || value === 'staging' || value === 'production') return value
  throw new Error(`Invalid NEXT_PUBLIC_APP_ENV: ${value}`)
}

function requirePublicValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getPublicEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV

  return {
    appEnvironment: parseAppEnvironment(appEnvironment),
    supabaseUrl: requirePublicValue('NEXT_PUBLIC_SUPABASE_URL', supabaseUrl),
    supabasePublishableKey: requirePublicValue(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      supabasePublishableKey,
    ),
  } as const
}
