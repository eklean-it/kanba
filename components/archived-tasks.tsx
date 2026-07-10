'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, ArchiveRestore, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

type T = { id: string; title: string };

export function ArchivedTasks({ projectId, onChanged }: { projectId: string; onChanged: () => void }) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: cols } = await supabase.from('columns').select('id').eq('project_id', projectId);
    const colIds = (cols || []).map((c: { id: string }) => c.id);
    if (!colIds.length) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('tasks').select('id, title').in('column_id', colIds).eq('archived', true);
    setItems((data || []) as T[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    const { error } = await supabase.from('tasks').update({ archived: false }).eq('id', id);
    if (error) {
      toast.error('Failed to restore');
      load();
      return;
    }
    toast.success('Task restored');
    onChanged();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p>No archived tasks.</p>
      </div>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {items.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="truncate text-sm">{t.title}</span>
          <Button size="sm" variant="outline" onClick={() => restore(t.id)}>
            <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}
