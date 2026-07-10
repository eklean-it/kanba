'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/components/user-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';

type MyTask = {
  id: string;
  title: string;
  due_date: string | null;
  is_done: boolean | null;
  status: string;
  project: string;
  slug: string;
};

export default function MyTasksPage() {
  const { user, loading } = useUser();
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('task_assignees')
      .select('task:tasks(id, title, due_date, is_done, columns(name, projects(name, slug)))')
      .eq('user_id', uid);
    const rows = (data || [])
      .map((r: any) => {
        const t = r.task;
        if (!t) return null;
        return {
          id: t.id,
          title: t.title,
          due_date: t.due_date,
          is_done: t.is_done,
          status: t.columns?.name || '—',
          project: t.columns?.projects?.name || '—',
          slug: t.columns?.projects?.slug || '',
        } as MyTask;
      })
      .filter(Boolean) as MyTask[];
    setTasks(rows);
    setReady(true);
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    load(user.id);
  }, [user, loading, load]);

  const groups = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdue: MyTask[] = [];
    const open: MyTask[] = [];
    const done: MyTask[] = [];
    tasks.forEach((t) => {
      if (t.is_done) done.push(t);
      else if (t.due_date && new Date(t.due_date) < now) overdue.push(t);
      else open.push(t);
    });
    const byDue = (a: MyTask, b: MyTask) => (a.due_date || '9999').localeCompare(b.due_date || '9999');
    return { overdue: overdue.sort(byDue), open: open.sort(byDue), done };
  }, [tasks]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Row = ({ t }: { t: MyTask }) => {
    const overdue = !t.is_done && t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
    return (
      <Link
        href={t.slug ? `/dashboard/projects/${t.slug}` : '#'}
        className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/40"
      >
        <div className="min-w-0">
          <div className={`truncate text-sm ${t.is_done ? 'text-muted-foreground line-through' : 'font-medium'}`}>{t.title}</div>
          <div className="truncate text-xs text-muted-foreground">{t.project} · {t.status}</div>
        </div>
        {t.due_date && (
          <span className={`flex flex-shrink-0 items-center gap-1 text-xs ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Calendar className="h-3 w-3" />
            {new Date(t.due_date).toLocaleDateString()}
          </span>
        )}
      </Link>
    );
  };

  const Section = ({ icon, title, items }: { icon: React.ReactNode; title: string; items: MyTask[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div className="divide-y">{items.map((t) => <Row key={t.id} t={t} />)}</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">My Tasks</h1>
        <p className="text-muted-foreground">Everything assigned to you across all boards.</p>
      </div>
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No tasks assigned to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Section icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Overdue" items={groups.overdue} />
          <Section icon={<Calendar className="h-4 w-4" />} title="Open" items={groups.open} />
          <Section icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Completed" items={groups.done} />
        </div>
      )}
    </div>
  );
}
