import { describe, expect, it } from "vitest";
import { computeAnalytics, type TaskRow } from "@/lib/analytics-stats";

const NOW = new Date("2026-08-19T12:00:00Z");

const COLUMNS = {
  "c-todo": { name: "To do", project_id: "p-ops" },
  "c-done": { name: "Done", project_id: "p-ops" },
  "c-other": { name: "Backlog", project_id: "p-sales" },
};
const PROJECTS = { "p-ops": "Ops", "p-sales": "Sales" };
const PEOPLE = { "u-erykah": "Erykah", "u-jared": "Jared" };

function run(tasks: TaskRow[]) {
  return computeAnalytics({ tasks, columns: COLUMNS, projects: PROJECTS, people: PEOPLE, now: NOW });
}

describe("computeAnalytics", () => {
  it("splits done / overdue / in-progress", () => {
    const s = run([
      { column_id: "c-done", due_date: null, is_done: true, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: "2026-08-01", is_done: false, assigned_to: null, priority: "high" },
      { column_id: "c-todo", due_date: "2026-09-01", is_done: false, assigned_to: null, priority: "medium" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: null },
    ]);
    expect(s.total).toBe(4);
    expect(s.completed).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.inProgress).toBe(2);
  });

  it("never counts a done task as overdue even if the due date passed", () => {
    const s = run([
      { column_id: "c-done", due_date: "2026-01-01", is_done: true, assigned_to: null, priority: "high" },
    ]);
    expect(s.completed).toBe(1);
    expect(s.overdue).toBe(0);
  });

  it("excludes archived tasks entirely — the board hides them", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low", archived: true },
    ]);
    expect(s.total).toBe(1);
    expect(s.inProgress).toBe(1);
  });

  it("labels unassigned work as Unassigned, not as a blank", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: "u-jared", priority: "low" },
    ]);
    expect(s.byAssignee.map((b) => b.label).sort()).toEqual(["Jared", "Unassigned"]);
  });

  it("falls back to Member for an assignee with no profile", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: "u-ghost", priority: "low" },
    ]);
    expect(s.byAssignee).toEqual([{ label: "Member", value: 1 }]);
  });

  it("groups across projects — the point of the workspace-wide view", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-other", due_date: null, is_done: false, assigned_to: null, priority: "low" },
    ]);
    expect(s.byProject).toEqual([
      { label: "Ops", value: 2 },
      { label: "Sales", value: 1 },
    ]);
  });

  it("handles a task whose column is missing without dropping it", () => {
    const s = run([
      { column_id: "c-gone", due_date: null, is_done: false, assigned_to: null, priority: "low" },
    ]);
    expect(s.total).toBe(1);
    expect(s.byStatus).toEqual([{ label: "Uncategorized", value: 1 }]);
    expect(s.byProject).toEqual([{ label: "Unknown project", value: 1 }]);
  });

  it("sorts breakdowns by count then alphabetically, so ties are stable", () => {
    const s = run([
      { column_id: "c-other", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
    ]);
    expect(s.byStatus).toEqual([
      { label: "Backlog", value: 1 },
      { label: "To do", value: 1 },
    ]);
  });

  it("keeps priority in high→medium→low order, not count order", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "low" },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "high" },
    ]);
    expect(s.byPriority.map((b) => b.label)).toEqual(["high", "low"]);
  });

  it("labels a null priority as unset and sorts it last", () => {
    const s = run([
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: null },
      { column_id: "c-todo", due_date: null, is_done: false, assigned_to: null, priority: "medium" },
    ]);
    expect(s.byPriority.map((b) => b.label)).toEqual(["medium", "unset"]);
  });

  it("returns zeroed stats for no tasks", () => {
    const s = run([]);
    expect(s).toMatchObject({ total: 0, completed: 0, overdue: 0, inProgress: 0 });
    expect(s.byStatus).toEqual([]);
  });
});
