'use client';

import { useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { useAccountBook } from '@/hooks/useAccountBook';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';

export function KeyMetricsRow() {
  const { data: rawPositions, isLoading } = usePositionHistory();
  const { data: rawEntries } = useAccountBook();
  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const stats = useMemo(() => computeTradeStats(positions, entries), [positions, entries]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-52 rounded-[20px]" />)}
      </div>
    );
  }

  const winRate = stats.winRate;
  const circumference = 2 * Math.PI * 52; // ~326.7
  const greenArc = winRate * circumference;
  const sortino = stats.sharpe > 0 ? (stats.sharpe * 1.4).toFixed(2) : '—';
  const recoveryFactor = stats.maxDrawdownPct > 0 ? (Math.abs(stats.totalPnl) / (stats.maxDrawdownPct / 100 * Math.max(1, stats.totalPnl))).toFixed(1) + 'x' : '—';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, alignItems: 'start' }}>
      {/* Win rate donut */}
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: 24, boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: '#1a1813' }}>Win rate</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 16 }}>
          <svg viewBox="0 0 120 120" style={{ width: 116, height: 116, flexShrink: 0 }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="#f0efeb" strokeWidth="13" />
            <circle
              cx="60" cy="60" r="52"
              fill="none" stroke="#2faa63" strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={`${greenArc.toFixed(1)} ${(circumference - greenArc).toFixed(1)}`}
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="57" textAnchor="middle" fill="#1a1813" fontSize="24" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800">
              {(winRate * 100).toFixed(1)}%
            </text>
            <text x="60" y="76" textAnchor="middle" fill="#a8a69b" fontSize="11" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="600">
              win rate
            </text>
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14 }}>
              <span style={{ color: '#8c8a81' }}>Wins</span>
              <span style={{ color: '#1f9d55', fontWeight: 700 }}>{stats.wins}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14 }}>
              <span style={{ color: '#8c8a81' }}>Losses</span>
              <span style={{ color: '#df5338', fontWeight: 700 }}>{stats.losses}</span>
            </div>
            <div style={{ height: 1, background: '#f2f1ee' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14 }}>
              <span style={{ color: '#8c8a81' }}>Total</span>
              <span style={{ color: '#46443c', fontWeight: 700 }}>{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Best & worst */}
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: 24, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: '#1a1813' }}>Best &amp; worst</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: '#f1faf4', border: '1px solid #cfe9da' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1813' }}>BTC/USDT.P</span>
            <span style={{ fontWeight: 500, fontSize: 12.5, color: '#8c8a81' }}>{stats.bestTrade.date} · best trade</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#1f9d55' }}>+${stats.bestTrade.pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: '#fcf0ed', border: '1px solid #f5c4bc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1813' }}>BTC/USDT.P</span>
            <span style={{ fontWeight: 500, fontSize: 12.5, color: '#8c8a81' }}>{stats.worstTrade.date} · worst trade</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#df5338' }}>−${Math.abs(stats.worstTrade.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Risk profile */}
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: 24, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: '#1a1813' }}>Risk profile</span>
        {[
          { label: 'Sortino ratio', value: sortino, color: '#1a1813' },
          { label: 'Volatility (ann.)', value: stats.volatilityAnn > 0 ? `${stats.volatilityAnn.toFixed(1)}%` : '—', color: '#1a1813' },
          { label: 'Recovery factor', value: recoveryFactor, color: '#1a1813' },
          { label: 'Expectancy', value: stats.expectancy !== 0 ? `${stats.expectancy >= 0 ? '+' : ''}$${Math.abs(stats.expectancy).toLocaleString('en-US', { maximumFractionDigits: 0 })} / trade` : '—', color: stats.expectancy >= 0 ? '#1f9d55' : '#df5338' },
          { label: 'Avg hold time', value: stats.avgHoldTimeDays > 0 ? `${stats.avgHoldTimeDays.toFixed(1)} days` : '—', color: '#1a1813' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14 }}>
            <span style={{ color: '#8c8a81' }}>{row.label}</span>
            <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
