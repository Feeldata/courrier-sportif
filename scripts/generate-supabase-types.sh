#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF before generating database types}"

output="src/lib/supabase/database.types.ts"
tmp="${output}.tmp"

npx supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  --schema public > "$tmp"

mv "$tmp" "$output"
echo "Updated $output from Supabase project $SUPABASE_PROJECT_REF"
