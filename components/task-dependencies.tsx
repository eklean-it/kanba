'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Ban, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type T = { id: string; title: string; is_done?: boolean | null };

export function TaskDependencies({ taskId, projectId, tasks }: { taskId: string; projectId: string; tasks: T[] }) {
  const [blockers, setBlockers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('task_dependencies').select('blocked_by_task_id').eq('task_id', taskId);
    setBlockers((data || []).map((r: { blocked_by_task_id: string }) => r.blocked_by_task_id));
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (blockerId: string) => {
    if (!blockerId || blockers.includes(blockerId)) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('task_dependencies')
        .insert({ task_id: taskId, blocked_by_task_id: blockerId, project_id: projectId });
      if (error) throw error;
      setBlockers((p) => [...p, blockerId]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add dependency');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (blockerId: string) => {
    setBlockers((p) => p.filter((x) => x !== blockerId));
    await supabase.from('task_dependencies').delete().eq('task_id', taskId).eq('blocked_by_task_id', blockerId);
  };

  const options = tasks.filter((t) => t.id !== taskId && !blockers.includes(t.id));

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Ban className="h-4 w-4" /> Blocked by
      </span>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <>
          {blockers.length > 0 && (
            <div className="space-y-1">
              {blockers.map((id) => {
                const t = byId.get(id);
                return (
                  <div key={id} className="group flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${t?.is_done ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                    <span className={`flex-1 truncate ${t?.is_done ? 'text-muted-foreground line-through' : ''}`}>{t?.title || 'Task'}</span>
                    <button type="button" onClick={() => remove(id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {options.length > 0 ? (
            <Select value="" onValueChange={add} disabled={busy}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Add a blocking task…" /></SelectTrigger>
              <SelectContent>
                {options.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : blockers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No other tasks to depend on yet.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
