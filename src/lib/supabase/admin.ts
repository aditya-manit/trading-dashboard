import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// supabase-js eagerly constructs a Realtime client, which needs a global
// WebSocket. Node ≥22 (Vercel) has it natively; Node 20 (local dev) doesn't, so
// feature-detect and polyfill from `ws`. We never use realtime — this only
// satisfies the constructor.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (globalThis as { WebSocket?: unknown }).WebSocket = require('ws');
  } catch { /* ws not present — realtime unused, ignore */ }
}

// Server-only Supabase client using the SECRET (service_role) key. Bypasses RLS,
// so it must NEVER be imported into a client component. All DB/Storage access in
// /api/* routes goes through this. The owner+MFA gate (requireOwner / proxy) sits
// in front of those routes — this key is the engine, the auth is the lock.
//
// Returns null when the env isn't configured, so callers fall back to the local
// file / localStorage path (keeps local dev with no Supabase env working).

let cached: SupabaseClient | null | undefined;

export function supabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    cached = null;
    return cached;
  }
  cached = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

// Convenience flag for routes/libs that branch on "is Supabase configured".
export const hasSupabase = (): boolean => supabaseAdmin() !== null;

export const CHARTS_BUCKET = 'charts';
