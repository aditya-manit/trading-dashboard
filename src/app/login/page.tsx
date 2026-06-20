'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function LoginInner() {
  const params = useSearchParams();
  const error = params.get('error');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setBusy(false); // otherwise the browser is already navigating away
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#e9e8e4', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', border: '1px solid #f0efec', borderRadius: 22, boxShadow: '0 8px 40px rgba(20,18,12,0.08)', padding: '34px 30px 30px', textAlign: 'center' }}>
        {/* Same mark as the app favicon (src/app/icon.svg) */}
        <svg width="56" height="56" viewBox="0 0 512 512" style={{ display: 'block', margin: '0 auto 18px', borderRadius: 13, boxShadow: '0 6px 18px rgba(124,92,255,0.28)' }}>
          <defs>
            <linearGradient id="loginLogo" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#9d82ff" />
              <stop offset="1" stopColor="#7c5cff" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="116" fill="url(#loginLogo)" />
          <polyline points="120,330 218,250 292,300 392,176" fill="none" stroke="#ffffff" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="392" cy="176" r="22" fill="#ffffff" />
          <g fill="#ffffff" opacity="0.9">
            <rect x="120" y="372" width="56" height="20" rx="10" />
            <rect x="196" y="372" width="92" height="20" rx="10" opacity="0.55" />
          </g>
        </svg>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1813', letterSpacing: '-0.02em', margin: 0 }}>Trading Dashboard</h1>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: '#8c8a81', margin: '7px 0 24px', lineHeight: 1.5 }}>Sign in to continue. Access is restricted to the owner.</p>

        {error === 'unauthorized' && (
          <div style={{ background: '#fbeae6', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 11, padding: '10px 12px', marginBottom: 16, lineHeight: 1.45 }}>
            That Google account isn’t authorized for this dashboard.
            <form action="/auth/signout" method="post" style={{ marginTop: 8 }}>
              <button type="submit" style={{ background: 'transparent', border: 'none', color: '#c0432a', fontWeight: 800, fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Use a different account</button>
            </form>
          </div>
        )}
        {error === 'auth' && (
          <div style={{ background: '#fbeae6', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 11, padding: '10px 12px', marginBottom: 16 }}>
            Sign-in didn’t complete. Please try again.
          </div>
        )}

        <button
          onClick={signIn}
          disabled={busy}
          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 11, background: '#fff', border: '1px solid #ddd9d0', borderRadius: 12, padding: '12px 16px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, color: '#1a1813', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'background .15s' }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
          {busy ? 'Redirecting…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
