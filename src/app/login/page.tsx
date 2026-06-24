'use client';

import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const GBTN_STYLE: CSSProperties = { width: '100%', minHeight: 56, padding: '0 22px', borderRadius: 18, background: 'rgba(255,255,255,0.66)', backdropFilter: 'blur(14px) saturate(1.4)', WebkitBackdropFilter: 'blur(14px) saturate(1.4)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 14px 30px rgba(124,92,255,.16),inset 0 1px 0 rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 15.5, color: '#1a1813' };

// Charlie Munger — a fresh one each load. Curated to genuine, well-attributed
// investing/decision lines (trimmed where the original ran long, not invented).
const QUOTES = [
  'The big money is not in the buying and selling, but in the waiting.',
  'Invert, always invert.',
  'All I want to know is where I’m going to die, so I’ll never go there.',
  'Show me the incentive and I’ll show you the outcome.',
  'We try to be consistently not stupid, instead of trying to be very intelligent.',
  'A great business at a fair price is superior to a fair business at a great price.',
  'The desire to get rich fast is pretty dangerous.',
  'Knowing what you don’t know is more useful than being brilliant.',
  'Spend each day trying to be a little wiser than you were when you woke up.',
  'Opportunity comes to the prepared mind.',
  'The wise ones bet heavily when the world offers them that opportunity.',
  'You don’t have to be brilliant, only a little wiser than the others, on average, for a long time.',
  'It’s not supposed to be easy. Anyone who finds it easy is stupid.',
  'The first rule of compounding: never interrupt it unnecessarily.',
  'A lot of success comes from knowing what you really want to avoid.',
  'It takes character to sit with all that cash and to do nothing.',
  'Mimicking the herd invites regression to the mean.',
  'If you’re not willing to react with equanimity to a 50% decline two or three times a century, you’re not fit to be a common shareholder.',
  'Live within your income and save so that you can invest.',
  'Take a simple idea and take it seriously.',
  'Those who keep learning will keep rising in life.',
  'Patience combined with opportunity is a great thing.',
];

const CURVE = 'M0,790 C180,730 340,500 520,468 C620,450 690,470 760,512 C840,560 900,592 1000,592 C1160,592 1280,500 1420,432 C1500,393 1540,372 1600,348 C1700,308 1820,250 1920,224';
type Step = 'signin' | '2fa' | 'done';

function Mark({ size }: { size: number }) {
  const r = Math.round(size * 0.227), s = Math.round(size * 0.62);
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: 'linear-gradient(150deg,#9d82ff,#7c5cff)', display: 'grid', placeItems: 'center', boxShadow: '0 14px 34px rgba(124,92,255,.32),inset 0 1px 0 rgba(255,255,255,.45)', flex: '0 0 auto' }}>
      <svg width={s} height={s} viewBox="0 0 512 512" fill="none" style={{ display: 'block' }}>
        <polyline points="120,330 218,250 292,300 392,176" fill="none" stroke="#fff" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={392} cy={176} r={26} fill="#fff" />
        <rect x={120} y={372} width={56} height={22} rx={11} fill="#fff" opacity={0.9} />
        <rect x={196} y={372} width={92} height={22} rx={11} fill="#fff" opacity={0.5} />
      </svg>
    </div>
  );
}
function GoogleG({ s }: { s: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ display: 'block', flex: '0 0 auto' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
function Spinner({ s, ring }: { s: number; ring?: boolean }) {
  return <span style={{ display: 'inline-block', width: s, height: s, borderRadius: '50%', border: `2.5px solid ${ring ? 'rgba(124,92,255,.3)' : 'rgba(255,255,255,.4)'}`, borderTopColor: ring ? '#7c5cff' : '#fff', animation: 'spLoSpin .7s linear infinite', flex: '0 0 auto' }} />;
}

function SplashInner() {
  const router = useRouter();
  const params = useSearchParams();
  const errParam = params.get('error');
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [step, setStep] = useState<Step>('signin');
  const [email, setEmail] = useState('');
  const [factorId, setFactorId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const notAuthorized = errParam === 'unauthorized';
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyRef = useRef<() => void>(() => {});
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  // Initial state from the live session: signed-in owner (AAL1) with a verified
  // factor → jump straight to the 2FA step; no factor → enrollment; already AAL2
  // → home; otherwise stay on the Google step.
  useEffect(() => {
    if (notAuthorized) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') { router.replace('/'); return; }
      const { data: f } = await supabase.auth.mfa.listFactors();
      const verified = f?.totp?.find((x) => x.status === 'verified');
      if (!verified) { router.replace('/mfa/setup'); return; }
      setFactorId(verified.id);
      setStep('2fa');
      setTimeout(() => codeRefs.current[0]?.focus(), 60);
    })();
  }, [notAuthorized, router]);

  const goGoogle = async () => {
    if (connecting) return;
    setConnecting(true);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setConnecting(false); return; }
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } },
    });
    if (e) setConnecting(false); // else the browser is already navigating to Google
  };

  const verify = async () => {
    if (verifying) return;
    if (code.some((d) => d === '')) { setError('Enter all 6 digits'); return; }
    setVerifying(true); setError('');
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setVerifying(false); return; }
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
    if (ce || !ch) { setError('Could not start verification. Try again.'); setVerifying(false); return; }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.join('') });
    if (ve) { setError('Invalid code — try again.'); setCode(['', '', '', '', '', '']); setVerifying(false); setTimeout(() => codeRefs.current[0]?.focus(), 40); return; }
    setVerifying(false); setStep('done');
    setTimeout(() => router.replace('/'), 1100);
  };
  verifyRef.current = verify;

  const setDigit = (i: number, val: string) => {
    const d = (val || '').replace(/\D/g, '');
    setError('');
    if (d.length > 1) {
      const next = ['', '', '', '', '', ''];
      for (let k = 0; k < 6; k++) next[k] = d[k] || '';
      setCode(next);
      const last = Math.min(d.length, 5); requestAnimationFrame(() => codeRefs.current[last]?.focus());
      if (next.every((x) => x !== '')) setTimeout(() => verifyRef.current(), 170);
      return;
    }
    const next = code.slice(); next[i] = d; setCode(next);
    if (d && i < 5) requestAnimationFrame(() => codeRefs.current[i + 1]?.focus());
    if (next.every((x) => x !== '')) setTimeout(() => verifyRef.current(), 170);
  };
  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) codeRefs.current[i - 1]?.focus();
    if (e.key === 'Enter') verify();
  };

  // ---- roadmap pieces ----
  const s1: 'active' | 'done' = step === 'signin' ? 'active' : 'done';
  const s2: 'active' | 'done' | 'todo' = step === '2fa' ? 'active' : step === 'done' ? 'done' : 'todo';

  const dot = (status: string, kind?: number) => {
    if (status === 'done') return <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c5cff', display: 'grid', placeItems: 'center', flex: '0 0 auto', boxShadow: '0 2px 7px rgba(124,92,255,.32)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
    if (status === 'active') return <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c5cff', flex: '0 0 auto', boxShadow: '0 0 0 5px rgba(124,92,255,.16)', display: 'grid', placeItems: 'center' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /></span>;
    return <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,.7)', border: `2px solid ${kind === 2 ? '#c9bff0' : '#ddd8ea'}`, flex: '0 0 auto' }} />;
  };
  const row = (key: string, status: string, kind: number, filled: boolean, isLast: boolean, content: React.ReactNode) => (
    <div key={key} style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 26px' }}>
        {dot(status, kind)}
        {!isLast && <div style={{ flex: 1, width: 3, minHeight: 22, marginTop: 6, borderRadius: 3, background: filled ? 'linear-gradient(180deg,#7c5cff,#b9a6ff)' : '#e2ded3' }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>{content}</div>
    </div>
  );

  const c1 = s1 === 'active' ? (
    <>
      {notAuthorized && (
        <div style={{ background: 'rgba(251,234,230,.85)', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 12, padding: '10px 12px', marginBottom: 12, lineHeight: 1.45 }}>
          That Google account isn’t authorized for this dashboard.
        </div>
      )}
      {errParam === 'auth' && (
        <div style={{ background: 'rgba(251,234,230,.85)', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          Sign-in didn’t complete. Please try again.
        </div>
      )}
      {!configured && (
        <div style={{ background: 'rgba(255,247,230,.85)', border: '1px solid #f3e3bf', color: '#8a6400', fontSize: 12.5, fontWeight: 600, borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
          Sign-in isn’t configured.
        </div>
      )}
      {notAuthorized ? (
        <form action="/auth/signout" method="post">
          <button type="submit" className="spLoGbtn" style={GBTN_STYLE}>
            <GoogleG s={20} /><span>Use a different account</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}><path d="M5 12h14M13 6l6 6-6 6" stroke="#c2bcae" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      ) : (
        <button className="spLoGbtn" onClick={goGoogle} disabled={connecting || !configured}
          style={{ ...GBTN_STYLE, cursor: connecting || !configured ? 'default' : 'pointer', opacity: !configured ? 0.6 : 1 }}>
          {connecting ? <><Spinner s={18} ring /><span style={{ color: '#7a766d' }}>Connecting…</span></>
            : <><GoogleG s={20} /><span>Continue with Google</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}><path d="M5 12h14M13 6l6 6-6 6" stroke="#c2bcae" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg></>}
        </button>
      )}
    </>
  ) : (
    <div style={{ minHeight: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1a1813' }}>Signed in with Google</div>
      <div style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d', marginTop: 2 }}>{email || 'your account'}</div>
    </div>
  );

  let c2: React.ReactNode;
  if (s2 === 'todo') {
    c2 = (
      <div style={{ minHeight: 56, padding: '0 22px', borderRadius: 18, background: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 11, fontWeight: 600, fontSize: 14.5, color: '#9a958c' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.4" fill="none" stroke="#b1a8d0" strokeWidth={2} /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#b1a8d0" strokeWidth={2} fill="none" /></svg>
        <span>Authenticator code</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#bdb9ad' }}>Next</span>
      </div>
    );
  } else if (s2 === 'active') {
    c2 = (
      <div style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.65)', borderRadius: 18, padding: '20px 20px 22px', boxShadow: '0 16px 34px rgba(124,92,255,.18),inset 0 1px 0 rgba(255,255,255,.6)', animation: 'spLoCardIn .4s ease both' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1813' }}>Two-factor authentication</div>
        <div style={{ fontWeight: 500, fontSize: 13, color: '#7a766d', marginTop: 4 }}>Enter the 6-digit code from your authenticator app.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input key={i} ref={(el) => { codeRefs.current[i] = el; }} className="spLoOtp" value={code[i]} inputMode="numeric" maxLength={6} aria-label={`Digit ${i + 1}`}
              onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
              style={{ width: 42, height: 52, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 21, color: '#1a1813', border: `1.5px solid ${error ? '#e3a59a' : '#e6e3db'}`, borderRadius: 11, outline: 'none', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', transition: 'border-color .15s,box-shadow .15s' }} />
          ))}
        </div>
        {error && <div style={{ marginTop: 9, fontWeight: 600, fontSize: 12, color: '#df5338' }}>{error}</div>}
        <button className="spLoVbtn" onClick={verify} disabled={verifying} style={{ marginTop: 16, width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(150deg,rgba(157,130,255,.92),rgba(124,92,255,.94))', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 13, cursor: verifying ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, color: '#fff', boxShadow: '0 8px 20px rgba(124,92,255,.28),inset 0 1px 0 rgba(255,255,255,.35)' }}>
          {verifying ? <><Spinner s={18} /><span>Verifying…</span></> : <span>Verify</span>}
        </button>
        <form action="/auth/signout" method="post" style={{ marginTop: 13 }}>
          <button type="submit" className="spLoLnk" style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, color: '#9b988d', cursor: 'pointer' }}>← Use a different account</button>
        </form>
      </div>
    );
  } else {
    c2 = (
      <div style={{ minHeight: 50, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#1a1813' }}>Two-factor verified</div>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d', marginTop: 2 }}>Authenticator confirmed</div>
      </div>
    );
  }

  const c3 = step !== 'done' ? (
    <div style={{ minHeight: 56, padding: '0 22px', borderRadius: 18, background: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 11, fontWeight: 600, fontSize: 14.5, color: '#9a958c' }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#bdb9ad" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>Your dashboard</span>
    </div>
  ) : (
    <div style={{ minHeight: 56, padding: '0 22px', borderRadius: 18, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(14px) saturate(1.3)', WebkitBackdropFilter: 'blur(14px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.65)', boxShadow: '0 14px 30px rgba(31,157,85,.16),inset 0 1px 0 rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', gap: 12, animation: 'spLoCardIn .4s ease both' }}>
      <span style={{ width: 27, height: 27, borderRadius: '50%', background: '#eafaf1', display: 'grid', placeItems: 'center', flex: '0 0 auto', animation: 'spLoPop .5s cubic-bezier(.2,.9,.3,1.2) both' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" stroke="#1f9d55" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1813' }}>You’re in</span>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#8a8579', marginTop: 1 }}>Loading your dashboard…</span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', height: '100vh', overflow: 'hidden', background: 'linear-gradient(118deg,#ffffff 0%,#faf7ff 52%,#f1ebff 100%)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style>{SP_CSS}</style>
      {/* drifting aurora */}
      <div style={{ position: 'absolute', bottom: '-20vh', left: '18vw', width: '46vw', height: '46vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(157,130,255,.18),rgba(157,130,255,0) 62%)', filter: 'blur(32px)', animation: 'spLoBlob 19s ease-in-out infinite' }} />
      {/* grid + filled area under the curve */}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="spArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c5cff" stopOpacity={0.15} /><stop offset="100%" stopColor="#7c5cff" stopOpacity={0} /></linearGradient>
          <pattern id="spGrid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80,0 L0,0 L0,80" fill="none" stroke="rgba(20,20,12,.045)" strokeWidth={1} /></pattern>
        </defs>
        <rect x="0" y="0" width="1920" height="1080" fill="url(#spGrid)" />
        <path d={`${CURVE} L1920,1080 L0,1080 Z`} fill="url(#spArea)" style={{ animation: 'spLoArea 1.4s ease 1.4s both' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(125% 95% at 100% 100%,#fbfbf9 0%,rgba(251,251,249,.72) 28%,rgba(251,251,249,0) 56%)', pointerEvents: 'none' }} />
      {/* the self-drawing curve + live dot */}
      <svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <path d={CURVE} pathLength={100} fill="none" stroke="#7c5cff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" style={{ animation: 'spLoDraw 2.6s cubic-bezier(.4,.05,.35,1) .4s both', filter: 'drop-shadow(0 0 10px rgba(124,92,255,.35))' }} />
        <circle cx={1600} cy={348} r={9} fill="#7c5cff" stroke="#fbfbf9" strokeWidth={3} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'spLoFade .6s ease 2.6s both, spLoPulse 2.4s ease-in-out 3.1s infinite', filter: 'drop-shadow(0 0 10px rgba(124,92,255,.5))' }} />
      </svg>

      {/* top-right brand */}
      <div style={{ position: 'absolute', top: 'clamp(28px,4.4vh,48px)', right: 'clamp(28px,3.4vw,52px)', display: 'flex', alignItems: 'center', gap: 14, animation: 'spLoReveal .85s cubic-bezier(.2,.8,.2,1) both' }}>
        <Mark size={50} />
        <span style={{ fontWeight: 700, fontSize: 'clamp(11px,.95vw,13px)', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7c5cff' }}>Plan · Execute · Review</span>
      </div>

      {/* bottom-right rotating quote */}
      <div className="spLoQuote" style={{ position: 'absolute', right: 'clamp(30px,3.6vw,60px)', bottom: 'clamp(36px,6.5vh,76px)', maxWidth: 'min(680px,56%)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: 'clamp(13px,2vh,22px)' }}>
        <div style={{ fontFamily: "'Newsreader',serif", fontWeight: 500, fontSize: 'clamp(23px,2.3vw,44px)', lineHeight: 1.16, letterSpacing: '-0.022em', color: '#161318', animation: 'spLoReveal .95s cubic-bezier(.2,.8,.2,1) .12s both' }}>
          <span style={{ fontSize: '2em', fontWeight: 600, lineHeight: 0, color: 'rgba(124,92,255,.34)', verticalAlign: '-0.02em', marginRight: '.02em' }}>{'“'}</span>{quote}{'”'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, animation: 'spLoReveal .95s ease .26s both' }}>
          <span style={{ width: 34, height: 1.5, background: 'rgba(20,20,12,.32)' }} />
          <span style={{ fontWeight: 700, fontSize: 'clamp(12px,1vw,15px)', letterSpacing: '0.04em', color: '#1a1813' }}>Charlie Munger</span>
        </div>
      </div>

      {/* left — the auth roadmap */}
      <div className="spLoAuth" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0 clamp(28px,5vw,110px)', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', width: 'min(430px,100%)', animation: 'spLoCardIn .55s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontWeight: 800, fontSize: 25, letterSpacing: '-0.02em', color: '#1a1813' }}>Welcome back <span style={{ display: 'inline-block', transformOrigin: '70% 70%', animation: 'spLoWave 2.4s ease-in-out infinite' }}>{'👋'}</span></div>
            <div style={{ fontWeight: 500, fontSize: 14, color: '#7a766d', marginTop: 6 }}>Two quick steps to your workspace.</div>
          </div>
          {row('r1', s1, 1, step !== 'signin', false, c1)}
          {row('r2', s2, 2, step === 'done', false, c2)}
          {row('r3', step === 'done' ? 'done' : 'todo', 3, false, true, c3)}
        </div>
      </div>
    </div>
  );
}

const SP_CSS = `
@keyframes spLoReveal{0%{opacity:0;transform:translateY(18px);}100%{opacity:1;transform:translateY(0);}}
@keyframes spLoDraw{0%{stroke-dashoffset:100;opacity:0;}12%{opacity:1;}100%{stroke-dashoffset:0;opacity:1;}}
@keyframes spLoArea{0%{opacity:0;}100%{opacity:1;}}
@keyframes spLoPulse{0%,100%{transform:scale(1);opacity:.95;}50%{transform:scale(1.3);opacity:.55;}}
@keyframes spLoFade{0%{opacity:0;}100%{opacity:1;}}
@keyframes spLoCardIn{0%{opacity:0;transform:translateY(14px);}100%{opacity:1;transform:translateY(0);}}
@keyframes spLoBlob{0%{transform:translate(20px,12px) scale(1.1);}50%{transform:translate(-22px,-16px) scale(.92);}100%{transform:translate(20px,12px) scale(1.1);}}
@keyframes spLoSpin{to{transform:rotate(360deg);}}
@keyframes spLoPop{0%{transform:scale(0);}60%{transform:scale(1.12);}100%{transform:scale(1);}}
@keyframes spLoWave{0%,62%,100%{transform:rotate(0deg);}10%{transform:rotate(15deg);}20%{transform:rotate(-9deg);}30%{transform:rotate(15deg);}40%{transform:rotate(-5deg);}50%{transform:rotate(11deg);}}
.spLoGbtn{transition:background .25s ease,border-color .25s ease,box-shadow .25s ease;}
.spLoGbtn:hover:not(:disabled){background:rgba(255,255,255,0.86) !important;border-color:rgba(255,255,255,0.92) !important;box-shadow:0 16px 34px rgba(124,92,255,.2),inset 0 1px 0 rgba(255,255,255,.7) !important;}
.spLoVbtn{transition:filter .25s ease;}
.spLoVbtn:hover:not(:disabled){filter:brightness(1.06);}
.spLoOtp:focus{border-color:#7c5cff !important;box-shadow:0 0 0 3px rgba(124,92,255,.16) !important;}
.spLoLnk:hover{color:#7c5cff !important;}
@media (max-width:880px){.spLoAuth{justify-content:center !important;padding:24px !important;}.spLoQuote{opacity:0 !important;}}
`;

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'linear-gradient(118deg,#ffffff,#f1ebff)' }} />}>
      <SplashInner />
    </Suspense>
  );
}
