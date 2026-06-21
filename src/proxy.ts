import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';

// Single-user auth gate (Next 16 Proxy — the renamed middleware). FAIL CLOSED:
// the app is served only to the owner (Google session whose email === OWNER_EMAIL)
// who has ALSO passed a TOTP 2FA check within the last 24h (AAL2 + fresh). Missing
// env, wrong email, or stale/absent MFA → /login or /mfa (pages) / 401 (api).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();
// ⚠️ TEMPORARY DEV BYPASS — opens the app (no OAuth/MFA) when DISABLE_AUTH=true.
// Added only to screenshot/verify the Plan funnel build. MUST be removed to
// restore the permanent fail-closed lock — see CLAUDE.md "Temporary auth bypass".
const AUTH_DISABLED = process.env.DISABLE_AUTH === 'true';

// /api/keepalive is hit by the Vercel cron (no user session) — it guards itself
// with CRON_SECRET, so it's safe to let past the owner gate.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/signout', '/api/keepalive'];
const MFA_MAX_AGE_S = 24 * 3600; // re-prompt for the 2FA code every 24h

// Decode a JWT payload (no verification — getUser() already validated it).
function decodeJwt(token: string): { aal?: string; amr?: { method: string; timestamp: number }[] } {
  try {
    let b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    return JSON.parse(atob(b));
  } catch {
    return {};
  }
}

export async function proxy(request: NextRequest) {
  if (AUTH_DISABLED) return NextResponse.next(); // ⚠️ temporary dev bypass
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  const isMfa = path === '/mfa' || path.startsWith('/mfa/');

  let response = NextResponse.next({ request });
  let user: User | null = null;
  let mfaOk = false;

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      user = (await supabase.auth.getUser()).data.user;
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const c = decodeJwt(session.access_token);
          const totpTs = (c.amr || [])
            .filter((m) => m.method === 'totp')
            .reduce((a, m) => Math.max(a, m.timestamp || 0), 0);
          mfaOk = c.aal === 'aal2' && totpTs > 0 && Date.now() / 1000 - totpTs < MFA_MAX_AGE_S;
        }
      }
    } catch {
      user = null;
    }
  }

  const authorized = !!OWNER_EMAIL && !!user && user.email?.toLowerCase() === OWNER_EMAIL;
  const go = (p: string, err?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = p;
    url.search = '';
    if (err) url.searchParams.set('error', err);
    return NextResponse.redirect(url);
  };

  // 1) Not the owner → login (or 401 for API).
  if (!authorized) {
    if (isPublic) return response;
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return go('/login', user ? 'unauthorized' : undefined);
  }

  // Owner from here.
  // 2) Owner without a fresh 2FA → must complete it (allow the /mfa pages + auth routes).
  if (!mfaOk && !isMfa && !isPublic) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'mfa_required' }, { status: 401 });
    return go('/mfa');
  }

  // 3) Fully authed but sitting on /login or an /mfa page → home.
  if (mfaOk && (path === '/login' || isMfa)) return go('/');

  return response;
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)'],
};
