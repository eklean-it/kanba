# Tasks release and security audit — September 16, 2026

[IN-PROGRESS] Locally implemented release gates; live activation and dependency remediation remain open.

The current repository is `eklean-it/kanba`, local `ekgo-tasks`. Main `bbcce3552bb2ee0b33be40d2e3a105781601b075` has green CI run `34162063101`. Contrary to the initial assumption, CI already runs TypeScript, lint, 40 unit tests and a Next build. Both GitHub deployment environments have no protection rules, repository secrets are empty, and Vercel deploys independently from Git.

Changes: pin workflow actions, test release guards, fail high/critical production dependency audits, remove Next build type/lint bypass flags, require isolated tasks staging (including Prisma connection target), check deployed login/authentication/API behavior, record successful source provenance, and require that exact current-main tested source for manual production release. Tasks uses its own production project `vpvjvfowfxhljojgokya`; no operational database is substituted.

Validation: 6 release/isolation behavioral tests passed; existing 40 tests, TypeScript, strict production build, and actionlint passed. Existing React-hook lint warnings and optional websocket package warnings remain. The largest route bundle is the task project route at approximately 314 kB initial JS; no performance regression is introduced by workflow changes.

Security: full `npm audit` reports 24 advisories (2 critical, 14 high, 7 moderate, 1 low). Next 13.5.1 is affected by several published advisories; xlsx 0.18.5 has high-severity issues and no npm fix. Production audit will fail until reviewed dependency remediation lands. Updating only to the npm-suggested 13.5.11 does not resolve all later vulnerable ranges. A tested supported-framework migration is required. See the official [Next.js security update](https://nextjs.org/blog/security-update-2025-12-11) and current package advisory output for scope; do not infer every advisory is exploitable on this deployment. Vercel specifically mitigates the historical middleware bypass on its hosted infrastructure.

Activation: dedicated tasks staging project/schema and synthetic super-admin, Vercel scoped token and project IDs, isolated preview settings, and disabling Git production auto-deploy. No credentials, private records or production data were copied into artifacts; no production writes or deletes were performed. Detailed activation: `.github/workflows/README-deploy.md`.
