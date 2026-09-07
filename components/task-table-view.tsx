'use client';

import { useEffect, useRef, useState } from 'react';
import type { Column, Task, ProjectMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { labelClass } from '@/lib/label-colors';
import { buildInlinePatch, type InlineField } from '@/lib/task-inline-edit';
import { Flag, Archive, Trash2, X, Pencil } from 'lucide-react';

// Spreadsheet-style view of every task, with row selection + bulk actions and
// inline editing. Erykah asked to "type things from this view" (2026-08-20)
// rather than open a dialog for every small change.
//
// What is editable inline: title, status, priority, assignee, due date.
// Labels are not — they are a multi-select, so that one still opens the dialog,
// which is why every row keeps an explicit "Open" button. Making the title
// click-to-edit would otherwise remove the only way into the full task.

type Editing = { id: string; field: InlineField } | null;

export function TaskTableView({
  columns,
  projectMembers,
  onEditTask,
  onBulkArchive,
  onBulkDelete,
  onInlineUpdate,
}: {
  columns: Column[];
  projectMembers: ProjectMember[];
  onEditTask: (t: Task) => void;
  onBulkArchive?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
  /**
   * Persists one inline cell edit. Omit to render the table read-only, which
   * is what the archived view wants.
   */
  onInlineUpdate?: (taskId: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const rows = columns.flatMap((c) =>
    c.tasks.map((t) => ({ ...t, _status: c.name, _columnId: c.id })),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ids = Array.from(selected);
  const allSelected = rows.length > 0 && rows.every((r: any) => selected.has(r.id));
  const editable = Boolean(onInlineUpdate);
  const columnOptions = columns.map((c) => ({ id: c.id, name: c.name }));

  useEffect(() => {
    if (editing?.field === 'title') inputRef.current?.focus();
  }, [editing]);

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r: any) => r.id)));

  const beginEdit = (id: string, field: InlineField, current: string) => {
    if (!editable) return;
    setEditing({ id, field });
    setDraft(current);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft('');
  };

  // Single write path for every cell. `buildInlinePatch` returning null means
  // the value would damage the row or is uninterpretable — we drop back to the
  // stored value rather than writing it.
  const commit = async (taskId: string, field: InlineField, rawValue: string) => {
    if (!onInlineUpdate) return;
    const patch = buildInlinePatch(field, rawValue, columnOptions);
    if (!patch) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await onInlineUpdate(taskId, patch);
    } finally {
      setSaving(false);
      cancelEdit();
    }
  };

  const priorityColor = (p: string) =>
    p === 'high'
      ? 'text-red-600 dark:text-red-400'
      : p === 'medium'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-green-600 dark:text-green-400';

  const nameOf = (id?: string | null) => {
    const m = projectMembers.find((x) => x.user_id === id);
    return m ? m.profiles?.full_name || m.profiles?.email : id ? 'Member' : '—';
  };

  // Shared affordance for the cells that are click-to-edit, so a reader can
  // tell an editable cell from a static one before clicking it.
  const cellButton = 'w-full rounded px-1 py-0.5 text-left hover:bg-muted';

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No tasks yet.</p>;

  return (
    <div className="space-y-3">
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">{ids.length} selected</span>
          {onBulkArchive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onBulkArchive(ids);
                setSelected(new Set());
              }}
            >
              <Archive className="mr-1 h-3.5 w-3.5" /> Archive
            </Button>
          )}
          {onBulkDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (confirm(`Delete ${ids.length} task(s)?`)) {
                  onBulkDelete(ids);
                  setSelected(new Set());
                }
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {editable && (
        <p className="text-xs text-muted-foreground">
          Click any cell to edit it. Enter saves, Esc cancels.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Labels</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => {
              const isEditing = (field: InlineField) =>
                editing !== null && editing.id === t.id && editing.field === field;

              return (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(t.id)}
                      onChange={() => toggle(t.id)}
                      aria-label="Select task"
                    />
                  </td>

                  {/* Title — the cell Erykah actually wants to type in. */}
                  <td className="px-3 py-2">
                    {isEditing('title') ? (
                      <input
                        ref={inputRef}
                        className="w-full rounded border bg-background px-1 py-0.5"
                        value={draft}
                        disabled={saving}
                        aria-label="Task title"
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commit(t.id, 'title', draft)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commit(t.id, 'title', draft);
                          }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={cellButton}
                        onClick={() => beginEdit(t.id, 'title', t.title)}
                        disabled={!editable}
                      >
                        <span
                          className={
                            t.is_done ? 'text-muted-foreground line-through' : 'font-medium'
                          }
                        >
                          {t.title}
                        </span>
                      </button>
                    )}
                  </td>

                  {/* Status — moves the task between columns. */}
                  <td className="px-3 py-2">
                    {editable ? (
                      <select
                        className="rounded border bg-background px-1 py-0.5 text-xs"
                        value={t._status}
                        disabled={saving}
                        aria-label="Status"
                        onChange={(e) => commit(t.id, 'status', e.target.value)}
                      >
                        {columnOptions.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {t._status}
                      </Badge>
                    )}
                  </td>

                  <td className="px-3 py-2">
                    {editable ? (
                      <select
                        className={`rounded border bg-background px-1 py-0.5 text-xs ${priorityColor(t.priority)}`}
                        value={t.priority}
                        disabled={saving}
                        aria-label="Priority"
                        onChange={(e) => commit(t.id, 'priority', e.target.value)}
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-xs ${priorityColor(t.priority)}`}
                      >
                        <Flag className="h-3 w-3" />
                        {t.priority}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-xs">
                    {editable ? (
                      <select
                        className="rounded border bg-background px-1 py-0.5 text-xs"
                        value={t.assigned_to ?? ''}
                        disabled={saving}
                        aria-label="Assignee"
                        onChange={(e) => commit(t.id, 'assignee', e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {projectMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.profiles?.full_name || m.profiles?.email || 'Member'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      nameOf(t.assigned_to)
                    )}
                  </td>

                  <td className="px-3 py-2 text-xs">
                    {editable ? (
                      <input
                        type="date"
                        className="rounded border bg-background px-1 py-0.5 text-xs"
                        // The stored value can be a full timestamp; <input type="date">
                        // only accepts yyyy-mm-dd and renders blank for anything else.
                        value={t.due_date ? String(t.due_date).slice(0, 10) : ''}
                        disabled={saving}
                        aria-label="Due date"
                        onChange={(e) => commit(t.id, 'due_date', e.target.value)}
                      />
                    ) : t.due_date ? (
                      new Date(t.due_date).toLocaleDateString()
                    ) : (
                      '—'
                    )}
                  </td>

                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(t.labels || []).map((l: any) => (
                        <span
                          key={l.id}
                          className={`rounded-full px-2 py-0.5 text-[10px] ${labelClass(l.color)}`}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* The way into everything inline editing does not cover:
                      description, labels, checklist, dependencies, attachments. */}
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Open ${t.title}`}
                      title="Open full task"
                      onClick={() => onEditTask(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
