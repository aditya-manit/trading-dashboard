import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();
const AUTH_ENABLED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  OWNER_EMAIL
);

const MFA_MAX_AGE_S = 24 * 3600; // must match proxy.ts
const deny = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

// True if the session is AAL2 with a TOTP verification in the last 24h.
function mfaFresh(token: string): boolean {
  try {
    let b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    const c = JSON.parse(atob(b)) as { aal?: string; amr?: { method: string; timestamp: number }[] };
    const totpTs = (c.amr || []).filter((m) => m.method === 'totp').reduce((a, m) => Math.max(a, m.timestamp || 0), 0);
    return c.aal === 'aal2' && totpTs > 0 && Date.now() / 1000 - totpTs < MFA_MAX_AGE_S;
  } catch {
    return false;
  }
}

// Authoritative server-side owner check for API routes — defense in depth behind
// the proxy gate. (Next's docs call proxy/middleware checks "optimistic"; the
// real check belongs next to the data.) Returns a 401 response to short-circuit,
// or null to proceed. FAIL CLOSED: deny unless it's the owner AND a fresh 2FA.
export async function requireOwner(): Promise<NextResponse | null> {
  if (process.env.DISABLE_AUTH === 'true') return null; // ⚠️ temporary dev bypass (see CLAUDE.md)
  if (!AUTH_ENABLED) return deny();
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return deny();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && mfaFresh(session.access_token)) return null;
  } catch {
    // fall through → deny
  }
  return deny();
}
