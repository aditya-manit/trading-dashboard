'use client';

import { useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';

// Data-URI SVG motifs — each tinted to its card's hue
const SVG_BARS = "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='150'%3E%3Cg%20fill='%234a73c8'%20opacity='0.15'%3E%3Crect%20x='128'%20y='116'%20width='18'%20height='34'%20rx='3'/%3E%3Crect%20x='156'%20y='92'%20width='18'%20height='58'%20rx='3'/%3E%3Crect%20x='184'%20y='66'%20width='18'%20height='84'%20rx='3'/%3E%3Crect%20x='212'%20y='34'%20width='18'%20height='116'%20rx='3'/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_STRIPES = "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='150'%3E%3Cg%20stroke='%238366cc'%20stroke-width='9'%20opacity='0.12'%3E%3Cline%20x1='90'%20y1='150'%20x2='240'%20y2='0'/%3E%3Cline%20x1='130'%20y1='150'%20x2='240'%20y2='40'/%3E%3Cline%20x1='170'%20y1='150'%20x2='240'%20y2='80'/%3E%3Cline%20x1='210'%20y1='150'%20x2='240'%20y2='120'/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_DOTS = "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='150'%3E%3Cg%20fill='%23cc6b9c'%20opacity='0.2'%3E%3Ccircle%20cx='156'%20cy='96'%20r='3.2'/%3E%3Ccircle%20cx='180'%20cy='96'%20r='3.2'/%3E%3Ccircle%20cx='204'%20cy='96'%20r='3.2'/%3E%3Ccircle%20cx='228'%20cy='96'%20r='3.2'/%3E%3Ccircle%20cx='156'%20cy='118'%20r='3.2'/%3E%3Ccircle%20cx='180'%20cy='118'%20r='3.2'/%3E%3Ccircle%20cx='204'%20cy='118'%20r='3.2'/%3E%3Ccircle%20cx='228'%20cy='118'%20r='3.2'/%3E%3Ccircle%20cx='156'%20cy='140'%20r='3.2'/%3E%3Ccircle%20cx='180'%20cy='140'%20r='3.2'/%3E%3Ccircle%20cx='204'%20cy='140'%20r='3.2'/%3E%3Ccircle%20cx='228'%20cy='140'%20r='3.2'/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_RINGS = "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='150'%3E%3Cg%20fill='none'%20stroke='%233f9e6b'%20stroke-width='1.4'%20opacity='0.4'%3E%3Ccircle%20cx='208'%20cy='144'%20r='24'/%3E%3Ccircle%20cx='208'%20cy='144'%20r='48'/%3E%3Ccircle%20cx='208'%20cy='144'%20r='74'/%3E%3Ccircle%20cx='208'%20cy='144'%20r='102'/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";

const SHEEN = 'radial-gradient(150px 130px at 84% 2%,rgba(255,255,255,0.72),transparent 60%)';
const CARD_STYLE = { display: 'flex', flexDirection: 'column' as const, gap: 6, minHeight: 128, justifyContent: 'space-between', position: 'relative' as const, overflow: 'hidden', borderRadius: 18, padding: '20px 22px' };

export function HighlightCards() {
  const { data: raw, isLoading } = usePositionHistory();
  const positions = Array.isArray(raw) ? raw : [];
  const stats = useMemo(() => computeTradeStats(positions, []), [positions]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-[18px]" />)}
      </div>
    );
  }

  const bestMonthPnl = stats.bestMonth?.pnl ?? 0;
  const avgDailyFormatted = stats.avgDailyPnl90;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
      {/* Blue — Best month — rising bars */}
      <div style={{ ...CARD_STYLE, background: `${SVG_BARS},${SHEEN},linear-gradient(140deg,#ecf3ff,#dbe9ff)` }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#5b6b8a' }}>Best month</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#1c2c4a' }}>
            {bestMonthPnl >= 0 ? '+' : ''}{bestMonthPnl === 0 ? '—' : `$${Math.abs(bestMonthPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </div>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#7385a8' }}>{stats.bestMonth?.label ?? 'No data'}</span>
        </div>
      </div>

      {/* Purple — Win streak — diagonal stripes */}
      <div style={{ ...CARD_STYLE, background: `${SVG_STRIPES},${SHEEN},linear-gradient(140deg,#f2ecff,#e6dbff)` }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#6f5b9a' }}>Best win streak</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#3a2c5a' }}>
            {stats.winStreak ? `${stats.winStreak.count} trades` : '—'}
          </div>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#8473a8' }}>
            {stats.winStreak ? `${stats.winStreak.startDate} – ${stats.winStreak.endDate}` : 'No streak yet'}
          </span>
        </div>
      </div>

      {/* Pink — Most traded — dot grid */}
      <div style={{ ...CARD_STYLE, background: `${SVG_DOTS},${SHEEN},linear-gradient(140deg,#ffeef4,#ffdfeb)` }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#a05b77' }}>Most traded</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#5a2c44' }}>BTC/USDT.P</div>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#a87388' }}>100% of volume</span>
        </div>
      </div>

      {/* Green — Avg daily P&L — concentric rings */}
      <div style={{ ...CARD_STYLE, background: `${SVG_RINGS},${SHEEN},linear-gradient(140deg,#eafaf0,#d6f4e2)` }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#3f8a5f' }}>Avg daily P&L</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#1f5a3a' }}>
            {avgDailyFormatted >= 0 ? '+' : '−'}${Math.abs(avgDailyFormatted).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#4f9a6f' }}>trailing 90 days</span>
        </div>
      </div>
    </div>
  );
}
