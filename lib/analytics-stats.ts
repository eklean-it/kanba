// Pure stats computation for /dashboard/analytics.
//
// Extracted from the page so (a) it can be tested — it never was — and (b) the
// same maths can run over EITHER the caller's own boards (anon key, RLS-scoped)
// or the whole workspace (service-role admin route). Erykah asked for visibility
// into everything on 2026-08-18; analytics was still reading through the anon
// key, so it only ever showed boards she was a member of.

export type TaskRow = {
  column_id: string;
  due_date: string | null;
  is_done: boolean | null;
  assigned_to: string | null;
  priority: string | null;
  archived?: boolean | null;
};

export type ColumnInfo = { name: string; project_id: string };

export type AnalyticsInput = {
  tasks: TaskRow[];
  /** column id → { name, project_id } */
  columns: Record<string, ColumnInfo>;
  /** project id → name */
  projects: Record<string, string>;
  /** user id → display name */
  people: Record<string, string>;
  now?: Date;
};

export type Breakdown = { label: string; value: number };

export type AnalyticsStats = {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
  byStatus: Breakdown[];
  byAssignee: Breakdown[];
  byProject: Breakdown[];
  byPriority: Breakdown[];
};

const PRIORITY_ORDER = ["high", "medium", "low"];

function toSortedBreakdown(counts: Record<string, number>): Breakdown[] {
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function computeAnalytics(input: AnalyticsInput): AnalyticsStats {
  const now = input.now ?? new Date();
  let completed = 0;
  let overdue = 0;
  let inProgress = 0;
  const byStatus: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  // Archived tasks are hidden on the board, so counting them here would make
  // every chart disagree with what people actually see.
  const tasks = input.tasks.filter((t) => !t.archived);

  for (const t of tasks) {
    if (t.is_done) completed += 1;
    else if (t.due_date && new Date(t.due_date) < now) overdue += 1;
    else inProgress += 1;

    const col = input.columns[t.column_id];
    const statusName = col?.name || "Uncategorized";
    byStatus[statusName] = (byStatus[statusName] || 0) + 1;

    const projectName = col
      ? input.projects[col.project_id] || "Unknown project"
      : "Unknown project";
    byProject[projectName] = (byProject[projectName] || 0) + 1;

    const who = t.assigned_to ? input.people[t.assigned_to] || "Member" : "Unassigned";
    byAssignee[who] = (byAssignee[who] || 0) + 1;

    const priority = t.priority || "unset";
    byPriority[priority] = (byPriority[priority] || 0) + 1;
  }

  return {
    total: tasks.length,
    completed,
    overdue,
    inProgress,
    byStatus: toSortedBreakdown(byStatus),
    byAssignee: toSortedBreakdown(byAssignee),
    byProject: toSortedBreakdown(byProject),
    // Priority reads as a scale, not a ranking — keep high→low order so the
    // chart doesn't reshuffle as counts change.
    byPriority: Object.entries(byPriority)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
        const ai = PRIORITY_ORDER.indexOf(a.label);
        const bi = PRIORITY_ORDER.indexOf(b.label);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }),
  };
}
