import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Single-user auth gate (Next 16 Proxy — the renamed middleware). Locks the whole
// app to the owner: a request passes only if there's a Supabase session AND the
// user's email matches OWNER_EMAIL. Anyone else is sent to /login.
//
// Graceful default: if Supabase env or OWNER_EMAIL is not configured, the gate is
// inert (local dev without auth keys behaves exactly as before).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL?.toLowerCase();

// Paths reachable without a (valid) session.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/signout'];

export async function proxy(request: NextRequest) {
  // Auth not configured → don't gate anything.
  if (!SUPABASE_URL || !SUPABASE_KEY || !OWNER_EMAIL) return NextResponse.next();

  let response = NextResponse.next({ request });

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

  // getUser() validates the JWT and refreshes the cookie. Guarded so a Supabase
  // or network hiccup can't 500 every route — on error, treat as no session
  // (you'll land on /login and can retry).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    user = (await supabase.auth.getUser()).data.user;
  } catch {
    user = null;
  }

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
  const authorized = !!user && user.email?.toLowerCase() === OWNER_EMAIL;

  if (!authorized && !isPublic) {
    // API calls get a clean 401; pages get bounced to /login.
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    // A signed-in-but-wrong-email user gets a distinct message on /login.
    if (user) url.searchParams.set('error', 'unauthorized');
    return NextResponse.redirect(url);
  }

  // Already authorized but sitting on /login → send home.
  if (authorized && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static image assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)'],
};
