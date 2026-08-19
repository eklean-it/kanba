import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdmin } from "@/lib/super-admins";
import {
  summarizeBoards,
  type BoardRow,
  type MemberRow,
  type PersonRow,
  type TaskRow,
} from "@/lib/board-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Service-role client — never exposed to the browser; used only in this route.
// Mirrors /api/admin/users deliberately: the projects/columns/tasks RLS is
// membership-keyed end to end, so reading every board goes through one
// allowlist-gated endpoint rather than punching a super-admin hole through
// policies that guard every other table.
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The real security boundary — identical to /api/admin/users. The page-level
// gate is UX only.
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
 * Every board in the workspace, with owner, members and task counts.
 *
 * Answers Erykah's 2026-08-18 question ("Am I able to see all the teams
 * dashboards?") which the dashboard could not — `app/dashboard/page.tsx` reads
 * projects through the anon key, and `projects_select_accessible` grants a row
 * only to the owner or a listed member.
 *
 * Read-only. Listing a board is NOT the same as being able to open it: opening
 * still goes through RLS, which is why each row reports `viewerHasAccess` and
 * offers Join when it is false.
 */
export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const [projectsRes, membersRes, columnsRes, peopleRes] = await Promise.all([
    gate.admin.from("projects").select("id, name, slug, created_at, user_id"),
    gate.admin.from("project_members").select("project_id, user_id, role"),
    // tasks carry column_id, not project_id — map through columns so a board's
    // counts can't silently pick up another board's tasks.
    gate.admin.from("columns").select("id, project_id"),
    gate.admin.from("profiles").select("id, email, full_name"),
  ]);

  for (const res of [projectsRes, membersRes, columnsRes, peopleRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const columns = (columnsRes.data ?? []) as Array<{ id: string; project_id: string }>;
  const projectByColumn = new Map(columns.map((c) => [c.id, c.project_id]));

  const tasksRes = await gate.admin.from("tasks").select("column_id, is_done, archived");
  if (tasksRes.error) {
    return NextResponse.json({ error: tasksRes.error.message }, { status: 500 });
  }

  const tasks: TaskRow[] = ((tasksRes.data ?? []) as Array<{
    column_id: string;
    is_done: boolean | null;
    archived: boolean | null;
  }>)
    .map((t) => ({
      project_id: projectByColumn.get(t.column_id) ?? "",
      is_done: t.is_done,
      archived: t.archived,
    }))
    // A task whose column was deleted has no board to belong to; dropping it
    // beats attributing it to a board that isn't real.
    .filter((t) => t.project_id !== "");

  const boards: BoardRow[] = ((projectsRes.data ?? []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    created_at: string | null;
    user_id: string;
  }>).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    created_at: p.created_at,
    owner_user_id: p.user_id,
  }));

  return NextResponse.json({
    boards: summarizeBoards({
      boards,
      members: (membersRes.data ?? []) as MemberRow[],
      tasks,
      people: (peopleRes.data ?? []) as PersonRow[],
      viewerUserId: gate.caller.id,
    }),
  });
}

/**
 * Add the calling super-admin to a board as a member, so they can actually open
 * and work in it. Deliberately self-service only — this route will not add
 * anyone else, so it can never be used to grant a third party access.
 */
export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json().catch(() => ({}));
  const projectId = String(body.project_id || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const { data: project, error: projectErr } = await gate.admin
    .from("projects")
    .select("id, name, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  if (project.user_id === gate.caller.id) {
    return NextResponse.json({ ok: true, alreadyHadAccess: true, board: project.name });
  }

  // project_members has UNIQUE(project_id, user_id); upsert makes re-clicking
  // Join a no-op instead of a duplicate-key error.
  const { error: insertErr } = await gate.admin
    .from("project_members")
    .upsert(
      {
        project_id: projectId,
        user_id: gate.caller.id,
        role: "member",
        invited_by: gate.caller.id,
        joined_at: new Date().toISOString(),
      },
      { onConflict: "project_id,user_id" },
    );
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, board: project.name });
}
