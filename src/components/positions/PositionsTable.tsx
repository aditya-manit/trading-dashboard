'use client';

import { useState, useMemo } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useAccount } from '@/hooks/useAccount';
import { useAccountBook } from '@/hooks/useAccountBook';
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
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ICONS = {
  leverage:  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  shield:    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  dollar:    <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  crosshair: <><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>,
  alert:     <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
};

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#b0aea3' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: '#f2f1ee' }} />
    </div>
  );
}

function GrayChip({ icon }: { icon: React.ReactNode }) {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 8, background: '#f6f5f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#a8a08e' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
    </span>
  );
}

// ─── Position Detail Drawer ───────────────────────────────────────────────────

function PositionDetailDrawer({ p, onClose }: { p: GateFuturesPosition; onClose: () => void }) {
  const isLong = p.size > 0;
  const pnl = parseFloat(p.unrealised_pnl);
  const isUp = pnl >= 0;
  const margin = parseFloat(p.margin) || 1;
  const roe = (pnl / margin) * 100;
  const btcSize = Math.abs(p.size) * BTC_CONTRACT_SIZE;
  const notional = parseFloat(p.value) || 0;
  const entry = parseFloat(p.entry_price) || 0;
  const mark  = parseFloat(p.mark_price)  || 0;
  const liq   = parseFloat(p.liq_price)   || 0;
  const leverage = parseFloat(p.leverage) || 1;
  const marginPct = notional > 0 ? Math.min(100, (margin / (notional / leverage)) * 100) : 0;

  // Price track positions
  const clamp = (x: number) => Math.max(4, Math.min(96, x));
  const lo = Math.min(entry, liq, mark) * 0.995;
  const hi = Math.max(entry, liq, mark) * 1.005;
  const span = (hi - lo) || 1;
  const entryPct = clamp(((entry - lo) / span) * 100);
  const liqPct   = clamp(((liq   - lo) / span) * 100);
  const markPct  = clamp(((mark  - lo) / span) * 100);

  const distPct = liq && mark
    ? (isLong ? (mark - liq) / mark * 100 : (liq - mark) / mark * 100)
    : 0;
  const bufferColor  = distPct < 8 ? '#df5338' : distPct < 18 ? '#d98a1f' : '#1f9d55';
  const bufferBg     = distPct < 8 ? '#fdeee9' : distPct < 18 ? '#fbf2e3' : '#ebf6ef';
  const bufferBorder = distPct < 8 ? '#f6d8cc' : distPct < 18 ? '#f1e1bf' : '#cfe9da';
  const trackGradient = isLong
    ? 'linear-gradient(90deg,#df5338,#f3c9a0 38%,#cfe9d8 70%,#3fbf86)'
    : 'linear-gradient(90deg,#3fbf86,#cfe9d8 30%,#f3c9a0 62%,#df5338)';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.34)', animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 434, maxWidth: '92vw', background: '#ffffff', zIndex: 91, boxShadow: '-24px 0 60px rgba(20,18,12,0.2)', display: 'flex', flexDirection: 'column', fontFamily: FONT, animation: 'drawerIn .28s cubic-bezier(.22,.8,.3,1)' }}>
        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813', letterSpacing: '-0.01em' }}>BTC/USDT.P</span>
              <span style={{ fontWeight: 700, fontSize: 10, color: '#1f9d55', background: '#e9f6ee', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>OPEN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
              {isLong
                ? <span style={{ fontWeight: 700, fontSize: 11, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>LONG</span>
                : <span style={{ fontWeight: 700, fontSize: 11, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>SHORT</span>
              }
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7a715f', background: '#efebf8', padding: '4px 10px', borderRadius: 7 }}>{fmtLev(p.leverage)} leverage</span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>Opened {fmtDate(p.open_time)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #ececea', background: '#f6f5f2', color: '#56544b', fontSize: 15, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>

          {/* Two-column hero — side by side with vertical divider */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Unrealized P&L</span>
              <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
                {isUp ? '+$' : '-$'}{fmt(Math.abs(pnl), 2)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>
                  {isUp ? '+' : ''}{roe.toFixed(2)}%
                </span>
                <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>Held for</span>
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1a1813', marginLeft: 5 }}>{holdSince(p.open_time)}</span>
              </div>
            </div>
            <div style={{ width: 1, background: '#f0efec', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Entry price</span>
              <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: '#7c5cff' }}>{fmtPrice(p.entry_price)}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {isLong
                  ? <span style={{ fontWeight: 700, fontSize: 13, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 8 }}>Long</span>
                  : <span style={{ fontWeight: 700, fontSize: 13, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>Short</span>
                }
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1a1813' }}>{btcSize.toFixed(2)} BTC</span>
              </div>
            </div>
          </div>

          {/* Exposure */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionDivider label="Exposure" />
            <div style={{ border: '1px solid #f0efec', borderRadius: 14, overflow: 'hidden' }}>
              {/* Leverage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.leverage} />Leverage
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{fmtLev(p.leverage)}</span>
              </div>
              {/* Margin used — with bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.shield} />Margin used
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 60, height: 7, background: '#f0efeb', borderRadius: 99, overflow: 'hidden', display: 'block', flexShrink: 0 }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, marginPct)}%`, background: 'linear-gradient(90deg,#9d82ff,#7c5cff)', borderRadius: 99 }} />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 12, color: '#7e63c8', minWidth: 30 }}>{marginPct.toFixed(0)}%</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813', minWidth: 58, textAlign: 'right' as const }}>{margin > 0 ? `$${fmt(margin, 0)}` : '—'}</span>
                </span>
              </div>
              {/* Notional value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.dollar} />Notional value
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{notional > 0 ? `$${fmt(notional, 0)}` : '—'}</span>
              </div>
            </div>
          </div>

          {/* Market */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionDivider label="Market" />
            <div style={{ border: '1px solid #f0efec', borderRadius: 14, overflow: 'hidden' }}>
              {/* Current price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.crosshair} />Current price
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{fmtPrice(p.mark_price)}</span>
              </div>
              {/* Liquidation price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: '#fbeae6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#df5338' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS.alert}</svg>
                  </span>
                  Liquidation price
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#df5338' }}>{fmtPrice(p.liq_price)}</span>
              </div>

              {/* Price track — inside border box */}
              {entry > 0 && liq > 0 && mark > 0 && (
                <div style={{ padding: '14px 20px 16px', borderTop: '1px solid #f5f4f1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', color: '#9b988d', textTransform: 'uppercase' as const }}>Price position</span>
                    <span style={{ fontWeight: 600, fontSize: 11.5, color: '#9b988d' }}>Entry → Liquidation</span>
                  </div>

                  {/* Track bar */}
                  <div style={{ position: 'relative', height: 8, background: trackGradient, borderRadius: 99, margin: '40px 14px 42px' }}>
                    {/* Entry marker */}
                    <span style={{ position: 'absolute', top: 0, left: `${entryPct.toFixed(1)}%`, transform: 'translateX(-50%)' }}>
                      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 16, background: '#b6b2a8', borderRadius: 2 }} />
                      <span style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', color: '#b0aea3', textTransform: 'uppercase' as const }}>Entry</span>
                        <span style={{ fontWeight: 700, fontSize: 11, color: '#56544b' }}>{fmtPrice(p.entry_price)}</span>
                      </span>
                    </span>
                    {/* Liq marker */}
                    <span style={{ position: 'absolute', top: 0, left: `${liqPct.toFixed(1)}%`, transform: 'translateX(-50%)' }}>
                      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 2, height: 16, background: '#df5338', borderRadius: 2 }} />
                      <span style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', color: '#df8a78', textTransform: 'uppercase' as const }}>Liq</span>
                        <span style={{ fontWeight: 700, fontSize: 11, color: '#df5338' }}>{fmtPrice(p.liq_price)}</span>
                      </span>
                    </span>
                    {/* Mark marker */}
                    <span style={{ position: 'absolute', top: 0, left: `${markPct.toFixed(1)}%`, transform: 'translateX(-50%)' }}>
                      <span style={{ position: 'absolute', bottom: 13, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' as const, background: '#1a1813', color: '#fff', fontWeight: 700, fontSize: 11, padding: '4px 9px', borderRadius: 8, boxShadow: '0 4px 10px rgba(20,18,12,0.22)' }}>
                        {fmtPrice(p.mark_price)}
                      </span>
                      <span style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1a1813' }} />
                      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', background: '#fff', border: '3px solid #1a1813', boxShadow: '0 2px 6px rgba(20,18,12,0.25)', display: 'block' }} />
                    </span>
                  </div>

                  {/* Buffer band — full-width, flush to box bottom */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', margin: '20px -20px -16px', background: bufferBg, borderTop: `1px solid ${bufferBorder}` }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 12.5, color: bufferColor }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      Liquidation buffer
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: bufferColor, letterSpacing: '-0.01em' }}>{distPct > 0 ? `${distPct.toFixed(1)}%` : '—'}</span>
                  </div>
                </div>
              )}
            </div>
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
        background: hovered ? '#f8f6ff' : 'transparent',
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
      <span style={{ textAlign: 'right' as const }}>{(Math.abs(p.size) * BTC_CONTRACT_SIZE).toFixed(2)} BTC</span>
      <span style={{ textAlign: 'right' as const, color: '#7c5cff', fontWeight: 700 }}>${fmt(parseFloat(p.entry_price), 0)}</span>
      <span style={{ textAlign: 'right' as const, color: '#1a1813' }}>${fmt(parseFloat(p.mark_price), 0)}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, height: 7, background: '#f0efeb', borderRadius: 99, overflow: 'hidden', display: 'block' }}>
          <span style={{ display: 'block', height: '100%', width: `${allocPct.toFixed(1)}%`, background: 'linear-gradient(90deg,#9d82ff,#7c5cff)', borderRadius: 99 }} />
        </span>
        <span style={{ color: '#a8a69b', minWidth: 34, fontSize: 13 }}>{allocPct.toFixed(0)}%</span>
      </span>
      <span style={{ textAlign: 'right' as const, fontWeight: 700, color: pnl >= 0 ? '#1f9d55' : '#df5338' }}>
        {pnl >= 0 ? '+$' : '-$'}{fmt(Math.abs(pnl), 0)}
      </span>
      <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', color: '#7c5cff', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>›</span>
    </div>
  );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const W = 68, H = 26, pad = 2;
  const mn = Math.min(...points), mx = Math.max(...points);
  const sp = mx - mn || 1;
  const X = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const Y = (v: number) => H - pad - ((v - mn) / sp) * (H - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }}>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PositionsTable() {
  const { data: rawPositions, isLoading } = usePositions();
  const { data: account } = useAccount();
  const { data: bookEntries } = useAccountBook();
  const [selected, setSelected] = useState<GateFuturesPosition | null>(null);

  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const totalValue = parseFloat(account?.total ?? '1') || 1;
  const totalUnrealPnl = positions.reduce((s, p) => s + parseFloat(p.unrealised_pnl), 0);
  const isUp = totalUnrealPnl >= 0;

  const sparkPoints = useMemo(() => {
    if (!Array.isArray(bookEntries) || bookEntries.length < 2) return [];
    return bookEntries.slice(-28).map(e => parseFloat(e.balance));
  }, [bookEntries]);

  if (isLoading) {
    return (
      <div style={{ border: '1px solid #e3d8f8', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(105deg,#6a4fd8,#8b6ee8 55%,#a893f0)', padding: '18px 24px' }}>
          <Skeleton className="h-6 w-40" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div style={{ padding: '0 8px 14px', background: '#fff' }}>
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full mb-2 rounded-lg mt-2" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.55); }
          50%      { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
        }
      `}</style>
      <div style={{ border: '1px solid #d6caf5', borderRadius: 20, overflow: 'hidden', fontFamily: FONT }}>

        {/* ── Purple gradient header ── */}
        <div style={{ background: 'linear-gradient(105deg,#6a4fd8 0%,#8b6ee8 55%,#a893f0 100%)', padding: '17px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0, animation: 'livePulse 2s ease-in-out infinite', display: 'block' }} />
            <span style={{ fontWeight: 800, fontSize: 18, color: '#ffffff', letterSpacing: '-0.01em' }}>Open positions</span>
            <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.92)', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', padding: '3px 9px', borderRadius: 20 }}>LIVE</span>
          </div>
          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{positions.length} open</span>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14 }}>|</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>uPnL</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#ffffff', background: isUp ? 'rgba(47,170,99,0.85)' : 'rgba(223,83,56,0.85)', padding: '4px 11px', borderRadius: 20, letterSpacing: '-0.01em' }}>
              {isUp ? '+$' : '-$'}{fmt(Math.abs(totalUnrealPnl), 0)}
            </span>
            <MiniSparkline points={sparkPoints} />
          </div>
        </div>

        {/* ── Table body ── */}
        <div style={{ background: '#ffffff', padding: '0 14px 10px' }}>
          {positions.length === 0 ? (
            <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f3eefe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', textAlign: 'center' as const }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1813' }}>No open positions</span>
                <span style={{ fontWeight: 500, fontSize: 13.5, color: '#9b988d' }}>Your open futures contracts will appear here</span>
              </div>
            </div>
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
      </div>

      {selected && <PositionDetailDrawer p={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
