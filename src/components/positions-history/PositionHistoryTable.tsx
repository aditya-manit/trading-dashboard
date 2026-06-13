'use client';

import { useState, useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPositionClose } from '@/types/gate';

const PAGE_SIZE = 8;
const FONT = "'Plus Jakarta Sans', sans-serif";
const BTC_CONTRACT_SIZE = 0.0001;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

// ─── Calendar helpers ─────────────────────────────────────────────────────────

interface CalendarCell {
  date: Date;
  trades: GateFuturesPositionClose[];
  inMonth: boolean;
}

function buildTradeCalendar(positions: GateFuturesPositionClose[], year: number, month: number): CalendarCell[][] {
  const byDate = new Map<string, GateFuturesPositionClose[]>();
  for (const p of positions) {
    const d = new Date(p.time * 1000);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = `${year}-${month}-${d.getDate()}`;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(p);
    }
  }

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  // Pad before month start
  for (let i = firstDay.getDay(); i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), trades: [], inMonth: false });
  }
  // Month days
  for (let d = 1; d <= lastDate; d++) {
    cells.push({ date: new Date(year, month, d), trades: byDate.get(`${year}-${month}-${d}`) ?? [], inMonth: true });
  }
  // Pad to complete last row
  const rem = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    cells.push({ date: new Date(year, month + 1, i), trades: [], inMonth: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
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
            {/* Two-column hero */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.leverage} />Leverage
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{fmtLev(p.leverage)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f4f1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 500, fontSize: 13, color: '#9b988d' }}>
                  <GrayChip icon={ICONS.shield} />Margin used
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>{marginEst > 0 ? fmtUsd(marginEst) : '—'}</span>
              </div>
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

  const GLOSS = 'linear-gradient(180deg,rgba(255,255,255,0.68) 0%,rgba(255,255,255,0) 52%)';
  const bg = hovered
    ? (isUp
        ? `${GLOSS},linear-gradient(180deg,#f6fdf8,#cee9d9)`
        : `${GLOSS},linear-gradient(180deg,#fffbfa,#f4ddd5)`)
    : (isUp ? 'linear-gradient(180deg,#fcfefd,#e3f3ea)' : 'linear-gradient(180deg,#fffcfb,#fbe7e1)');
  const border = hovered
    ? (isUp ? '#b5d9c6' : '#e4c0b0')
    : (isUp ? '#cfe8da' : '#f0d4ca');
  const shadow = hovered ? 'inset 0 1px 0 rgba(255,255,255,0.9)' : 'none';

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: '16px 18px',
        border: `1px solid ${border}`,
        background: bg,
        boxShadow: shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        cursor: 'pointer',
        transition: 'background .18s, border-color .18s, box-shadow .18s',
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

// ─── Calendar Trade Pill ──────────────────────────────────────────────────────

function TradePill({ p, onClick }: { p: GateFuturesPositionClose; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const pnl = parseFloat(p.pnl);
  const isUp = pnl >= 0;
  const isLong = p.side === 'long';
  const GLOSS = 'linear-gradient(180deg,rgba(255,255,255,0.68) 0%,rgba(255,255,255,0) 52%)';
  const bg = hovered
    ? (isUp
        ? `${GLOSS},linear-gradient(180deg,#f6fdf8,#cee9d9)`
        : `${GLOSS},linear-gradient(180deg,#fffbfa,#f4ddd5)`)
    : (isUp ? 'linear-gradient(180deg,#fcfefd,#e3f3ea)' : 'linear-gradient(180deg,#fffcfb,#fbe7e1)');
  const border = hovered ? (isUp ? '#b5d9c6' : '#e4c0b0') : (isUp ? '#cfe8da' : '#f0d4ca');
  const shadow = hovered ? 'inset 0 1px 0 rgba(255,255,255,0.9)' : 'none';
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
        padding: '6px 9px 7px 11px',
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: shadow,
        cursor: 'pointer',
        marginBottom: 4,
        transition: 'background .18s, border-color .18s, box-shadow .18s',
      }}
    >
      <span style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: isUp ? '#2faa63' : '#df5338' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 10, color: '#1a1813' }}>BTC.P</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 9, color: '#7a715f', background: 'rgba(122,113,95,0.1)', padding: '2px 5px', borderRadius: 4 }}>{fmtLev(p.leverage)}</span>
          <span style={{ fontWeight: 700, fontSize: 9, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e3f3ea' : '#fbe5df', padding: '2px 5px', borderRadius: 4 }}>{isLong ? 'L' : 'S'}</span>
        </div>
      </div>
      <div>
        <span style={{ fontWeight: 800, fontSize: 12.5, color: isUp ? '#1f9d55' : '#df5338' }}>
          {isUp ? '+$' : '-$'}{Math.abs(pnl).toFixed(0)}
        </span>
        <span style={{ fontWeight: 700, fontSize: 9.5, color: isUp ? '#3a8a5a' : '#c04a2e', marginLeft: 4 }}>{retPct(p)}</span>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({
  positions,
  viewDate,
  setViewDate,
  onTradeClick,
}: {
  positions: GateFuturesPositionClose[];
  viewDate: Date;
  setViewDate: (d: Date) => void;
  onTradeClick: (p: GateFuturesPositionClose) => void;
}) {
  const today = new Date();
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
  const weeks = useMemo(() => buildTradeCalendar(positions, y, m), [positions, y, m]);
  const offset = (today.getFullYear() - y) * 12 + (today.getMonth() - m);

  const navBtn = (label: string, onClick: () => void, active?: boolean): React.CSSProperties => ({
    fontFamily: FONT, fontWeight: 600, fontSize: 12.5, padding: '5px 11px', borderRadius: 8,
    border: '1px solid #ececea', cursor: 'pointer',
    background: active ? '#f3eefe' : '#fff',
    color: active ? '#6a45c4' : '#56544b',
    transition: 'all .13s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1813' }}>{MONTH_NAMES[m]} {y}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button style={navBtn('‹', () => {})} onClick={() => setViewDate(new Date(y, m - 1, 1))}>‹</button>
          <button
            style={navBtn('Today', () => {}, isCurrentMonth)}
            onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Today
          </button>
          <button style={navBtn('›', () => {})} onClick={() => setViewDate(new Date(y, m + 1, 1))}>›</button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7 }}>
        {DAY_NAMES.map(d => (
          <span key={d} style={{ fontWeight: 600, fontSize: 11.5, color: '#b0aea3', textAlign: 'center' as const, paddingBottom: 4 }}>{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 7 }}>
        {weeks.flat().map((cell, i) => {
          const isToday = cell.inMonth &&
            cell.date.getDate() === today.getDate() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getFullYear() === today.getFullYear();

          return (
            <div
              key={i}
              style={{
                minHeight: 116,
                border: '1px solid #f0efec',
                borderRadius: 9,
                padding: '6px 7px',
                background: !cell.inMonth ? '#fafaf8' : cell.trades.length > 0 ? '#fff' : '#fcfcfb',
                opacity: !cell.inMonth ? 0.55 : 1,
              }}
            >
              <div style={{
                display: 'inline-flex',
                fontWeight: 700,
                fontSize: 12.5,
                color: isToday ? '#7c5cff' : '#1a1813',
                background: isToday ? '#f3eefe' : 'transparent',
                borderRadius: 5,
                padding: isToday ? '1px 6px' : '1px 2px',
                marginBottom: 5,
              }}>
                {cell.date.getDate()}
              </div>
              {cell.trades.slice(0, 2).map((p, pi) => (
                <TradePill key={pi} p={p} onClick={() => onTradeClick(p)} />
              ))}
              {cell.trades.length > 2 && (
                <span style={{ fontWeight: 600, fontSize: 10.5, color: '#9b988d' }}>+{cell.trades.length - 2} more</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty month note */}
      {weeks.flat().every(c => c.trades.length === 0) && (
        <div style={{ textAlign: 'center' as const, padding: '20px 0', fontWeight: 600, fontSize: 13.5, color: '#b3b1a7' }}>
          No trades in {MONTH_NAMES[m]} {y}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PositionHistoryTable() {
  const { data: raw, isLoading } = usePositionHistory();
  const positions = Array.isArray(raw) ? raw : [];
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<GateFuturesPositionClose | null>(null);
  const [view, setView] = useState<'gallery' | 'calendar'>('gallery');
  const [calDate, setCalDate] = useState<Date>(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Legend */}
            {view === 'gallery' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#2faa63', display: 'inline-block' }} />Profit
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#df5338', display: 'inline-block' }} />Loss
                </span>
              </div>
            )}
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#f4f4f2', borderRadius: 10, padding: 4, border: '1px solid #ececea' }}>
              {(['gallery', 'calendar'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    fontFamily: FONT, fontWeight: 600, fontSize: 12.5,
                    padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: view === v ? '#ffffff' : 'transparent',
                    color: view === v ? '#1a1813' : '#9b988d',
                    boxShadow: view === v ? '0 1px 2px rgba(20,20,12,0.1)' : 'none',
                    transition: 'all .15s',
                    textTransform: 'capitalize' as const,
                  }}
                >
                  {v === 'gallery' ? 'Gallery' : 'Calendar'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {positions.length === 0 ? (
          <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f3eefe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', textAlign: 'center' as const }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1813' }}>No closed trades yet</span>
              <span style={{ fontWeight: 500, fontSize: 13.5, color: '#9b988d' }}>Completed positions will appear here once you close a trade</span>
            </div>
          </div>
        ) : view === 'calendar' ? (
          <CalendarView
            positions={positions}
            viewDate={calDate}
            setViewDate={setCalDate}
            onTradeClick={setSelected}
          />
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
