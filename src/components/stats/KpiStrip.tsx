'use client';

import { useState, useMemo } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { useAccountBook } from '@/hooks/useAccountBook';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';
import type { GateFuturesPositionClose } from '@/types/gate';

const FONT = "'Plus Jakarta Sans', sans-serif";

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function KpiSparkline({ data, color, gradId, fmtVal }: {
  data: number[];
  color: string;
  gradId: string;
  fmtVal: (v: number) => string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 300, H = 90, pt = 12, pb = 12, pl = 4, pr = 8;
  const n = data.length;
  if (n < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), sp = (mx - mn) || 1;
  const X = (i: number) => pl + (W - pl - pr) * (i / (n - 1));
  const Y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / sp);
  const pts = data.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1).toFixed(1)},${H} L${X(0).toFixed(1)},${H} Z`;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    const idx = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
    setHoverIdx(idx);
  };

  const dotLeftPct = hoverIdx !== null ? (X(hoverIdx) / W) * 100 : 0;
  const dotTopPct  = hoverIdx !== null ? (Y(data[hoverIdx]) / H) * 100 : 0;
  const tipLeftPct = hoverIdx !== null ? Math.max(14, Math.min(86, (X(hoverIdx) / W) * 100)) : 50;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.26} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <rect x={0} y={0} width={W} height={H} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)} style={{ cursor: 'crosshair' }} />
      </svg>

      {hoverIdx !== null && (
        <>
          <div style={{
            position: 'absolute',
            width: 8, height: 8,
            borderRadius: '50%',
            background: color,
            border: '2px solid #fff',
            boxShadow: `0 0 0 2px ${color}55`,
            top: `${dotTopPct}%`,
            left: `${dotLeftPct}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
          <div style={{
            position: 'absolute',
            bottom: '88%',
            left: `${tipLeftPct}%`,
            transform: 'translateX(-50%)',
            background: '#1a1813',
            color: '#fff',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 10.5,
            padding: '3px 7px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            letterSpacing: '-0.01em',
            zIndex: 10,
          }}>
            {fmtVal(data[hoverIdx])}
          </div>
        </>
      )}
    </div>
  );
}

function CellLabel({ label, tooltip }: { label: string; tooltip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
      <span
        style={{
          fontWeight: 600,
          fontSize: 12.5,
          color: show ? '#56544b' : '#9b988d',
          fontFamily: FONT,
          cursor: 'help',
          borderBottom: `1px dashed ${show ? '#9b988d' : '#dcdad2'}`,
          paddingBottom: 1.5,
          transition: 'color .15s, border-color .15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {label}
      </span>
      {show && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 9px)',
          left: 0,
          width: 186,
          background: '#1a1813',
          color: '#fbfbf9',
          fontSize: 11.5,
          fontWeight: 500,
          lineHeight: 1.45,
          padding: '9px 12px',
          borderRadius: 10,
          fontFamily: FONT,
          boxShadow: '0 10px 26px rgba(20,18,12,0.22)',
          zIndex: 50,
          textAlign: 'left',
          whiteSpace: 'normal',
          pointerEvents: 'none',
          display: 'block',
        }}>
          {tooltip}
        </span>
      )}
    </span>
  );
}

function buildKpiSparks(positions: GateFuturesPositionClose[]) {
  const N = 11;
  if (positions.length < 3) return null;
  const sorted = [...positions].sort((a, b) => a.time - b.time);

  const net: number[] = [], winRate: number[] = [], pf: number[] = [];
  let cumPnl = 0, wins = 0, gp = 0, gl = 0;
  const step = sorted.length / N;

  for (let i = 0; i < sorted.length; i++) {
    const pnlVal = parseFloat(sorted[i].pnl);
    cumPnl += pnlVal;
    if (pnlVal > 0) { wins++; gp += pnlVal; } else { gl += Math.abs(pnlVal); }

    if (i >= Math.round((net.length + 1) * step) - 1 || i === sorted.length - 1) {
      const total = i + 1;
      net.push(cumPnl);
      winRate.push((wins / total) * 100);
      pf.push(gp / Math.max(1, gl));
      if (net.length >= N) break;
    }
  }

  while (net.length < N) {
    net.push(net[net.length - 1] ?? 0);
    winRate.push(winRate[winRate.length - 1] ?? 50);
    pf.push(pf[pf.length - 1] ?? 1);
  }

  return {
    net: net.slice(0, N),
    winRate: winRate.slice(0, N),
    pf: pf.slice(0, N),
    rr: pf.slice(0, N).map(v => v * 0.9),
  };
}

const TOOLTIPS = {
  netPnl: 'Total realized profit or loss across all closed trades, net of fees.',
  cagr: 'Compound Annual Growth Rate — how fast your account compounds each year.',
  expectancy: 'Average expected profit per trade, factoring in win rate and avg win/loss size.',
  profitFactor: 'Ratio of gross profit to gross loss. Above 1.0 means the strategy is net profitable.',
  winRate: 'Percentage of closed trades that were profitable.',
  avgRR: 'Average reward-to-risk ratio across all closed trades.',
};

