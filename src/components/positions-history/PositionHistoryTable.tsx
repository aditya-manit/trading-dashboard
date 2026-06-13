'use client';

import { useState } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPositionClose } from '@/types/gate';

const PAGE_SIZE = 8;
const FONT = "'Plus Jakarta Sans', sans-serif";
const BTC_CONTRACT_SIZE = 0.0001;

function entryPrice(p: GateFuturesPositionClose): string {
  return p.side === 'long' ? p.long_price : p.short_price;
}
function exitPrice(p: GateFuturesPositionClose): string {
  return p.side === 'long' ? p.short_price : p.long_price;
}
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtDateLong(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function notionalUsd(p: GateFuturesPositionClose): number {
  const size = Math.abs(parseFloat(p.max_size) || 0);
  const entry = parseFloat(entryPrice(p)) || 0;
  return size * BTC_CONTRACT_SIZE * entry;
}
function retPct(p: GateFuturesPositionClose): string {
  const pnl = parseFloat(p.pnl);
  const lev = parseFloat(p.leverage) || 0;
  const notional = notionalUsd(p);

  if (lev > 0 && notional > 0) {
    const margin = notional / lev;
    const pct = (pnl / margin) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  }
  const entry = parseFloat(entryPrice(p));
  const exit = parseFloat(exitPrice(p));
  if (!entry || !exit) return '';
  const pct = ((exit - entry) / entry) * 100 * (p.side === 'short' ? -1 : 1);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
function holdDuration(p: GateFuturesPositionClose): string {
  const secs = p.time - (p.first_open_time || p.time);
  if (secs <= 0) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
function fmtLev(lev: string): string {
  const n = parseFloat(lev);
  if (!n || n === 0) return 'Cross';
  return `${n}x`;
}
function fmtPrice(s: string): string {
  const n = parseFloat(s);
  if (!n) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtUsd(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ICONS = {
  leverage: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  shield:   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  dollar:   <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
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

// ─── Trade Detail Drawer ──────────────────────────────────────────────────────

function TradeDetailDrawer({ p, onClose }: { p: GateFuturesPositionClose; onClose: () => void }) {
  const pnl = parseFloat(p.pnl);
  const isUp = pnl >= 0;
  const isLong = p.side === 'long';
  const ret = retPct(p);
  const size = Math.abs(parseFloat(p.max_size) || 0);
  const btcSize = (size * BTC_CONTRACT_SIZE).toFixed(2);
  const notional = notionalUsd(p);
  const fee = Math.abs(parseFloat(p.pnl_fee) || 0);
  const lev = parseFloat(p.leverage) || 0;
  const marginEst = lev > 0 && notional > 0 ? notional / lev : 0;

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
              <span style={{ fontWeight: 700, fontSize: 10, color: '#8c8a81', background: '#f1f0ed', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>CLOSED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' as const }}>
              {isLong
                ? <span style={{ fontWeight: 700, fontSize: 11, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>LONG</span>
                : <span style={{ fontWeight: 700, fontSize: 11, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>SHORT</span>
              }
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7a715f', background: '#efebf8', padding: '4px 10px', borderRadius: 7 }}>{fmtLev(p.leverage)} leverage</span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>{fmtDateLong(p.time)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #ececea', background: '#f6f5f2', color: '#56544b', fontSize: 15, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Two-column hero — side by side with vertical divider */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Realized P&L</span>
                <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
                  {isUp ? '+$' : '-$'}{Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>
                    {ret || '—'}
                  </span>
                  <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>Held for</span>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1a1813' }}>{holdDuration(p)}</span>
                </div>
              </div>
              <div style={{ width: 1, background: '#f0efec', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Outcome</span>
                <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
                  {isUp ? 'Win' : 'Loss'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b0aea3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8"/>
                    <path d="M14.5 9.5a2.5 2 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.9 2.5 2-1 2-2.5 2a2.5 2 0 0 1-2.5-1.5"/>
                    <path d="M12 6.5v11"/>
                  </svg>
                  <span style={{ fontWeight: 500, fontSize: 12, color: '#9b988d' }}>Fees</span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#56544b' }}>{fee > 0 ? `-${fmtUsd(fee)}` : '—'}</span>
                </div>
              </div>
            </div>

            {/* Horizontal divider */}
            <div style={{ height: 1, background: '#f0efec' }} />

            {/* Entry → Exit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Entry → Exit</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' as const }}>
                <span style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#7c5cff' }}>{fmtPrice(entryPrice(p))}</span>
                <span style={{ fontWeight: 600, fontSize: 18, color: '#c7b8f5' }}>→</span>
                <span style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#7c5cff' }}>{fmtPrice(exitPrice(p))}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {isLong
                  ? <span style={{ fontWeight: 700, fontSize: 13, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 8 }}>Long</span>
                  : <span style={{ fontWeight: 700, fontSize: 13, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>Short</span>
                }
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1a1813' }}>{btcSize} BTC</span>
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
              {/* Margin used */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.shield} />Margin used
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{marginEst > 0 ? fmtUsd(marginEst) : '—'}</span>
              </div>
              {/* Notional */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.dollar} />Notional
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{notional > 0 ? fmtUsd(notional) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Trade Card ───────────────────────────────────────────────────────────────

function TradeCard({ p, onOpen }: { p: GateFuturesPositionClose; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const pnl = parseFloat(p.pnl);
  const isUp = pnl >= 0;
  const isLong = p.side === 'long';

  const bg = hovered
    ? (isUp ? 'linear-gradient(155deg,#ecf8f1,#d7efe3)' : 'linear-gradient(155deg,#fcefea,#f9dccf)')
    : (isUp ? 'linear-gradient(155deg,#f3faf6,#e6f6ed)'  : 'linear-gradient(155deg,#fdf4f1,#fbe7e1)');

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: '16px 18px',
        border: `1px solid ${isUp ? '#d4ecdc' : '#f3d6cd'}`,
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: 'pointer',
        transition: 'background .15s',
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: isUp ? '#2faa63' : '#df5338' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>BTC/USDT.P</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 10.5, color: '#7a715f', background: 'rgba(122,113,95,0.1)', padding: '4px 8px', borderRadius: 7 }}>
            {fmtLev(p.leverage)}
          </span>
          <span style={{ fontWeight: 700, fontSize: 10.5, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e3f3ea' : '#fbe5df', padding: '4px 9px', borderRadius: 7, letterSpacing: '0.04em' }}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
          {isUp ? '+$' : '-$'}{Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#2f9d5e' : '#df5338' }}>{retPct(p)}</span>
          <span style={{ fontWeight: 500, fontSize: 12, color: isUp ? '#9aa39b' : '#b69d97' }}>{fmtDate(p.time)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PositionHistoryTable() {
  const { data: raw, isLoading } = usePositionHistory();
  const positions = Array.isArray(raw) ? raw : [];
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<GateFuturesPositionClose | null>(null);

  const totalPages = Math.ceil(positions.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paginated = positions.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <Skeleton className="h-6 w-40 mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    fontFamily: FONT, fontWeight: 700, fontSize: 13, minWidth: 34, height: 34, padding: '0 12px',
    borderRadius: 9, cursor: disabled ? 'default' : 'pointer',
    border: active ? '1px solid transparent' : '1px solid #ececea',
    background: active ? 'linear-gradient(135deg,#f1ecff,#e1d6ff)' : '#ffffff',
    color: active ? '#6a45d8' : disabled ? '#cfcdc4' : '#56544b',
    opacity: disabled ? 0.55 : 1, transition: 'all .15s',
  });

  const start = positions.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const end = Math.min(positions.length, (safePage + 1) * PAGE_SIZE);

  return (
    <>
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Recent trades</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: '#9b988d' }}>Closed trades, color-coded by outcome</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2faa63', display: 'inline-block' }} />Profit
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#df5338', display: 'inline-block' }} />Loss
            </span>
          </div>
        </div>

        {positions.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#b3b1a7', fontWeight: 600, fontSize: 14 }}>
            No closed trades yet
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {paginated.map((p, i) => (
                <TradeCard key={`${p.time}-${i}`} p={p} onOpen={() => setSelected(p)} />
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 4px 4px', marginTop: 8, borderTop: '1px solid #f2f1ee' }}>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: '#9b988d' }}>
                  Showing {start}–{end} of {positions.length} trades
                </span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button style={btnStyle(false, safePage === 0)} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
                    ‹ Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => (
                    <button key={i} style={btnStyle(i === safePage, false)} onClick={() => setPage(i)}>
                      {i + 1}
                    </button>
                  ))}
                  {totalPages > 8 && safePage >= 8 && (
                    <button style={btnStyle(true, false)}>{safePage + 1}</button>
                  )}
                  <button style={btnStyle(false, safePage >= totalPages - 1)} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selected && <TradeDetailDrawer p={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
