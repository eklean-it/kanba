// Shaping for the super-admin "All boards" overview.
//
// Why this exists: Erykah asked on 2026-08-18 whether she could see all the
// team's boards, and was told yes. She could not. `app/dashboard/page.tsx`
// loads projects with `project_members!inner(role)` through the anon key, so
// RLS decides — and `projects_select_accessible` only grants a row when
// `auth.uid() = user_id` OR the caller is in `project_members`. Being on the
// SUPER_ADMIN_EMAILS provisioning allowlist grants no board visibility at all.
//
// The overview therefore reads through a service-role route (same pattern as
// /api/admin/users) rather than by loosening RLS: the membership-keyed policies
// are the security model for every other table here, and punching a
// super-admin hole through them would be a much larger blast radius than one
// read-only, allowlist-gated endpoint.
//
// Pure so the counting and sorting are testable without a database.

export type BoardRow = {
  id: string;
  name: string;
  slug: string | null;
  created_at: string | null;
  owner_user_id: string;
};

export type MemberRow = {
  project_id: string;
  user_id: string;
  role: string | null;
};

export type TaskRow = {
  project_id: string;
  is_done: boolean | null;
  archived: boolean | null;
};

export type PersonRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export type BoardSummary = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string | null;
  owner: { id: string; email: string | null; name: string | null };
  members: Array<{ id: string; email: string | null; name: string | null; role: string }>;
  /** Members excluding the owner — the owner is always implicitly on the board. */
  memberCount: number;
  openTasks: number;
  doneTasks: number;
  archivedTasks: number;
  /** True when the viewer can already open this board without being added. */
  viewerHasAccess: boolean;
};

export function summarizeBoards(input: {
  boards: BoardRow[];
  members: MemberRow[];
  tasks: TaskRow[];
  people: PersonRow[];
  /** The super-admin viewing the page — drives the "Join" affordance. */
  viewerUserId: string | null;
}): BoardSummary[] {
  const personById = new Map(input.people.map((p) => [p.id, p]));

  const membersByBoard = new Map<string, MemberRow[]>();
  for (const m of input.members) {
    const list = membersByBoard.get(m.project_id);
    if (list) list.push(m);
    else membersByBoard.set(m.project_id, [m]);
  }

  const tasksByBoard = new Map<string, { open: number; done: number; archived: number }>();
  for (const t of input.tasks) {
    const bucket =
      tasksByBoard.get(t.project_id) ?? { open: 0, done: 0, archived: 0 };
    // Archived is its own bucket, not an open task — the board hides them, so
    // counting them as open would overstate every board's workload.
    if (t.archived) bucket.archived += 1;
    else if (t.is_done) bucket.done += 1;
    else bucket.open += 1;
    tasksByBoard.set(t.project_id, bucket);
  }

  return input.boards
    .map((b) => {
      const ownerPerson = personById.get(b.owner_user_id) ?? null;
      const rawMembers = membersByBoard.get(b.id) ?? [];
      const members = rawMembers
        .filter((m) => m.user_id !== b.owner_user_id)
        .map((m) => {
          const p = personById.get(m.user_id) ?? null;
          return {
            id: m.user_id,
            email: p?.email ?? null,
            name: p?.full_name ?? null,
            role: m.role ?? "member",
          };
        })
        .sort((a, b2) => (a.email ?? "").localeCompare(b2.email ?? ""));
      const counts = tasksByBoard.get(b.id) ?? { open: 0, done: 0, archived: 0 };
      const viewerHasAccess = Boolean(
        input.viewerUserId &&
          (input.viewerUserId === b.owner_user_id ||
            rawMembers.some((m) => m.user_id === input.viewerUserId)),
      );

      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        createdAt: b.created_at,
        owner: {
          id: b.owner_user_id,
          email: ownerPerson?.email ?? null,
          name: ownerPerson?.full_name ?? null,
        },
        members,
        memberCount: members.length,
        openTasks: counts.open,
        doneTasks: counts.done,
        archivedTasks: counts.archived,
        viewerHasAccess,
      };
    })
    // Busiest boards first, then alphabetical — a super-admin scanning for
    // "who is actually working" wants activity at the top, not creation order.
    .sort((a, b) => b.openTasks - a.openTasks || a.name.localeCompare(b.name));
}
