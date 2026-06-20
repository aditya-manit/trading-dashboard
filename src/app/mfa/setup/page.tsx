'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthCard, CodeForm } from '@/components/auth/AuthCard';

// One-time TOTP enrollment: show a QR, the owner scans it, then confirms a code.
// Verifying the code elevates the session to AAL2.
export default function MfaSetupPage() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrollErr, setEnrollErr] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setEnrollErr('Sign-in isn’t configured.'); return; }
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp?.some((f) => f.status === 'verified')) { router.replace('/mfa'); return; } // already enrolled
      // clear any abandoned, unverified factors so enroll() doesn't collide
      for (const f of (data?.all ?? []).filter((f) => f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error: ee } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' });
      if (ee || !en) { setEnrollErr('Could not start setup. Reload to retry.'); return; }
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
    })();
  }, [router]);

  const verify = async () => {
    setBusy(true); setError('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setBusy(false); return; }
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce || !ch) { setError('Could not verify. Try again.'); setBusy(false); return; }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    if (ve) { setError('Invalid code — try again.'); setBusy(false); setCode(''); return; }
    router.replace('/');
  };

  return (
    <AuthCard title="Set up two-factor auth" subtitle="Scan the QR with an authenticator app (Google Authenticator, Authy, 1Password…), then enter the code it shows.">
      {enrollErr ? (
        <div style={{ background: '#fbeae6', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 11, padding: '10px 12px' }}>{enrollErr}</div>
      ) : (
        <>
          {qr ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="2FA QR code" width={170} height={170} style={{ border: '1px solid #efeee9', borderRadius: 12 }} />
              <div style={{ fontSize: 11, color: '#9b988d' }}>or enter this key manually</div>
              <code style={{ fontSize: 11.5, fontWeight: 700, color: '#56544b', wordBreak: 'break-all', background: '#f6f5f2', padding: '6px 10px', borderRadius: 8 }}>{secret}</code>
            </div>
          ) : (
            <div style={{ height: 170, display: 'grid', placeItems: 'center', color: '#9b988d', fontSize: 13, marginBottom: 16 }}>Loading…</div>
          )}
          <CodeForm code={code} setCode={setCode} onSubmit={verify} busy={busy} error={error} disabled={!factorId} label="Enable 2FA" />
        </>
      )}
    </AuthCard>
  );
}
