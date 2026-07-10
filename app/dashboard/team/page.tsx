'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/components/user-provider';
import { isSuperAdmin } from '@/lib/super-admins';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Copy, UserPlus, KeyRound, ShieldCheck } from 'lucide-react';

type TeamUser = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_super_admin: boolean;
};

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token || ''}` };
}

export default function TeamPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null);

  // Gate: super-admins only. Wait for auth to resolve before deciding.
  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin(user.email)) {
      router.replace('/dashboard');
      return;
    }
    setAllowed(true);
  }, [user, loading, router]);

  const loadUsers = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/users', { headers: await authHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load members');
      setUsers(json.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) loadUsers();
  }, [allowed, loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCredential(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ email, full_name: fullName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create account');
      setCredential({ email: json.user.email, password: json.password });
      setEmail('');
      setFullName('');
      toast.success('Account created');
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async (u: TeamUser) => {
    setResettingId(u.id);
    setCredential(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ user_id: u.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reset password');
      setCredential({ email: u.email, password: json.password });
      toast.success(`New password generated for ${u.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setResettingId(null);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground">
          Provision accounts for the team. Passwords are generated here and shown once —
          share them securely; the member can change theirs in Settings.
        </p>
      </div>

      {/* Newly generated credential */}
      {credential && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            Password for <span className="font-semibold">{credential.email}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-3 py-1.5 text-sm font-mono">{credential.password}</code>
            <Button size="sm" variant="outline" onClick={() => copy(credential.password)}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Won&apos;t be shown again. Send it to {credential.email}; they change it in Settings after signing in.
          </p>
        </div>
      )}

      {/* Create account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Create account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@eklean.com"
                required
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="truncate">{u.full_name || u.email}</span>
                      {u.is_super_admin && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> Super-admin
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {u.last_sign_in_at ? 'active' : 'never signed in'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReset(u)}
                      disabled={resettingId === u.id}
                    >
                      {resettingId === u.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <KeyRound className="mr-1 h-3.5 w-3.5" />
                      )}
                      Reset password
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
