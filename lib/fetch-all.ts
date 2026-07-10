// Page through a Supabase/PostgREST query in fixed-size chunks so we always get
// the FULL result set — PostgREST enforces a hard max-rows cap (1000 on this
// project), so a single query silently truncates beyond it. `build` receives the
// range bounds and must apply `.range(from, to)` and a stable `.order(...)`.
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  // Safety cap: 100 pages (100k rows) so a bug can never loop forever.
  for (let page = 0; page < 100; page++) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
