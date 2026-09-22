# Staging V0.1

This document defines the minimum staging/recovery contract for Courrier Sportif V0.1. It does not authorize DATA schema changes.

## Deployment contract

Required runtime variables:

- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — server only, never exposed through `NEXT_PUBLIC_*`

Operational tooling may also use `SUPABASE_PROJECT_REF` for generated database types. It is not a browser secret.

Before deployment:

1. Use Node 22.
2. Run `npm ci`.
3. Run `npm run check`.
4. Configure staging environment variables in the deployment platform, not in Git.
5. Deploy the exact verified commit.
6. Smoke-test `/`, `/competitions`, `/recherche`, and a missing entity route to confirm sparse/no-data handling.

## Supabase and RLS

DATA V0.1 currently has RLS enabled on every public table and no public policies. Publishable/anon requests therefore see no rows. APP V0.1 reads through a server-only Supabase client using `SUPABASE_SECRET_KEY`; that credential bypasses RLS and must remain backend-only.

The APP repository is intentionally read-only at code level. `npm run verify:hardening` fails if write primitives are introduced under APP routes/components/domain code.

A dedicated staging Supabase project must be provisioned before connected staging is treated as isolated from production. Do not reuse another product's Supabase project.

## Trusted write paths

INGEST, AI and MATCH may write only through their server-side repositories and existing DATA V0.1 tables. Dry-run/default-no-write modes must be used where provided before applying sourced data.

No staging operation may invent sports data to make the catalogue appear populated.

## Logs and errors

INGEST emits structured JSON events. Sensitive key-like fields are redacted before console output. APP public error UI remains generic and does not render server error messages or stack traces.

Validation conflicts belong in `validation_issues`; they are not silently canonicalized.

## Recovery

No DATA migration is part of this hardening release. Application rollback is therefore code-only:

1. Redeploy the previous verified commit.
2. Re-run `npm ci && npm run check` on that commit if rebuilding.
3. If a server secret may have leaked, rotate it in Supabase and update the deployment platform before resuming traffic.
4. Preserve `source_records`, `source_observations`, and `validation_issues`; do not delete provenance to repair a bad ingest.
5. Escalate any required RLS/function/index/schema change to CS DATA + CS COMMAND.

## Pre-publication DATA items

The current Supabase security advisor reports functions with mutable `search_path`; remediation requires a DATA-authorized migration. Public SELECT policies are also absent by design, so direct browser reads are not currently supported. These are tracked as staging/publication decisions rather than changed by hardening.
