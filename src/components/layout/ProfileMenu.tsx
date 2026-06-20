'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Profile = { email: string; name: string; avatar: string | null; initials: string };

// Topbar account chip: the signed-in user's Google avatar (initials fallback),
// click → dropdown with name/email + Sign out.
export function ProfileMenu() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return; // auth not configured — keep the static fallback
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const m = (u.user_metadata || {}) as Record<string, string>;
      const name = m.full_name || m.name || u.email?.split('@')[0] || 'Account';
      const initials = name.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
      setProfile({ email: u.email || '', name, avatar: m.avatar_url || m.picture || null, initials });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const initials = profile?.initials || 'AV';
  const showImg = profile?.avatar && !imgError;

  const avatarInner = showImg
    ? <img src={profile!.avatar!} alt="" referrerPolicy="no-referrer" onError={() => setImgError(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    : initials;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e3e0d9', padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'linear-gradient(150deg,#d7d4cc,#bcb9af)', display: 'grid', placeItems: 'center', color: '#46443c', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}
      >
        {avatarInner}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 9px)', width: 224, background: '#fff', border: '1px solid #ecebe6', borderRadius: 14, boxShadow: '0 12px 44px rgba(20,18,12,0.16)', overflow: 'hidden', zIndex: 120 }}>
          <div style={{ padding: '13px 15px', borderBottom: '1px solid #f3f2ee', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flex: '0 0 auto', background: 'linear-gradient(150deg,#d7d4cc,#bcb9af)', display: 'grid', placeItems: 'center', color: '#46443c', fontWeight: 700, fontSize: 12 }}>{avatarInner}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.name || 'Account'}</div>
              <div style={{ fontWeight: 500, fontSize: 11, color: '#9b988d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.email || ''}</div>
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 15px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12.5, color: '#c0432a' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c0432a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
