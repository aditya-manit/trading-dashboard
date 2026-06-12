'use client';

import { useState } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPositionClose } from '@/types/gate';

const PAGE_SIZE = 8;
const FONT = "'Plus Jakarta Sans', sans-serif";

function entryPrice(p: GateFuturesPositionClose): string {
  return p.side === 'long' ? p.long_price : p.short_price;
}
function exitPrice(p: GateFuturesPositionClose): string {
  return p.side === 'long' ? p.short_price : p.long_price;
}
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function retPct(p: GateFuturesPositionClose): string {
  const entry = parseFloat(entryPrice(p));
  const exit = parseFloat(exitPrice(p));
  if (!entry || !exit) return '';
  const pct = ((exit - entry) / entry) * 100 * (p.side === 'short' ? -1 : 1);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function TradeCard({ p }: { p: GateFuturesPositionClose }) {
  const pnl = parseFloat(p.pnl);
  const isUp = pnl >= 0;
  const isLong = p.side === 'long';

  if (isUp) {
    return (
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '16px 18px', border: '1px solid #d4ecdc', background: 'linear-gradient(155deg,#f3faf6,#e6f6ed)', display: 'flex', flexDirection: 'column', gap: 16, transition: 'transform .15s,box-shadow .15s', cursor: 'default' }}>
        <span style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#2faa63' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>BTC/USDT.P</span>
          <span style={{ fontWeight: 700, fontSize: 10.5, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e3f3ea' : '#fbe5df', padding: '4px 9px', borderRadius: 7, letterSpacing: '0.04em' }}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: '#1f9d55' }}>
            +${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#2f9d5e' }}>{retPct(p)}</span>
            <span style={{ fontWeight: 500, fontSize: 12, color: '#9aa39b' }}>{fmtDate(p.time)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, padding: '16px 18px', border: '1px solid #f3d6cd', background: 'linear-gradient(155deg,#fdf4f1,#fbe7e1)', display: 'flex', flexDirection: 'column', gap: 16, transition: 'transform .15s,box-shadow .15s', cursor: 'default' }}>
      <span style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#df5338' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1a1813' }}>BTC/USDT.P</span>
        <span style={{ fontWeight: 700, fontSize: 10.5, color: isLong ? '#1f9d55' : '#df5338', background: isLong ? '#e3f3ea' : '#fbe5df', padding: '4px 9px', borderRadius: 7, letterSpacing: '0.04em' }}>
          {isLong ? 'LONG' : 'SHORT'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: '#df5338' }}>
          −${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#df5338' }}>{retPct(p)}</span>
          <span style={{ fontWeight: 500, fontSize: 12, color: '#b69d97' }}>{fmtDate(p.time)}</span>
        </div>
      </div>
    </div>
  );
}

export function PositionHistoryTable() {
  const { data: raw, isLoading } = usePositionHistory();
  const positions = Array.isArray(raw) ? raw : [];
  const [page, setPage] = useState(0);

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
            {paginated.map((p, i) => <TradeCard key={`${p.time}-${i}`} p={p} />)}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '18px 4px 4px', marginTop: 8, borderTop: '1px solid #f2f1ee' }}>
              <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: '#9b988d' }}>
                Showing {start}–{end} of {positions.length} trades
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button style={btnStyle(false, safePage === 0)} onClick={() => !btnDisabled(0, safePage) && setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>
                  ‹ Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 8) }).map((_, i) => (
                  <button key={i} style={btnStyle(i === safePage, false)} onClick={() => setPage(i)}>
                    {i + 1}
                  </button>
                ))}
                {totalPages > 8 && safePage >= 8 && (
                  <button style={btnStyle(true, false)} onClick={() => {}}>
                    {safePage + 1}
                  </button>
                )}
                <button style={btnStyle(false, safePage >= totalPages - 1)} onClick={() => !btnDisabled(1, safePage, totalPages) && setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>
                  Next ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btnDisabled(dir: 0 | 1, page: number, total = 0): boolean {
  return dir === 0 ? page === 0 : page >= total - 1;
}
