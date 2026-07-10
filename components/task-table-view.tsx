'use client';

import type { Column, Task, ProjectMember } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { labelClass } from '@/lib/label-colors';
import { Flag } from 'lucide-react';

// Spreadsheet-style view of every task on the board — the "Monday feel".
export function TaskTableView({
  columns,
  projectMembers,
  onEditTask,
}: {
  columns: Column[];
  projectMembers: ProjectMember[];
  onEditTask: (t: Task) => void;
}) {
  const rows = columns.flatMap((c) => c.tasks.map((t) => ({ ...t, _status: c.name })));
  const priorityColor = (p: string) =>
    p === 'high' ? 'text-red-600 dark:text-red-400' : p === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400';
  const nameOf = (id?: string | null) => {
    const m = projectMembers.find((x) => x.user_id === id);
    return m ? m.profiles?.full_name || m.profiles?.email : id ? 'Member' : '—';
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No tasks yet.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
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
            <tr
              key={t.id}
              onClick={() => onEditTask(t)}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2">
                <span className={t.is_done ? 'text-muted-foreground line-through' : 'font-medium'}>{t.title}</span>
              </td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className="text-xs">{t._status}</Badge>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 text-xs ${priorityColor(t.priority)}`}>
                  <Flag className="h-3 w-3" />
                  {t.priority}
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
  );
}
