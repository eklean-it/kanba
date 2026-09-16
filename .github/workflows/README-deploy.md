# Tasks release workflow

CI validates types, lint, tests, strict builds and production dependency security.
Staging requires a successful current-main CI SHA. It validates that both the
Supabase URL and Prisma database URL point to a dedicated **tasks staging**
project; the operational app databases and tasks production are rejected.
After deployment it checks the login page, unauthenticated API rejection and
signed-in staging analytics. A successful run emits immutable source provenance.
Production is a separate manual run using that successful staging run ID.

Required GitHub environment variables for both `staging` and `production`:
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `TASKS_PROJECT_REF`. Production tasks ref is
`vpvjvfowfxhljojgokya`. A separate tasks staging project must be provisioned;
never point it at either operational app database.

Both environments need `VERCEL_TOKEN`; staging also needs `AUDIT_EMAIL`,
`AUDIT_PASSWORD` for a synthetic staging super-admin and optionally
`VERCEL_AUTOMATION_BYPASS_SECRET`. Preview Vercel settings need matching staging
public and server Supabase keys plus `DATABASE_URL`. Payment credentials must be
sandbox-only. No automatic migrations or data copies are performed here.

Vercel Git auto-deploy bypasses these workflows until it is disabled in the
actual project. Disable automatic production Git deployment before merging any
change intended only for staging; current production keeps serving. Configure
main-only environments/reviewers if the GitHub plan supports them. No live
Vercel setting was changed by this patch. Current available EKGO Vercel auth
returned 403, so project discovery and activation require corrected credentials.
