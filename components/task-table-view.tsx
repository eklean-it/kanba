'use client';

import { useState } from 'react';
import type { Column, Task, ProjectMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { labelClass } from '@/lib/label-colors';
import { Flag, Archive, Trash2, X } from 'lucide-react';

// Spreadsheet-style view of every task, with row selection + bulk actions.
export function TaskTableView({
  columns,
  projectMembers,
  onEditTask,
  onBulkArchive,
  onBulkDelete,
}: {
  columns: Column[];
  projectMembers: ProjectMember[];
  onEditTask: (t: Task) => void;
  onBulkArchive?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => void;
}) {
  const rows = columns.flatMap((c) => c.tasks.map((t) => ({ ...t, _status: c.name })));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = Array.from(selected);
  const allSelected = rows.length > 0 && rows.every((r: any) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r: any) => r.id)));

  const priorityColor = (p: string) =>
    p === 'high' ? 'text-red-600 dark:text-red-400' : p === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400';
  const nameOf = (id?: string | null) => {
    const m = projectMembers.find((x) => x.user_id === id);
    return m ? m.profiles?.full_name || m.profiles?.email : id ? 'Member' : '—';
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No tasks yet.</p>;

  return (
    <div className="space-y-3">
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">{ids.length} selected</span>
          {onBulkArchive && (
            <Button size="sm" variant="outline" onClick={() => { onBulkArchive(ids); setSelected(new Set()); }}>
              <Archive className="mr-1 h-3.5 w-3.5" /> Archive
            </Button>
          )}
          {onBulkDelete && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => { if (confirm(`Delete ${ids.length} task(s)?`)) { onBulkDelete(ids); setSelected(new Set()); } }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Assignee</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Labels</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label="Select task" />
                </td>
                <td className="cursor-pointer px-3 py-2" onClick={() => onEditTask(t)}>
                  <span className={t.is_done ? 'text-muted-foreground line-through' : 'font-medium'}>{t.title}</span>
                </td>
                <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{t._status}</Badge></td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-xs ${priorityColor(t.priority)}`}>
                    <Flag className="h-3 w-3" />{t.priority}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{nameOf(t.assigned_to)}</td>
                <td className="px-3 py-2 text-xs">{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(t.labels || []).map((l: any) => (
                      <span key={l.id} className={`rounded-full px-2 py-0.5 text-[10px] ${labelClass(l.color)}`}>{l.name}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
