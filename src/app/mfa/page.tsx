'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { AuthCard, CodeForm } from '@/components/auth/AuthCard';

// Step-up 2FA on login (and the 24h re-prompt). The owner is already signed in
// (Google); they enter the TOTP code to elevate the session to AAL2.
export default function MfaPage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === 'verified');
      if (!verified) { router.replace('/mfa/setup'); return; } // not enrolled yet
      setFactorId(verified.id);
      setReady(true);
    })();
  }, [router]);

  const verify = async () => {
    setBusy(true); setError('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setBusy(false); return; }
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce || !ch) { setError('Could not start verification. Try again.'); setBusy(false); return; }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
    if (ve) { setError('Invalid code — try again.'); setBusy(false); setCode(''); return; }
    router.replace('/');
  };

  return (
    <AuthCard title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app.">
      <CodeForm code={code} setCode={setCode} onSubmit={verify} busy={busy} error={error} disabled={!ready} label="Verify" />
    </AuthCard>
  );
}
