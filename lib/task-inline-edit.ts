// Rules for editing a task straight from the Table view.
//
// Erykah asked to "type things from this view" (2026-08-20). Inline editing
// writes without the confirmation step a dialog gives you, so the guardrails
// live here rather than in the cell components: a cell that returns a bad
// patch corrupts the row with no undo, and this repo's tests run without a DOM
// so a component-level check would not catch it.
//
// Contract: return the patch to write, or null to mean "don't write anything".
// Null is for a value that would damage the row (a blank title) or that we
// cannot interpret (an unknown column, a half-typed date) — NOT for "clear
// this field", which is a legitimate edit and returns an explicit null value.

export type InlineField = 'title' | 'status' | 'priority' | 'assignee' | 'due_date';

export type InlineColumn = { id: string; name: string };

const PRIORITIES = new Set(['low', 'medium', 'high']);

// <input type="date"> hands back yyyy-mm-dd. Anything else is either a paste or
// a locale-formatted string we would store wrong.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildInlinePatch(
  field: InlineField,
  rawValue: string,
  columns: InlineColumn[],
): Record<string, unknown> | null {
  switch (field) {
    case 'title': {
      const title = rawValue.trim();
      // A task with no title is invisible in the board, calendar and search.
      if (!title) return null;
      return { title };
    }

    case 'status': {
      const column = columns.find((c) => c.name === rawValue);
      if (!column) return null;
      return { column_id: column.id };
    }

    case 'priority': {
      if (!PRIORITIES.has(rawValue)) return null;
      return { priority: rawValue };
    }

    case 'assignee': {
      // Empty means unassign, which has to stay expressible from this view.
      return { assigned_to: rawValue === '' ? null : rawValue };
    }

    case 'due_date': {
      if (rawValue === '') return { due_date: null };
      if (!ISO_DATE.test(rawValue)) return null;
      return { due_date: rawValue };
    }

    default:
      return null;
  }
}
