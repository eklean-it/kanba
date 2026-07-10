'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Check, Users } from 'lucide-react';

type Member = {
  user_id: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

// Multi-assignee picker. Assignment saves instantly on toggle. Keeps
// tasks.assigned_to in sync with the first assignee (board avatar / "assigned
// to me" back-compat). Source of truth is the task_assignees join table.
export function TaskAssignees({
  taskId,
  projectId,
  members,
  taskTitle,
}: {
  taskId: string;
  projectId: string;
  members: Member[];
  taskTitle?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId);
    setSelected(new Set((data || []).map((r: { user_id: string }) => r.user_id)));
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (userId: string) => {
    setBusy(userId);
    try {
      const next = new Set(selected);
      if (next.has(userId)) {
        const { error } = await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', taskId)
          .eq('user_id', userId);
        if (error) throw error;
        next.delete(userId);
      } else {
        const { error } = await supabase
          .from('task_assignees')
          .insert({ task_id: taskId, project_id: projectId, user_id: userId });
        if (error) throw error;
        next.add(userId);
        // Notify the newly-assigned person (best-effort).
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user && auth.user.id !== userId) {
          supabase.from('notifications').insert({
            user_id: userId,
            type: 'task_assigned',
            title: 'Assigned to you',
            message: `You were assigned to "${taskTitle || 'a task'}"`,
            data: { task_id: taskId },
          });
        }
      }
      setSelected(next);
      // keep the denormalized primary assignee in sync
      await supabase.from('tasks').update({ assigned_to: Array.from(next)[0] || null }).eq('id', taskId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update assignee');
    } finally {
      setBusy(null);
    }
  };

  const nameOf = (m: Member) => m.profiles?.full_name || m.profiles?.email || 'Member';

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Users className="h-4 w-4" /> Assignees
      </span>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">Invite members to this board to assign them.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const on = selected.has(m.user_id);
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => toggle(m.user_id)}
                disabled={busy === m.user_id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  on ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {busy === m.user_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : on ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : null}
                {nameOf(m)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
