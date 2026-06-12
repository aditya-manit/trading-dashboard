'use client';

import { useState } from 'react';
import { usePositions } from '@/hooks/usePositions';
import { useAccount } from '@/hooks/useAccount';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPosition } from '@/types/gate';

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function PositionRow({ p, totalValue }: { p: GateFuturesPosition; totalValue: number }) {
  const [hovered, setHovered] = useState(false);
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: '#c25a33', background: 'linear-gradient(135deg,#fdf0e8,#fbdccc)', border: '1px solid #f6d4c0', padding: '6px 12px', borderRadius: 9, cursor: 'pointer', boxShadow: '0 1px 2px rgba(200,90,40,0.1)' }}>
          Details <span style={{ fontSize: 13, color: '#df7a4d' }}>›</span>
        </span>
      </span>
    </div>
  );
}

export function PositionsTable() {
  const { data: rawPositions, isLoading } = usePositions();
  const { data: account } = useAccount();
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
            <PositionRow key={`${p.contract}-${idx}`} p={p} totalValue={totalValue} />
          ))}
        </>
      )}
    </div>
  );
}
