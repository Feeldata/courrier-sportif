import 'server-only'

function requireServerValue(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required server environment variable: ${name}`)
  return value
}

export function getServerEnvironment() {
  return {
    supabaseSecretKey: requireServerValue('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY),
  } as const
}
