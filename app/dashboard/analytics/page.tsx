'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all';
import { useUser } from '@/components/user-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, AlertTriangle, ListTodo } from 'lucide-react';

type Row = { column_id: string; due_date: string | null; is_done: boolean | null; assigned_to: string | null; priority: string | null };
type ColInfo = { name: string; project_id: string };

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className={`rounded-lg p-2 ${tone || 'bg-muted text-foreground'}`}>{icon}</div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { user, loading } = useUser();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<Record<string, ColInfo>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [projRes, colRows, taskRows] = await Promise.all([
      supabase.from('projects').select('id, name'),
      fetchAllRows((f, t) => supabase.from('columns').select('id, name, project_id').order('id').range(f, t)),
      fetchAllRows((f, t) => supabase.from('tasks').select('column_id, due_date, is_done, assigned_to, priority').order('id').range(f, t)),
    ]);
    const projRows = projRes.data;
    const projMap: Record<string, string> = {};
    (projRows || []).forEach((p: { id: string; name: string }) => (projMap[p.id] = p.name));
    const colMap: Record<string, ColInfo> = {};
    (colRows || []).forEach((c: { id: string; name: string; project_id: string }) => (colMap[c.id] = { name: c.name, project_id: c.project_id }));
    setProjects(projMap);
    setCols(colMap);
    setRows((taskRows || []) as Row[]);

    const assignedIds = Array.from(new Set((taskRows || []).map((t: Row) => t.assigned_to).filter(Boolean))) as string[];
    if (assignedIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', assignedIds);
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: { id: string; full_name: string | null; email: string }) => (pMap[p.id] = p.full_name || p.email));
      setPeople(pMap);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    load();
  }, [user, loading, load]);

  const stats = useMemo(() => {
    const now = new Date();
    let completed = 0, overdue = 0, inProgress = 0;
    const byStatus: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const t of rows) {
      const done = !!t.is_done;
      if (done) completed++;
      else if (t.due_date && new Date(t.due_date) < now) overdue++;
      else inProgress++;

      const col = cols[t.column_id];
      const statusName = col?.name || 'Uncategorized';
      byStatus[statusName] = (byStatus[statusName] || 0) + 1;

      const projName = col ? projects[col.project_id] || 'Unknown project' : 'Unknown project';
      byProject[projName] = (byProject[projName] || 0) + 1;

      const who = t.assigned_to ? people[t.assigned_to] || 'Member' : 'Unassigned';
      byAssignee[who] = (byAssignee[who] || 0) + 1;

      const pr = t.priority || 'none';
      byPriority[pr] = (byPriority[pr] || 0) + 1;
    }
    const toSorted = (o: Record<string, number>) =>
      Object.entries(o).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    return {
      total: rows.length,
      completed,
      overdue,
      inProgress,
      byStatus: toSorted(byStatus),
      byAssignee: toSorted(byAssignee).slice(0, 10),
      byProject: toSorted(byProject).slice(0, 10),
      byPriority: toSorted(byPriority),
    };
  }, [rows, cols, projects, people]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground">Across every board you can access.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<ListTodo className="h-5 w-5" />} label="Total tasks" value={stats.total} />
        <Kpi icon={<CheckCircle2 className="h-5 w-5" />} label="Completed" value={stats.completed} tone="bg-primary/15 text-primary" />
        <Kpi icon={<Clock className="h-5 w-5" />} label="In progress" value={stats.inProgress} />
        <Kpi icon={<AlertTriangle className="h-5 w-5" />} label="Overdue" value={stats.overdue} tone="bg-destructive/10 text-destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">By status</CardTitle></CardHeader>
          <CardContent><Bars data={stats.byStatus} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By priority</CardTitle></CardHeader>
          <CardContent><Bars data={stats.byPriority} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By assignee</CardTitle></CardHeader>
          <CardContent><Bars data={stats.byAssignee} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By project</CardTitle></CardHeader>
          <CardContent><Bars data={stats.byProject} /></CardContent>
        </Card>
      </div>
    </div>
  );
}
