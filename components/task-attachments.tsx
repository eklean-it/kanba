'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Paperclip, X, File as FileIcon } from 'lucide-react';

const BUCKET = 'task-attachments';

type Attachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export function TaskAttachments({ taskId, projectId }: { taskId: string; projectId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load attachments');
      setLoading(false);
      return;
    }
    const rows = (data || []) as Attachment[];
    setItems(rows);
    const map: Record<string, string> = {};
    await Promise.all(
      rows.map(async (a) => {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(a.storage_path, 3600);
        if (signed?.signedUrl) map[a.id] = signed.signedUrl;
      })
    );
    setUrls(map);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const safe = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${projectId}/${taskId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('task_attachments').insert({
        task_id: taskId,
        project_id: projectId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      toast.success('Attachment uploaded');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const onDelete = async (a: Attachment) => {
    try {
      await supabase.storage.from(BUCKET).remove([a.storage_path]);
      const { error } = await supabase.from('task_attachments').delete().eq('id', a.id);
      if (error) throw error;
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      toast.success('Attachment removed');
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-4 w-4" /> Attachments
        </span>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
            {uploading ? 'Uploading…' : 'Add file'}
          </span>
        </label>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No attachments yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((a) => {
            const isImg = (a.mime_type || '').startsWith('image/');
            const url = urls[a.id];
            return (
              <div key={a.id} className="group relative overflow-hidden rounded-md border">
                {isImg && url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={a.file_name} className="h-24 w-full object-cover" />
                  </a>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-24 flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground"
                  >
                    <FileIcon className="h-5 w-5" />
                    <span className="line-clamp-2 break-all">{a.file_name}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(a)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
