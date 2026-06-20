import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();
const AUTH_ENABLED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  OWNER_EMAIL
);

// Authoritative server-side owner check for API routes — defense in depth behind
// the proxy gate. (Next's docs call proxy/middleware checks "optimistic"; the
// real check belongs next to the data.) Returns a 401 response to short-circuit,
// or null to proceed. If auth isn't configured (keyless local clone), open.
export async function requireOwner(): Promise<NextResponse | null> {
  if (!AUTH_ENABLED) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email?.toLowerCase() === OWNER_EMAIL) return null;
  } catch {
    // fall through → 401
  }
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
