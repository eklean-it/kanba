'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, ListChecks, Plus, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

type Item = { id: string; text: string; is_done: boolean; position: number };

export function TaskChecklist({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('position')
      .order('created_at');
    setItems((data || []) as Item[]);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({ task_id: taskId, project_id: projectId, text: text.trim(), position: items.length })
        .select('*')
        .single();
      if (error) throw error;
      setItems((p) => [...p, data as Item]);
      setText('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (it: Item) => {
    const next = !it.is_done;
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, is_done: next } : x)));
    const { error } = await supabase.from('task_checklist_items').update({ is_done: next }).eq('id', it.id);
    if (error) {
      toast.error('Failed to update');
      load();
    }
  };

  const remove = async (it: Item) => {
    setItems((p) => p.filter((x) => x.id !== it.id));
    await supabase.from('task_checklist_items').delete().eq('id', it.id);
  };

  const done = items.filter((i) => i.is_done).length;

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <ListChecks className="h-4 w-4" /> Checklist
        {items.length > 0 && <span className="text-xs text-muted-foreground">({done}/{items.length})</span>}
      </span>
      {items.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(it)}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                  it.is_done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary'
                }`}
              >
                {it.is_done && <Check className="h-3 w-3" />}
              </button>
              <span className={`flex-1 text-sm ${it.is_done ? 'text-muted-foreground line-through' : ''}`}>{it.text}</span>
              <button type="button" onClick={() => remove(it)} className="opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add an item…"
          className="h-8 text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={adding}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
