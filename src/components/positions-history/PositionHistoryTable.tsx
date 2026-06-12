'use client';

import { useState } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPositionClose } from '@/types/gate';

const PAGE_SIZE = 8;
const FONT = "'Plus Jakarta Sans', sans-serif";
// Gate.io BTC_USDT perpetual: 1 contract = 0.0001 BTC
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
// Return on margin = PnL / (notional / leverage).
// Falls back to leveraged price-return when notional is unavailable.
function retPct(p: GateFuturesPositionClose): string {
  const pnl = parseFloat(p.pnl);
  const lev = parseFloat(p.leverage) || 0;
  const notional = notionalUsd(p);

  if (lev > 0 && notional > 0) {
    const margin = notional / lev;
    const pct = (pnl / margin) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  }
  // cross-margin fallback: use price return
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

// ─── Icon Chip ────────────────────────────────────────────────────────────────

function Chip({ icon }: { icon: React.ReactNode }) {
  return (
    <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#f6f5f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a8a08e' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

const ICONS = {
  direction: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  leverage:  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  layers:    <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
  dollar:    <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
  login:     <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></>,
  logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  percent:   <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  clock:     <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
};

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function TradeDetailDrawer({ p, onClose }: { p: GateFuturesPositionClose; onClose: () => void }) {
  const pnl = parseFloat(p.pnl);
  const isUp = pnl >= 0;
  const isLong = p.side === 'long';
  const ret = retPct(p);
  const size = Math.abs(parseFloat(p.max_size) || 0);
  const notional = notionalUsd(p);
  const fee = Math.abs(parseFloat(p.pnl_fee) || 0);

  const detailRows: { icon: React.ReactNode; label: string; value: string; color: string }[] = [
    { icon: ICONS.direction, label: 'Direction',      value: isLong ? 'Long' : 'Short',              color: isLong ? '#1f9d55' : '#df5338' },
    { icon: ICONS.leverage,  label: 'Leverage',       value: fmtLev(p.leverage),                     color: '#1a1813' },
    { icon: ICONS.layers,    label: 'Position size',  value: `${size.toLocaleString('en-US')} contracts`, color: '#1a1813' },
    { icon: ICONS.dollar,    label: 'Notional value', value: notional > 0 ? fmtUsd(notional) : '—', color: '#1a1813' },
    { icon: ICONS.login,     label: 'Entry price',    value: fmtPrice(entryPrice(p)),                color: '#1a1813' },
    { icon: ICONS.logout,    label: 'Exit price',     value: fmtPrice(exitPrice(p)),                 color: '#1a1813' },
    { icon: ICONS.percent,   label: 'Trading fees',   value: fee > 0 ? `-${fmtUsd(fee)}` : '—',     color: '#df5338' },
    { icon: ICONS.clock,     label: 'Hold duration',  value: holdDuration(p),                        color: '#1a1813' },
  ];

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.3)', backdropFilter: 'blur(2px)' }}
      />
      {/* drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 434, maxWidth: '92vw',
        background: '#ffffff', zIndex: 91,
        boxShadow: '-24px 0 60px rgba(20,18,12,0.2)',
        display: 'flex', flexDirection: 'column',
        fontFamily: FONT,
        animation: 'drawerIn .28s cubic-bezier(.22,.8,.3,1)',
      }}>
        <style>{`@keyframes drawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813', letterSpacing: '-0.01em' }}>BTC/USDT.P</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7a715f', background: '#f1ede6', padding: '4px 10px', borderRadius: 7 }}>
                {fmtLev(p.leverage)} leverage
              </span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>{fmtDateLong(p.time)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #ececea', background: '#f6f5f2', color: '#56544b', fontSize: 15, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto', flex: 1 }}>
          {/* PnL hero */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Realized P&amp;L</span>
            <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.02em', color: isUp ? '#1f9d55' : '#df5338' }}>
              {isUp ? '+$' : '-$'}{Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              {ret && (
                <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 8 }}>
                  {ret}
                </span>
              )}
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>return on margin</span>
            </div>
          </div>

          {/* detail rows */}
          <div style={{ border: '1px solid #f0efec', borderRadius: 14, overflow: 'hidden' }}>
            {detailRows.map((row, i) => (
              <div
                key={row.label}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < detailRows.length - 1 ? '1px solid #f5f4f1' : 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <Chip icon={row.icon} />
                  {row.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* footer note */}
          <div style={{ background: '#fafaf8', border: '1px solid #f0efec', borderRadius: 13, padding: '14px 16px' }}>
            <span style={{ fontWeight: 500, fontSize: 12.5, color: '#7a715f', lineHeight: 1.5 }}>
              Executed on Gate.io USDT-M perpetuals. All figures are sourced live from the Gate.io position history API.
            </span>
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
      {/* left accent bar */}
      <span style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: isUp ? '#2faa63' : '#df5338' }} />

      {/* row 1: contract + leverage + side */}
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

      {/* row 2: PnL + return % + date */}
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
    background: active ? 'linear-gradient(135deg,#fdeadd,#fbd6c4)' : '#ffffff',
    color: active ? '#d6532a' : disabled ? '#cfcdc4' : '#56544b',
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
