import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Browser-side Supabase client (publishable key only — safe in the bundle).
// Returns null when the env isn't configured (e.g. a deploy built without the
// NEXT_PUBLIC_* vars) so callers degrade gracefully instead of crashing.
export function createSupabaseBrowserClient() {
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
