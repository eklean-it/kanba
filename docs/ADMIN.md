# Admin surfaces, and the two things that will bite you

This is the EKGO fork of Kanba, self-hosted at **tasks.eklean.com**. It replaced
Monday. This file documents the super-admin surfaces and the traps in them.

Repo beats memory: if a note elsewhere disagrees with this file, re-verify
against the code.

---

## 🚨 Deleting a user DESTROYS every board they own

There is no delete-user button, and adding one casually would be a data-loss
incident. The FK chain is:

```
auth.users → profiles            ON DELETE CASCADE
           → projects.user_id    ON DELETE CASCADE
           → columns.project_id  ON DELETE CASCADE
           → tasks.column_id     ON DELETE CASCADE
```

Delete a departing employee and Postgres removes their profile, **then every
board they own, then every column, then every task** — including boards the rest
of the team works in daily. No warning, no soft-delete, no recovery short of a
PITR restore.

**Offboarding is therefore a reversible ban**, exposed as **Block sign-in** on
`/dashboard/team`. It sets `ban_duration` on the auth user: sign-in stops, every
row survives, and **Allow sign-in** undoes it.

If a genuine hard delete is ever required, **transfer board ownership first**
(`projects.user_id`), then delete. There is no UI for that transfer today.

Two guards in `/api/admin/users` PATCH:

- You cannot disable **your own** account — unrecoverable from inside the app.
- You cannot disable **another admin** — remove them from the allowlist instead,
  rather than letting the UI host a fight between two people who can each reset
  the other's password.

---

## 🚨 "Invite" sends NO email

There is **no SMTP on this Supabase project**. The Team page calls
`auth.admin.createUser({ email_confirm: true })` and shows a generated
`Ekgo-<12 hex>` password **once**, with a copy button.

So "inviting" someone means: create the account, then hand them the password out
of band (Slack, text). Nobody receives a mail. Do not tell staff to "check their
email".

This is also why **public signup is closed** (`/signup` → `/login`): without a
verification mail you cannot prove someone owns the address they typed, so
"anyone with an @eklean.com address can sign up" would let a stranger claim
`bruce@eklean.com`.

---

## Who is an admin, and why it's an email list in code

`lib/super-admins.ts` holds `SUPER_ADMIN_EMAILS` — currently `it@`, `erykah@`,
`bruce@eklean.com`.

The schema has **no workspace-level role**. `project_members.role` is
per-board (`owner` / `admin` / `member`) only, so the allowlist is a code-level
stand-in for a concept the database doesn't model.

**Why keep it in code:** it cannot be privilege-escalated by a database write. If
someone found an RLS hole and got a write into `profiles`, they still could not
make themselves an admin who can reset everyone's password.

**What it costs:** changing who is an admin needs a PR and a deploy. That is
exactly why Jared reported the Team page as "the link can not be found" on
2026-08-18 — he wasn't on the list, the sidebar hid the item, and the page
redirected him silently. It now says so explicitly instead.

If admin changes ever get frequent (say 30+ staff), a `workspace_roles` table
with a Team-page toggle is the right move — but keep account creation and
password reset behind the code allowlist even then.

### Adding an admin

One-line change to `SUPER_ADMIN_EMAILS`, then merge. Both the page gates and the
`/api/admin/*` routes read the same function, so there is one place to change.

---

## The admin surfaces

All three are gated twice: the page checks `isSuperAdmin` for **UX**, and the
`/api/admin/*` route re-checks the caller's bearer token server-side. **The route
is the security boundary** — the page gate is only there so non-admins get an
explanation instead of a blank screen.

| Surface | Route | What it does |
|---|---|---|
| **Team** | `/dashboard/team` → `/api/admin/users` | Create accounts, reset passwords, block/allow sign-in |
| **All boards** | `/dashboard/boards` → `/api/admin/boards` | Every board with owner, members, task counts; join one to open it |
| **Analytics (All boards)** | `/dashboard/analytics` → `/api/admin/analytics` | Workspace-wide stats, not just your own boards |

### Why these read through service-role routes instead of relaxing RLS

`projects_select_accessible` grants a row only when `auth.uid() = user_id` or the
caller is in `project_members`. The same membership pattern guards `columns`,
`tasks`, `task_comments` and `activity_logs`.

Being on the admin allowlist grants **zero** board visibility through the anon
key — which is why Erykah was told on 2026-08-18 that she could see all the
team's boards when she could not.

Punching a super-admin hole through five tables' policies is a far larger blast
radius than three allowlist-gated, read-only endpoints. So the admin views use
`SUPABASE_SERVICE_ROLE_KEY` server-side and RLS stays untouched.

### Listing a board is not the same as opening one

`/dashboard/boards` reads through the service role, but **opening** a board still
goes through RLS. So each row reports whether the viewer already has access and
offers **Join to open** when it doesn't. That POST adds **the caller only** — it
can never be used to grant a third party access.

---

## Gotchas when working on the admin views

- **`tasks` carries `column_id`, not `project_id`.** Per-board counts must map
  through `columns`. A task whose column is gone gets dropped rather than
  attributed to a board it isn't on.
- **Archived tasks are hidden on the board**, so they're counted separately from
  open everywhere. Counting them as open overstates every board's workload and
  makes the charts disagree with what people see.
- **PostgREST caps a response at 1000 rows.** `tasks` is the table here that will
  cross it. `/api/admin/analytics` pages explicitly; a bare `select()` would
  silently understate every chart.
- **Nav and route must ship together.** A page that exists but isn't in
  `app-sidebar.tsx` is unreachable and gets reported as a broken link — see the
  2026-08-18 thread.

---

## Verification

`npm run typecheck` · `npm run lint` · `npm test` · `npm run build` — all four run
in CI (`.github/workflows/ci.yml`) on every push and PR. Deploys are Vercel's git
integration; CI's job is to fail before that happens.

The auth boundary is checked against production by curling each route with no
token and with a forged bearer token; both must return 401.

## Still outstanding

- 🔴 **Rotate the `eklean-tasks` service_role key and DB password.** Both were
  passed through chat during setup on 2026-07-10 and have never been rotated.
  That is a full-database key, and the whole team is now moving onto this app.
- 🔴 No signed-in human has clicked through the admin surfaces end to end.
- Board-ownership transfer has no UI, which is what a hard delete would need.
- The Monday `.xlsx` import has never been run against a real Monday export.
