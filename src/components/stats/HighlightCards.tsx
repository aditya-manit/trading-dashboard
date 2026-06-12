'use client';

import { useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';

// Data-URI SVG motifs — exact shapes from design file
const SVG_CALENDAR = "url(\"data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22240%22%20height=%22150%22%3E%3Cg%20transform=%22translate(150,48)%20scale(5)%22%20fill=%22none%22%20stroke=%22%234a73c8%22%20stroke-width=%220.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20opacity=%220.26%22%3E%3Crect%20x=%223%22%20y=%224%22%20width=%2218%22%20height=%2218%22%20rx=%222%22/%3E%3Cline%20x1=%223%22%20y1=%229%22%20x2=%2221%22%20y2=%229%22/%3E%3Cline%20x1=%228%22%20y1=%222%22%20x2=%228%22%20y2=%225%22/%3E%3Cline%20x1=%2216%22%20y1=%222%22%20x2=%2216%22%20y2=%225%22/%3E%3Cpolyline%20points=%229%2014.5%2011%2016.5%2015.5%2012.5%22/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_TROPHY = "url(\"data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22240%22%20height=%22150%22%3E%3Cg%20transform=%22translate(150,46)%20scale(5)%22%20fill=%22none%22%20stroke=%22%238366cc%22%20stroke-width=%220.55%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20opacity=%220.24%22%3E%3Cpath%20d=%22M6%209H4.5a2.5%202.5%200%200%201%200-5H6%22/%3E%3Cpath%20d=%22M18%209h1.5a2.5%202.5%200%200%200%200-5H18%22/%3E%3Cpath%20d=%22M4%2022h16%22/%3E%3Cpath%20d=%22M10%2014.66V17c0%20.55-.47.98-.97%201.21C7.85%2018.75%207%2020.24%207%2022%22/%3E%3Cpath%20d=%22M14%2014.66V17c0%20.55.47.98.97%201.21C16.15%2018.75%2017%2020.24%2017%2022%22/%3E%3Cpath%20d=%22M18%202H6v7a6%206%200%200%200%2012%200V2Z%22/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_DOTS = "url(\"data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22240%22%20height=%22150%22%3E%3Cg%20fill=%22%23cc6b9c%22%20opacity=%220.2%22%3E%3Ccircle%20cx=%22156%22%20cy=%2296%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22180%22%20cy=%2296%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22204%22%20cy=%2296%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22228%22%20cy=%2296%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22156%22%20cy=%22118%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22180%22%20cy=%22118%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22204%22%20cy=%22118%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22228%22%20cy=%22118%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22156%22%20cy=%22140%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22180%22%20cy=%22140%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22204%22%20cy=%22140%22%20r=%223.2%22/%3E%3Ccircle%20cx=%22228%22%20cy=%22140%22%20r=%223.2%22/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";
const SVG_DAILY_BARS = "url(\"data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22240%22%20height=%22150%22%3E%3Cg%20fill=%22%233f9e6b%22%20opacity=%220.16%22%3E%3Crect%20x=%22132%22%20y=%22116%22%20width=%2215%22%20height=%2234%22%20rx=%223%22/%3E%3Crect%20x=%22156%22%20y=%2292%22%20width=%2215%22%20height=%2258%22%20rx=%223%22/%3E%3Crect%20x=%22180%22%20y=%22106%22%20width=%2215%22%20height=%2244%22%20rx=%223%22/%3E%3Crect%20x=%22204%22%20y=%2278%22%20width=%2215%22%20height=%2272%22%20rx=%223%22/%3E%3Crect%20x=%22228%22%20y=%2296%22%20width=%2215%22%20height=%2254%22%20rx=%223%22/%3E%3C/g%3E%3C/svg%3E\") right bottom no-repeat";

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
      {/* Blue — Best month — calendar + checkmark */}
      <div style={{ ...CARD_STYLE, background: `${SVG_CALENDAR},${SHEEN},linear-gradient(140deg,#ecf3ff,#dbe9ff)` }}>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#5b6b8a' }}>Best month</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.02em', color: '#1c2c4a' }}>
            {bestMonthPnl >= 0 ? '+' : ''}{bestMonthPnl === 0 ? '—' : `$${Math.abs(bestMonthPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </div>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#7385a8' }}>{stats.bestMonth?.label ?? 'No data'}</span>
        </div>
      </div>

      {/* Purple — Win streak — trophy */}
      <div style={{ ...CARD_STYLE, background: `${SVG_TROPHY},${SHEEN},linear-gradient(140deg,#f2ecff,#e6dbff)` }}>
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

      {/* Green — Avg daily P&L — daily bars */}
      <div style={{ ...CARD_STYLE, background: `${SVG_DAILY_BARS},${SHEEN},linear-gradient(140deg,#eafaf0,#d6f4e2)` }}>
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