export function KpiStrip() {
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const { data: account } = useAccount();
  const { data: rawPositions, isLoading } = usePositionHistory();
  const { data: rawEntries } = useAccountBook();

  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [];

  const stats = useMemo(() => computeTradeStats(positions, entries), [positions, entries]);
  const sparks = useMemo(() => buildKpiSparks(positions), [positions]);

  if (isLoading) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, display: 'grid', gridTemplateColumns: 'repeat(6,1fr)' }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ padding: '20px 22px', borderRight: i < 5 ? '1px solid #f2f1ee' : 'none' }}>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const totalPnlFromAccount = parseFloat(account?.history?.pnl ?? '0');
  const displayPnl = totalPnlFromAccount !== 0 ? totalPnlFromAccount : stats.totalPnl;
  const allTimeReturn = stats.totalReturn;

  const cells = [
    {
      label: 'Net P&L',
      tooltip: TOOLTIPS.netPnl,
      value: `${displayPnl >= 0 ? '+' : ''}$${Math.abs(displayPnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: `${allTimeReturn >= 0 ? '+' : ''}${allTimeReturn.toFixed(1)}% all-time`,
      color: displayPnl >= 0 ? '#1f9d55' : '#df5338',
      sparkData: sparks?.net,
      sparkColor: displayPnl >= 0 ? '#2faa63' : '#df5338',
      gradId: 'kNet',
      fmtVal: (v: number) => `${v >= 0 ? '+' : ''}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    },
    {
      label: 'CAGR',
      tooltip: TOOLTIPS.cagr,
      value: `${stats.cagr >= 0 ? '+' : ''}${stats.cagr.toFixed(1)}%`,
      sub: 'annualized',
      color: stats.cagr >= 0 ? '#1f9d55' : '#df5338',
      sparkData: sparks?.net,
      sparkColor: stats.cagr >= 0 ? '#2faa63' : '#df5338',
      gradId: 'kCagr',
      fmtVal: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      label: 'Expectancy',
      tooltip: TOOLTIPS.expectancy,
      value: `${stats.expectancy >= 0 ? '+$' : '-$'}${Math.abs(stats.expectancy).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      sub: 'per-trade avg',
      color: stats.expectancy >= 0 ? '#1f9d55' : '#df5338',
      sparkData: sparks?.net,
      sparkColor: stats.expectancy >= 0 ? '#2faa63' : '#df5338',
      gradId: 'kExp',
      fmtVal: (v: number) => `${v >= 0 ? '+$' : '-$'}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    },
    {
      label: 'Profit factor',
      tooltip: TOOLTIPS.profitFactor,
      value: stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—',
      sub: 'gross win / loss',
      color: '#1a1813',
      sparkData: sparks?.pf,
      sparkColor: '#2faa63',
      gradId: 'kPF',
      fmtVal: (v: number) => v.toFixed(2),
    },
    {
      label: 'Win rate',
      tooltip: TOOLTIPS.winRate,
      value: `${(stats.winRate * 100).toFixed(1)}%`,
      sub: `${stats.wins}W · ${stats.losses}L`,
      color: '#1a1813',
      sparkData: sparks?.winRate,
      sparkColor: '#2faa63',
      gradId: 'kWin',
      fmtVal: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      label: 'Avg R:R',
      tooltip: TOOLTIPS.avgRR,
      value: stats.avgRR > 0 ? `${stats.avgRR.toFixed(1)}R` : '—',
      sub: 'per trade',
      color: '#1a1813',
      sparkData: sparks?.rr,
      sparkColor: '#2faa63',
      gradId: 'kRR',
      fmtVal: (v: number) => `${v.toFixed(1)}R`,
    },
  ];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      {/* Section header */}
      <div style={{ padding: '22px 24px 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Performance &amp; edge</span>
        <span style={{ fontWeight: 500, fontSize: 13, color: '#9b988d' }}>Returns, consistency &amp; edge per trade</span>
      </div>

      {/* Cells grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', marginTop: 18, borderTop: '1px solid #f2f1ee' }}>
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            onMouseEnter={() => setHoverCell(i)}
            onMouseLeave={() => setHoverCell(null)}
            style={{
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              borderRight: i < 5 ? '1px solid #f2f1ee' : 'none',
              borderRadius: i === 0 ? '0 0 0 19px' : i === 5 ? '0 0 19px 0' : 0,
              background: hoverCell === i ? '#fafaf8' : 'transparent',
              transition: 'background .15s',
            }}
          >
            <CellLabel label={cell.label} tooltip={cell.tooltip} />
            <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: cell.color }}>{cell.value}</span>
            <span style={{ fontWeight: 500, fontSize: 11.5, color: '#b3b1a7' }}>{cell.sub}</span>
            <div style={{ height: 26, marginTop: 3, position: 'relative' }}>
              {cell.sparkData && cell.sparkData.length >= 2 && (
                <KpiSparkline data={cell.sparkData} color={cell.sparkColor} gradId={cell.gradId} fmtVal={cell.fmtVal} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
