import { createBrowserClient } from '@supabase/ssr';

// Browser-side Supabase client (publishable key only — safe in the bundle).
// Used by the /login page to start the Google OAuth redirect.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
