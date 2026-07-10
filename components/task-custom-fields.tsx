'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, SlidersHorizontal, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Field = { id: string; name: string; type: string; options: string[] | null };

// Project-level custom field definitions + per-task values.
export function TaskCustomFields({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('text');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: defs }, { data: vals }] = await Promise.all([
      supabase.from('custom_fields').select('id, name, type, options').eq('project_id', projectId).order('position').order('created_at'),
      supabase.from('task_field_values').select('field_id, value').eq('task_id', taskId),
    ]);
    setFields((defs || []) as Field[]);
    const v: Record<string, string> = {};
    (vals || []).forEach((r: { field_id: string; value: string | null }) => {
      v[r.field_id] = r.value ?? '';
    });
    setValues(v);
    setLoading(false);
  }, [projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveValue = async (fieldId: string, value: string) => {
    setValues((p) => ({ ...p, [fieldId]: value }));
    const { error } = await supabase
      .from('task_field_values')
      .upsert({ task_id: taskId, field_id: fieldId, project_id: projectId, value }, { onConflict: 'task_id,field_id' });
    if (error) toast.error('Failed to save field');
  };

  const addField = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .insert({ project_id: projectId, name: newName.trim(), type: newType, position: fields.length })
        .select('id, name, type, options')
        .single();
      if (error) throw error;
      setFields((p) => [...p, data as Field]);
      setNewName('');
      setShowAdd(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add field');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <SlidersHorizontal className="h-4 w-4" /> Custom fields
      </span>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.id} className="grid grid-cols-3 items-center gap-2">
              <Label className="col-span-1 truncate text-xs">{f.name}</Label>
              <div className="col-span-2">
                {f.type === 'select' && f.options ? (
                  <select
                    value={values[f.id] || ''}
                    onChange={(e) => saveValue(f.id, e.target.value)}
                    className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="">—</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    value={values[f.id] || ''}
                    onChange={(e) => saveValue(f.id, e.target.value)}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>
          ))}
          {showAdd ? (
            <div className="flex items-center gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Field name" className="h-8 text-sm" autoFocus />
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="h-8 rounded-md border bg-background text-sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
              <button type="button" onClick={addField} disabled={adding} className="text-xs font-medium text-primary">
                {adding ? '…' : 'Add'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add field
            </button>
          )}
        </div>
      )}
    </div>
  );
}
