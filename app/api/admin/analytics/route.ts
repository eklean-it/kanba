import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireSuperAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false as const, error: "Not authenticated", status: 401 };
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, error: "Invalid session", status: 401 };
  if (!isSuperAdmin(data.user.email)) return { ok: false as const, error: "Forbidden", status: 403 };
  return { ok: true as const, admin, caller: data.user };
}

/**
 * Workspace-wide analytics source: every project, column, task and person,
 * regardless of membership.
 *
 * /dashboard/analytics previously read through the anon key, so RLS scoped it to
 * boards the caller owns or is a member of — meaning a super-admin's "analytics"
 * silently excluded most of the company. Erykah asked for visibility into
 * everything (2026-08-18); this is the read behind the "All boards" mode.
 *
 * Read-only. Returns raw rows and lets the client run the same
 * `computeAnalytics` used for the personal view, so the two modes can never
 * disagree on the maths.
 */
export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  // Narrow once so the closure below doesn't re-check on every page.
  const admin = gate.admin;

  // Page explicitly: PostgREST caps a response at 1000 rows, and tasks is the
  // one table here that will cross it. Silently returning the first 1000 would
  // understate every chart, which is worse than being slow.
  async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
    const pageSize = 1000;
    const out: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from(table)
        .select(columns)
        .order("id")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as T[];
      out.push(...rows);
      if (rows.length < pageSize) return out;
    }
  }

  try {
    const [projects, columns, tasks, people] = await Promise.all([
      fetchAll<{ id: string; name: string }>("projects", "id, name"),
      fetchAll<{ id: string; name: string; project_id: string }>(
        "columns",
        "id, name, project_id",
      ),
      fetchAll<{
        id: string;
        column_id: string;
        due_date: string | null;
        is_done: boolean | null;
        assigned_to: string | null;
        priority: string | null;
        archived: boolean | null;
      }>("tasks", "id, column_id, due_date, is_done, assigned_to, priority, archived"),
      fetchAll<{ id: string; full_name: string | null; email: string }>(
        "profiles",
        "id, full_name, email",
      ),
    ]);

    return NextResponse.json({
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      columns: columns.map((c) => ({ id: c.id, name: c.name, project_id: c.project_id })),
      tasks: tasks.map((t) => ({
        column_id: t.column_id,
        due_date: t.due_date,
        is_done: t.is_done,
        assigned_to: t.assigned_to,
        priority: t.priority,
        archived: t.archived,
      })),
      people: people.map((p) => ({ id: p.id, name: p.full_name || p.email })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load analytics" },
      { status: 500 },
    );
  }
}
