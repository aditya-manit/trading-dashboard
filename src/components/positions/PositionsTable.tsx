'use client';

import { useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useAccount } from '@/hooks/useAccount';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPosition } from '@/types/gate';

const FONT = "'Plus Jakarta Sans', sans-serif";
const BTC_CONTRACT_SIZE = 0.0001;

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtPrice(s: string) {
  const n = parseFloat(s);
  if (!n) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtLev(lev: string) {
  const n = parseFloat(lev);
  return n && n > 0 ? `${n}x` : 'Cross';
}
function holdSince(openTime: number): string {
  const secs = Math.floor(Date.now() / 1000) - openTime;
  if (secs <= 0) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Icon Chip ────────────────────────────────────────────────────────────────

function Chip({ icon, red = false }: { icon: React.ReactNode; red?: boolean }) {
  return (
    <span style={{
      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
      background: red ? '#fbeae6' : '#f6f5f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: red ? '#df5338' : '#a8a08e',
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

const ICONS = {
  direction:  <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  leverage:   <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  layers:     <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  dollar:     <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  shield:     <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  login:      <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>,
  crosshair:  <><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>,
  alert:      <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  clock:      <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
};

// ─── Position Detail Drawer ───────────────────────────────────────────────────

function PositionDetailDrawer({ p, totalValue, onClose }: { p: GateFuturesPosition; totalValue: number; onClose: () => void }) {
  const isLong = p.size > 0;
  const pnl = parseFloat(p.unrealised_pnl);
  const isUp = pnl >= 0;
  const margin = parseFloat(p.margin) || 1;
  const roe = (pnl / margin) * 100;
  const allocPct = Math.min(100, (margin / totalValue) * 100);
  const btcSize = Math.abs(p.size) * BTC_CONTRACT_SIZE;
  const notional = parseFloat(p.value) || 0;

  const detailRows: { icon: React.ReactNode; red?: boolean; label: string; value: string; color: string }[] = [
    { icon: ICONS.direction,  label: 'Direction',         value: isLong ? 'Long' : 'Short',               color: isLong ? '#1f9d55' : '#df5338' },
    { icon: ICONS.leverage,   label: 'Leverage',          value: fmtLev(p.leverage),                      color: '#1a1813' },
    { icon: ICONS.layers,     label: 'Position size',     value: `${btcSize.toFixed(4)} BTC`,             color: '#1a1813' },
    { icon: ICONS.dollar,     label: 'Notional value',    value: notional > 0 ? `$${fmt(notional, 0)}` : '—', color: '#1a1813' },
    { icon: ICONS.shield,     label: 'Margin used',       value: margin > 0 ? `$${fmt(margin, 2)}` : '—', color: '#1a1813' },
    { icon: ICONS.login,      label: 'Entry price',       value: fmtPrice(p.entry_price),                 color: '#1a1813' },
    { icon: ICONS.crosshair,  label: 'Mark price',        value: fmtPrice(p.mark_price),                  color: '#1a1813' },
    { icon: ICONS.alert, red: true, label: 'Liquidation price', value: fmtPrice(p.liq_price),             color: '#df5338' },
    { icon: ICONS.clock,      label: 'Hold duration',     value: holdSince(p.open_time),                  color: '#1a1813' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.34)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 434, maxWidth: '92vw', background: '#ffffff', zIndex: 91, boxShadow: '-24px 0 60px rgba(20,18,12,0.2)', display: 'flex', flexDirection: 'column', fontFamily: FONT, animation: 'drawerIn .28s cubic-bezier(.22,.8,.3,1)' }}>
        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813', letterSpacing: '-0.01em' }}>BTC/USDT.P</span>
              <span style={{ fontWeight: 700, fontSize: 10, color: '#1f9d55', background: '#e9f6ee', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>OPEN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>{isLong ? 'LONG' : 'SHORT'}</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7a715f', background: '#f1ede6', padding: '4px 10px', borderRadius: 7 }}>{fmtLev(p.leverage)} leverage</span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>{allocPct.toFixed(0)}% of book</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #ececea', background: '#f6f5f2', color: '#56544b', fontSize: 15, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>✕</button>
        </div>

        {/* body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Unrealized P&amp;L</span>
            <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
              {isUp ? '+$' : '-$'}{fmt(Math.abs(pnl), 2)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>
                {isUp ? '+' : ''}{roe.toFixed(2)}%
              </span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>since entry</span>
            </div>
          </div>

          <div style={{ border: '1px solid #f0efec', borderRadius: 14, overflow: 'hidden' }}>
            {detailRows.map((row, i) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < detailRows.length - 1 ? '1px solid #f5f4f1' : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <Chip icon={row.icon} red={row.red} />
                  {row.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#fafaf8', border: '1px solid #f0efec', borderRadius: 13, padding: '14px 16px' }}>
            <span style={{ fontWeight: 500, fontSize: 12.5, color: '#7a715f', lineHeight: 1.5 }}>
              Live position on Gate.io USDT-M perpetuals. All figures are sourced in real-time from the Gate.io API.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Position Row ─────────────────────────────────────────────────────────────

function PositionRow({ p, totalValue, onOpen }: { p: GateFuturesPosition; totalValue: number; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isLong = p.size > 0;
  const pnl = parseFloat(p.unrealised_pnl);
  const margin = parseFloat(p.margin) || 0;
  const allocPct = Math.min(100, (margin / totalValue) * 100);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr .8fr .9fr .9fr .9fr 1.5fr 1fr 30px',
        gap: 12,
        padding: '15px 8px',
        alignItems: 'center',
        borderBottom: '1px solid #f5f4f1',
        fontWeight: 600,
        fontSize: 14,
        color: '#56544b',
        borderRadius: 10,
        cursor: 'pointer',
        background: hovered ? '#fdf6f1' : 'transparent',
        transition: 'background .13s',
      }}
    >
      <span style={{ color: '#1a1813', fontWeight: 700 }}>BTC/USDT.P</span>
      <span>
        {isLong
          ? <span style={{ fontWeight: 700, fontSize: 11, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>LONG</span>
          : <span style={{ fontWeight: 700, fontSize: 11, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>SHORT</span>
        }
      </span>
      <span style={{ textAlign: 'right' as const }}>{Math.abs(p.size)}</span>
      <span style={{ textAlign: 'right' as const }}>${fmt(parseFloat(p.entry_price), 0)}</span>
      <span style={{ textAlign: 'right' as const, color: '#1a1813' }}>${fmt(parseFloat(p.mark_price), 0)}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, height: 7, background: '#f0efeb', borderRadius: 99, overflow: 'hidden', display: 'block' }}>
          <span style={{ display: 'block', height: '100%', width: `${allocPct.toFixed(1)}%`, background: 'linear-gradient(90deg,#ff8a5b,#ef5f33)', borderRadius: 99 }} />
        </span>
        <span style={{ color: '#a8a69b', minWidth: 34, fontSize: 13 }}>{allocPct.toFixed(0)}%</span>
      </span>
      <span style={{ textAlign: 'right' as const, fontWeight: 700, color: pnl >= 0 ? '#1f9d55' : '#df5338' }}>
        {pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(pnl), 0)}
      </span>
      <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#d2a48d', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>›</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PositionsTable() {
  const { data: rawPositions, isLoading } = usePositions();
  const { data: account } = useAccount();
  const [selected, setSelected] = useState<GateFuturesPosition | null>(null);

  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const totalValue = parseFloat(account?.total ?? '1') || 1;
  const totalUnrealPnl = positions.reduce((s, p) => s + parseFloat(p.unrealised_pnl), 0);

  if (isLoading) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px 14px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <Skeleton className="h-6 w-40 mb-4" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full mb-2 rounded-lg" />)}
      </div>
    );
  }

  return (
    <>
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px 14px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Open positions</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#9b988d' }}>
            {positions.length} open · uPnL{' '}
            <span style={{ color: totalUnrealPnl >= 0 ? '#1f9d55' : '#df5338', fontWeight: 700 }}>
              {totalUnrealPnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(totalUnrealPnl), 0)}
            </span>
          </span>
        </div>

        {positions.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#b3b1a7', fontWeight: 600, fontSize: 14 }}>No open positions</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .9fr .9fr .9fr 1.5fr 1fr 30px', gap: 12, padding: '13px 4px', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: '#b0aea3', textTransform: 'uppercase' as const, borderBottom: '1px solid #f2f1ee' }}>
              <span>Instrument</span><span>Side</span>
              <span style={{ textAlign: 'right' as const }}>Size</span>
              <span style={{ textAlign: 'right' as const }}>Entry</span>
              <span style={{ textAlign: 'right' as const }}>Mark</span>
              <span>Allocation</span>
              <span style={{ textAlign: 'right' as const }}>uPnL</span>
              <span />
            </div>
            {positions.map((p, idx) => (
              <PositionRow key={`${p.contract}-${idx}`} p={p} totalValue={totalValue} onOpen={() => setSelected(p)} />
            ))}
          </>
        )}
      </div>

      {selected && <PositionDetailDrawer p={selected} totalValue={totalValue} onClose={() => setSelected(null)} />}
    </>
  );
}
