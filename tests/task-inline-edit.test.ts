import { describe, expect, it } from 'vitest';
import { buildInlinePatch } from '@/lib/task-inline-edit';

// Erykah, 2026-08-20: "Id like the ability to type things from this view"
// (the Table tab). Every cell was read-only text; the only interaction was
// clicking the title to open a dialog she then could not scroll.
//
// These rules decide what an inline cell edit is allowed to write. The point
// of pulling them out of the component is that a bad patch here silently
// corrupts a task — a blank title, an unknown status — and a component test
// would not catch it in this repo (vitest runs with no DOM).

const COLUMNS = [
  { id: 'col-todo', name: 'To Do' },
  { id: 'col-prop', name: 'Proposals' },
  { id: 'col-done', name: 'Done' },
];

describe('buildInlinePatch', () => {
  it('trims and writes a new title', () => {
    expect(buildInlinePatch('title', '  Foothill baffle pipe  ', COLUMNS)).toEqual({
      title: 'Foothill baffle pipe',
    });
  });

  it('refuses to blank a title', () => {
    // A task with no title is unfindable in every other view. Reject rather
    // than write, so an accidental select-all-delete does not destroy the row.
    expect(buildInlinePatch('title', '   ', COLUMNS)).toBeNull();
    expect(buildInlinePatch('title', '', COLUMNS)).toBeNull();
  });

  it('maps a status name to its column id', () => {
    expect(buildInlinePatch('status', 'Proposals', COLUMNS)).toEqual({
      column_id: 'col-prop',
    });
  });

  it('rejects a status that is not a column on this board', () => {
    expect(buildInlinePatch('status', 'Archived', COLUMNS)).toBeNull();
  });

  it('accepts the three real priorities and nothing else', () => {
    expect(buildInlinePatch('priority', 'high', COLUMNS)).toEqual({ priority: 'high' });
    expect(buildInlinePatch('priority', 'medium', COLUMNS)).toEqual({ priority: 'medium' });
    expect(buildInlinePatch('priority', 'low', COLUMNS)).toEqual({ priority: 'low' });
    expect(buildInlinePatch('priority', 'urgent', COLUMNS)).toBeNull();
  });

  it('clears an assignee with an empty value rather than skipping the write', () => {
    // Unassigning has to be expressible. Returning null here would make
    // "remove the assignee" impossible from this view.
    expect(buildInlinePatch('assignee', '', COLUMNS)).toEqual({ assigned_to: null });
    expect(buildInlinePatch('assignee', 'user-9', COLUMNS)).toEqual({ assigned_to: 'user-9' });
  });

  it('clears a due date with an empty value', () => {
    expect(buildInlinePatch('due_date', '', COLUMNS)).toEqual({ due_date: null });
  });

  it('accepts a yyyy-mm-dd due date', () => {
    expect(buildInlinePatch('due_date', '2026-09-30', COLUMNS)).toEqual({
      due_date: '2026-09-30',
    });
  });

  it('rejects a half-typed date instead of writing garbage', () => {
    // <input type="date"> reports a mid-edit value as '' but a pasted or
    // programmatic value can arrive malformed. Never write it through.
    expect(buildInlinePatch('due_date', '2026-09', COLUMNS)).toBeNull();
    expect(buildInlinePatch('due_date', '30/09/2026', COLUMNS)).toBeNull();
  });
});
