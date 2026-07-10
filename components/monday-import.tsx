'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';

type Col = { id: string; name: string };
type Member = { user_id: string; profiles?: { full_name?: string | null; email?: string | null } | null };

// Import a Monday.com board export (.xlsx/.csv). Auto-maps Name→title,
// Status→column (created if missing), Person→assignee, Date→due date.
export function MondayImport({
  projectId,
  columns,
  members,
  onDone,
}: {
  projectId: string;
  columns: Col[];
  members: Member[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [map, setMap] = useState<{ title?: string; status?: string; date?: string; person?: string; headers: string[] }>({ headers: [] });

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let hi = raw.findIndex((r) => r.some((c) => /name|title|item|task|subject/i.test(String(c))));
      if (hi < 0) hi = 0;
      const headers = (raw[hi] || []).map((h) => String(h).trim()).filter(Boolean);
      const dataRows = raw.slice(hi + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
      const recs = dataRows.map((r) => {
        const o: Record<string, any> = {};
        headers.forEach((h, i) => { o[h] = r[i]; });
        return o;
      });
      const find = (re: RegExp) => headers.find((h) => re.test(h));
      setMap({
        headers,
        title: find(/^(name|title|item|task|subject)$/i) || find(/name|title|item|task/i) || headers[0],
        status: find(/status|stage|state/i),
        date: find(/due|date|deadline|timeline/i),
        person: find(/person|owner|assign|people/i),
      });
      setRecords(recs);
    } catch {
      toast.error('Could not read that file. In Monday: ••• → Export board to Excel, then upload the .xlsx.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const doImport = async () => {
    if (!records.length || !map.title) return;
    setImporting(true);
    try {
      const colByName = new Map(columns.map((c) => [c.name.trim().toLowerCase(), c.id]));
      let nextPos = columns.length;
      const statuses = Array.from(
        new Set(records.map((r) => (map.status ? String(r[map.status!] || '').trim() : '')).filter(Boolean))
      );
      for (const s of statuses) {
        if (!colByName.has(s.toLowerCase())) {
          const { data, error } = await supabase
            .from('columns')
            .insert({ project_id: projectId, name: s, position: nextPos++ })
            .select('id')
            .single();
          if (!error && data) colByName.set(s.toLowerCase(), (data as any).id);
        }
      }
      const fallbackColId = columns[0]?.id || Array.from(colByName.values())[0];
      if (!fallbackColId) {
        // no columns at all — make one
        const { data } = await supabase.from('columns').insert({ project_id: projectId, name: 'Imported', position: 0 }).select('id').single();
        if (data) colByName.set('imported', (data as any).id);
      }
      const defaultCol = fallbackColId || Array.from(colByName.values())[0];

      const { data: { user } } = await supabase.auth.getUser();
      const memberBy = new Map<string, string>();
      members.forEach((m) => {
        const n = (m.profiles?.full_name || '').trim().toLowerCase();
        const em = (m.profiles?.email || '').trim().toLowerCase();
        if (n) memberBy.set(n, m.user_id);
        if (em) memberBy.set(em, m.user_id);
      });
      const toDate = (v: any): string | null => {
        if (!v) return null;
        if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };

      const rows = records
        .map((r, i) => {
          const title = String(r[map.title!] || '').trim();
          if (!title) return null;
          const status = map.status ? String(r[map.status!] || '').trim() : '';
          const colId = (status && colByName.get(status.toLowerCase())) || defaultCol;
          const person = map.person ? String(r[map.person!] || '').trim().toLowerCase() : '';
          const assignee = person ? memberBy.get(person) || null : null;
          const desc = map.headers
            .filter((h) => h !== map.title && h !== map.status)
            .map((h) => (r[h] ? `${h}: ${r[h]}` : ''))
            .filter(Boolean)
            .join('\n');
          return {
            title,
            column_id: colId,
            position: i,
            priority: 'medium',
            due_date: map.date ? toDate(r[map.date!]) : null,
            assigned_to: assignee,
            description: desc || null,
            created_by: user?.id,
            updated_by: user?.id,
          };
        })
        .filter(Boolean);

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('tasks').insert(rows.slice(i, i + 200) as any);
        if (error) throw error;
      }
      toast.success(`Imported ${rows.length} tasks from Monday`);
      setRecords([]);
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="xs">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Monday</DialogTitle>
          <DialogDescription>
            In Monday: board menu (•••) → Export board to Excel. Then upload the file here.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center hover:bg-accent">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} disabled={parsing} />
            {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />}
            <span className="text-sm">{parsing ? 'Reading…' : 'Choose a Monday .xlsx / .csv export'}</span>
          </label>
          {records.length > 0 && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <div className="font-medium">{records.length} rows detected</div>
              <div className="text-xs text-muted-foreground">
                Title → <b>{map.title || '—'}</b> · Status → <b>{map.status || '(one column)'}</b> · Due →{' '}
                <b>{map.date || '—'}</b> · Assignee → <b>{map.person || '—'}</b>
              </div>
              <p className="text-xs text-muted-foreground">
                Statuses become columns; people are matched to members by name/email.
              </p>
              <Button onClick={doImport} disabled={importing} className="w-full">
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {records.length} tasks
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
