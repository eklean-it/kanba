'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/components/user-provider';
import { isSuperAdmin } from '@/lib/super-admins';
import type { BoardSummary } from '@/lib/board-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, UserPlus, ExternalLink, LayoutGrid } from 'lucide-react';

// Erykah, 2026-08-18: "Am I able to see all the teams dashboards?" She was told
// yes; she could not. The dashboard reads projects through the anon key and
// `projects_select_accessible` grants a row only to the owner or a listed
// member, so a super-admin saw nothing extra. This page is the honest answer.
//
// Read-only by design. Listing a board is NOT the same as opening it — opening
// still goes through RLS — so rows the viewer isn't on show Join instead of a
// link that would load an empty board.

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token || ''}` };
}

export default function AllBoardsPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [access, setAccess] = useState<'resolving' | 'allowed' | 'denied'>('resolving');
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    setAccess(isSuperAdmin(user.email) ? 'allowed' : 'denied');
  }, [user, loading, router]);

  const loadBoards = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/boards', { headers: await authHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load boards');
      setBoards(json.boards);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load boards');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (access === 'allowed') loadBoards();
  }, [access, loadBoards]);

  const join = async (board: BoardSummary) => {
    setJoiningId(board.id);
    try {
      const res = await fetch('/api/admin/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ project_id: board.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to join board');
      toast.success(`You can now open ${board.name}`);
      loadBoards();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join board');
    } finally {
      setJoiningId(null);
    }
  };

  if (access === 'denied') {
    return (
      <div className="mx-auto max-w-lg p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              All boards is admin-only
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              This page lists every board in the workspace, so it&apos;s restricted
              to EKGO admins. Nothing is broken — your account just isn&apos;t on
              the list.
            </p>
            <p>
              You&apos;re signed in as{' '}
              <span className="font-medium text-foreground">{user?.email}</span>.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (access !== 'allowed') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">All boards</h1>
        <p className="text-muted-foreground">
          Every board in the workspace, whoever owns it. Read-only — you can see
          who is on a board and how much is open on it without joining. To open
          and work in one, join it first.
        </p>
      </div>

      {listLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : boards.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No boards exist yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <Card key={board.id}>
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LayoutGrid className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{board.name}</span>
                    {board.viewerHasAccess ? (
                      <Badge variant="secondary">You&apos;re on this</Badge>
                    ) : (
                      <Badge variant="outline">Not a member</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Owner{' '}
                    <span className="text-foreground">
                      {board.owner.name || board.owner.email || 'unknown'}
                    </span>
                    {' · '}
                    {board.memberCount} other member
                    {board.memberCount === 1 ? '' : 's'}
                    {' · '}
                    {board.openTasks} open
                    {board.doneTasks > 0 ? ` · ${board.doneTasks} done` : ''}
                    {board.archivedTasks > 0 ? ` · ${board.archivedTasks} archived` : ''}
                  </p>
                  {board.members.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {board.members
                        .map((m) => m.name || m.email || 'unknown')
                        .join(', ')}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {board.viewerHasAccess ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/projects/${board.id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => join(board)}
                      disabled={joiningId === board.id}
                    >
                      {joiningId === board.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      Join to open
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
