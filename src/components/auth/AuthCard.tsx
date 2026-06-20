import type { ReactNode } from 'react';

// Centered auth card (favicon mark + title + subtitle) shared by the /mfa pages.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#e9e8e4', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', border: '1px solid #f0efec', borderRadius: 22, boxShadow: '0 8px 40px rgba(20,18,12,0.08)', padding: '34px 30px 30px', textAlign: 'center' }}>
        <svg width="56" height="56" viewBox="0 0 512 512" style={{ display: 'block', margin: '0 auto 18px', borderRadius: 13, boxShadow: '0 6px 18px rgba(124,92,255,0.28)' }}>
          <defs><linearGradient id="authLogo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9d82ff" /><stop offset="1" stopColor="#7c5cff" /></linearGradient></defs>
          <rect width="512" height="512" rx="116" fill="url(#authLogo)" />
          <polyline points="120,330 218,250 292,300 392,176" fill="none" stroke="#ffffff" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="392" cy="176" r="22" fill="#ffffff" />
          <g fill="#ffffff" opacity="0.9"><rect x="120" y="372" width="56" height="20" rx="10" /><rect x="196" y="372" width="92" height="20" rx="10" opacity="0.55" /></g>
        </svg>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1813', letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, fontWeight: 500, color: '#8c8a81', margin: '7px 0 22px', lineHeight: 1.5 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// 6-digit TOTP entry + submit. Submits on Enter or button.
export function CodeForm({ code, setCode, onSubmit, busy, error, disabled, label }: {
  code: string;
  setCode: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error?: string;
  disabled?: boolean;
  label: string;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <div style={{ background: '#fbeae6', border: '1px solid #f3d5cc', color: '#c0432a', fontSize: 12.5, fontWeight: 600, borderRadius: 11, padding: '9px 12px' }}>{error}</div>
      )}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        autoFocus
        style={{ width: '100%', textAlign: 'center', letterSpacing: '0.4em', fontSize: 22, fontWeight: 700, fontFamily: 'inherit', color: '#1a1813', border: '1px solid #ddd9d0', borderRadius: 12, padding: '12px 14px', outline: 'none' }}
      />
      <button
        type="submit"
        disabled={busy || disabled || code.length < 6}
        style={{ width: '100%', background: '#7c5cff', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 16px', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: (busy || disabled || code.length < 6) ? 'default' : 'pointer', opacity: (busy || disabled || code.length < 6) ? 0.5 : 1, transition: 'opacity .15s' }}
      >
        {busy ? 'Verifying…' : label}
      </button>
    </form>
  );
}
