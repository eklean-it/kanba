# Tasks release workflow

CI validates types, lint, tests, strict builds and dependency security.
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

`vercel.json` disables Git-triggered deployments from all branches once this configuration is read.
Verify no Git production deployment appears for that merge before calling the
bypass closed; manual CLI deployment is unaffected. Disable automatic production Git deployment before merging any
change intended only for staging; current production keeps serving. Configure
main-only environments/reviewers if the GitHub plan supports them. No live
Vercel setting was changed by this patch. Current available EKGO Vercel auth
returned 403, so project discovery and activation require corrected credentials.

All automatic Git deployments are disabled, including PR previews, so preview
database isolation is checked by the workflow before a preview is published.

Builds use Node 22 and npm 11.6.4. CI also runs the built application against
placeholder data, checking hydration, route parameters and unauthorized API
access. Database schema changes remain outside these deployment workflows.
