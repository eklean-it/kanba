'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Tag, Check, Plus } from 'lucide-react';
import { LABEL_COLOR_KEYS, labelClass } from '@/lib/label-colors';

type Label = { id: string; name: string; color: string };

// Per-board labels: toggle existing ones onto the task, or create a new one.
export function TaskLabels({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('gray');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: all }, { data: on }] = await Promise.all([
      supabase.from('labels').select('id, name, color').eq('project_id', projectId).order('created_at'),
      supabase.from('task_labels').select('label_id').eq('task_id', taskId),
    ]);
    setLabels((all || []) as Label[]);
    setSelected(new Set((on || []).map((r: { label_id: string }) => r.label_id)));
    setLoading(false);
  }, [projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (labelId: string) => {
    setBusy(labelId);
    try {
      const next = new Set(selected);
      if (next.has(labelId)) {
        const { error } = await supabase.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId);
        if (error) throw error;
        next.delete(labelId);
      } else {
        const { error } = await supabase.from('task_labels').insert({ task_id: taskId, label_id: labelId, project_id: projectId });
        if (error) throw error;
        next.add(labelId);
      }
      setSelected(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update label');
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('labels')
        .insert({ project_id: projectId, name: newName.trim(), color: newColor })
        .select('id, name, color')
        .single();
      if (error) throw error;
      const lbl = data as Label;
      setLabels((prev) => [...prev, lbl]);
      await supabase.from('task_labels').insert({ task_id: taskId, label_id: lbl.id, project_id: projectId });
      setSelected((prev) => new Set(prev).add(lbl.id));
      setNewName('');
      setCreating(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create label');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Tag className="h-4 w-4" /> Labels
      </span>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {labels.map((l) => {
            const on = selected.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggle(l.id)}
                disabled={busy === l.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${labelClass(l.color)} ${
                  on ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {busy === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Check className="h-3 w-3" /> : null}
                {l.name}
              </button>
            );
          })}
          {creating ? (
            <span className="inline-flex items-center gap-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Label name"
                className="h-6 w-24 rounded border bg-background px-1.5 text-xs"
                autoFocus
              />
              <select
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-6 rounded border bg-background text-xs"
              >
                {LABEL_COLOR_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button type="button" onClick={create} disabled={adding} className="text-xs font-medium text-primary">
                {adding ? '…' : 'Add'}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          )}
        </div>
      )}
    </div>
  );
}
