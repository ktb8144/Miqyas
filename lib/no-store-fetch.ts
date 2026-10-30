/**
 * fetch() that never uses the Next.js Data Cache.
 *
 * Next.js 14 caches fetch() calls made inside GET route handlers by default — `export const
 * dynamic = "force-dynamic"` does not change that for route handlers. Supabase reads go through
 * fetch(), so without this the dashboards keep serving the first answer they ever got (an empty
 * teacher list, last week's results…). Every server-side Supabase client must use it.
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });
