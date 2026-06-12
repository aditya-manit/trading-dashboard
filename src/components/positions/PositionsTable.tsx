'use client';

import { useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useAccount } from '@/hooks/useAccount';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPosition } from '@/types/gate';

const FONT = "'Plus Jakarta Sans', sans-serif";
// Gate.io BTC_USDT: 1 contract = 0.0001 BTC
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

// ─── Position Detail Drawer ───────────────────────────────────────────────────

function PositionDetailDrawer({
  p,
  totalValue,
  onClose,
}: {
  p: GateFuturesPosition;
  totalValue: number;
  onClose: () => void;
}) {
  const isLong = p.size > 0;
  const pnl = parseFloat(p.unrealised_pnl);
  const isUp = pnl >= 0;
  const margin = parseFloat(p.margin) || 1;
  const roe = (pnl / margin) * 100;
  const allocPct = Math.min(100, (margin / totalValue) * 100);
  const btcSize = Math.abs(p.size) * BTC_CONTRACT_SIZE;
  // Gate.io provides `value` = notional in USDT directly
  const notional = parseFloat(p.value) || 0;

  const detailRows = [
    { label: 'Direction',         value: isLong ? 'Long' : 'Short',                                  color: isLong ? '#1f9d55' : '#df5338' },
    { label: 'Leverage',          value: fmtLev(p.leverage),                                         color: '#1a1813' },
    { label: 'Position size',     value: `${btcSize.toFixed(4)} BTC`,                                color: '#1a1813' },
    { label: 'Notional value',    value: notional > 0 ? `$${fmt(notional, 0)}` : '—',               color: '#1a1813' },
    { label: 'Margin used',       value: margin > 0 ? `$${fmt(margin, 2)}` : '—',                   color: '#1a1813' },
    { label: 'Entry price',       value: fmtPrice(p.entry_price),                                    color: '#1a1813' },
    { label: 'Mark price',        value: fmtPrice(p.mark_price),                                     color: '#1a1813' },
    { label: 'Liquidation price', value: fmtPrice(p.liq_price),                                     color: '#df5338' },
    { label: 'Hold duration',     value: holdSince(p.open_time),                                     color: '#1a1813' },
  ];

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.34)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s ease' }}
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
        <style>{`
          @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn   { from { opacity: 0; }                  to { opacity: 1; }             }
        `}</style>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* name + OPEN badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813', letterSpacing: '-0.01em' }}>BTC/USDT.P</span>
              <span style={{ fontWeight: 700, fontSize: 10, color: '#1f9d55', background: '#e9f6ee', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.05em' }}>OPEN</span>
            </div>
            {/* pills row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e9f6ee' : '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#7a715f', background: '#f1ede6', padding: '4px 10px', borderRadius: 7 }}>
                {fmtLev(p.leverage)} leverage
              </span>
              <span style={{ fontWeight: 500, fontSize: 12.5, color: '#9b988d' }}>{allocPct.toFixed(0)}% of book</span>
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

          {/* uPnL hero */}
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

          {/* detail rows */}
          <div style={{ border: '1px solid #f0efec', borderRadius: 14, overflow: 'hidden' }}>
            {detailRows.map((row, i) => (
              <div
                key={row.label}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < detailRows.length - 1 ? '1px solid #f5f4f1' : 'none' }}
              >
                <span style={{ fontWeight: 500, fontSize: 13, color: '#9b988d' }}>{row.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* footer */}
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

function PositionRow({
  p,
  totalValue,
  onOpen,
}: {
  p: GateFuturesPosition;
  totalValue: number;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const isLong = p.size > 0;
  const pnl = parseFloat(p.unrealised_pnl);
  const margin = parseFloat(p.margin) || 0;
  const allocPct = Math.min(100, (margin / totalValue) * 100);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr .8fr .9fr .9fr .9fr 1.5fr 1fr 96px',
        gap: 12,
        padding: '15px 8px',
        alignItems: 'center',
        borderBottom: '1px solid #f5f4f1',
        fontWeight: 600,
        fontSize: 14,
        color: '#56544b',
        borderRadius: 10,
        background: hovered ? '#faf9f7' : 'transparent',
        transition: 'background .13s',
      }}
    >
      <span style={{ color: '#1a1813', fontWeight: 700 }}>BTC/USDT.P</span>
      <span>
        {isLong ? (
          <span style={{ fontWeight: 700, fontSize: 11, color: '#1f9d55', background: '#e9f6ee', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>LONG</span>
        ) : (
          <span style={{ fontWeight: 700, fontSize: 11, color: '#df5338', background: '#fbeae6', padding: '4px 10px', borderRadius: 7, letterSpacing: '0.04em' }}>SHORT</span>
        )}
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
      <span style={{ textAlign: 'right' as const }}>
        <span
          onClick={onOpen}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontWeight: 700, fontSize: 12.5, color: '#c25a33',
            background: btnHovered ? 'linear-gradient(135deg,#fce5d6,#f8cdb6)' : 'linear-gradient(135deg,#fdf0e8,#fbdccc)',
            border: '1px solid #f6d4c0',
            padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(200,90,40,0.1)',
            transition: 'background .13s',
          }}
        >
          Details <span style={{ fontSize: 13, color: '#df7a4d' }}>›</span>
        </span>
      </span>
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
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#b3b1a7', fontWeight: 600, fontSize: 14 }}>
            No open positions
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .8fr .9fr .9fr .9fr 1.5fr 1fr 96px', gap: 12, padding: '13px 4px', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em', color: '#b0aea3', textTransform: 'uppercase' as const, borderBottom: '1px solid #f2f1ee' }}>
              <span>Instrument</span>
              <span>Side</span>
              <span style={{ textAlign: 'right' as const }}>Size</span>
              <span style={{ textAlign: 'right' as const }}>Entry</span>
              <span style={{ textAlign: 'right' as const }}>Mark</span>
              <span>Allocation</span>
              <span style={{ textAlign: 'right' as const }}>uPnL</span>
              <span />
            </div>
            {positions.map((p, idx) => (
              <PositionRow
                key={`${p.contract}-${idx}`}
                p={p}
                totalValue={totalValue}
                onOpen={() => setSelected(p)}
              />
            ))}
          </>
        )}
      </div>

      {selected && (
        <PositionDetailDrawer
          p={selected}
          totalValue={totalValue}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
