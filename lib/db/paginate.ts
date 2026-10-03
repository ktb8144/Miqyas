import "server-only";

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request.

// Supabase infers joined rows loosely without generated types, so pages are typed as unknown
// and cast to the caller's row type.
type PageResult = PromiseLike<{ data: unknown[] | null; error: unknown }>;

/**
 * Reads every row of a query, page by page, so results are never silently cut at 1000.
 * `page(from, to)` must build the query with a stable `.order(...)` and `.range(from, to)`.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Splits a list into chunks (used to keep `.in(...)` filters short). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
