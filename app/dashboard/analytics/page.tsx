'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAllRows } from '@/lib/fetch-all';
import { useUser } from '@/components/user-provider';
import { isSuperAdmin } from '@/lib/super-admins';
import { computeAnalytics } from '@/lib/analytics-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Clock, AlertTriangle, ListTodo, Globe2, User as UserIcon } from 'lucide-react';

type Row = { column_id: string; due_date: string | null; is_done: boolean | null; assigned_to: string | null; priority: string | null; archived?: boolean | null };
type ColInfo = { name: string; project_id: string };
type Scope = 'mine' | 'workspace';

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
  // Erykah, 2026-08-18, asked for visibility into everything. Analytics read
  // through the anon key, so RLS scoped it to boards she owns or is a member of
  // — a super-admin's "analytics" silently excluded most of the company.
  // Super-admins now default to the whole workspace and can narrow back to their
  // own boards; everyone else only ever sees their own, unchanged.
  const canSeeWorkspace = isSuperAdmin(user?.email);
  const [scope, setScope] = useState<Scope>('mine');
  const [rows, setRows] = useState<Row[]>([]);
  const [cols, setCols] = useState<Record<string, ColInfo>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, string>>({});

  const load = useCallback(
    async (which: Scope) => {
      setReady(false);

      if (which === 'workspace') {
        // Service-role route — RLS cannot show a super-admin boards they aren't
        // a member of, so the whole-workspace read has to come from the server.
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${session.session?.access_token || ''}` },
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || 'Failed to load workspace analytics');
          setReady(true);
          return;
        }
        const projMap: Record<string, string> = {};
        (json.projects || []).forEach((p: { id: string; name: string }) => {
          projMap[p.id] = p.name;
        });
        const colMap: Record<string, ColInfo> = {};
        (json.columns || []).forEach((c: { id: string; name: string; project_id: string }) => {
          colMap[c.id] = { name: c.name, project_id: c.project_id };
        });
        const pMap: Record<string, string> = {};
        (json.people || []).forEach((p: { id: string; name: string }) => {
          pMap[p.id] = p.name;
        });
        setProjects(projMap);
        setCols(colMap);
        setPeople(pMap);
        setRows((json.tasks || []) as Row[]);
        setReady(true);
        return;
      }

      const [projRes, colRows, taskRows] = await Promise.all([
        supabase.from('projects').select('id, name'),
        fetchAllRows((f, t) => supabase.from('columns').select('id, name, project_id').order('id').range(f, t)),
        fetchAllRows((f, t) => supabase.from('tasks').select('column_id, due_date, is_done, assigned_to, priority, archived').order('id').range(f, t)),
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
    },
    [],
  );

  useEffect(() => {
    if (loading || !user) return;
    const initial: Scope = isSuperAdmin(user.email) ? 'workspace' : 'mine';
    setScope(initial);
    load(initial);
  }, [user, loading, load]);

  const stats = useMemo(
    () => computeAnalytics({ tasks: rows, columns: cols, projects, people }),
    [rows, cols, projects, people],
  );

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground">
            {scope === 'workspace'
              ? 'Every board in the workspace, whoever owns it.'
              : 'Across every board you can access.'}
          </p>
        </div>
        {canSeeWorkspace && (
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              size="sm"
              variant={scope === 'workspace' ? 'secondary' : 'ghost'}
              onClick={() => {
                setScope('workspace');
                load('workspace');
              }}
            >
              <Globe2 className="mr-1.5 h-3.5 w-3.5" />
              All boards
            </Button>
            <Button
              size="sm"
              variant={scope === 'mine' ? 'secondary' : 'ghost'}
              onClick={() => {
                setScope('mine');
                load('mine');
              }}
            >
              <UserIcon className="mr-1.5 h-3.5 w-3.5" />
              My boards
            </Button>
          </div>
        )}
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
