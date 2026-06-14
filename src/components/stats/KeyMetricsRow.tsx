'use client';

import { useState, useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { useAccountBook } from '@/hooks/useAccountBook';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { TradeDetailDrawer } from '@/components/positions-history/PositionHistoryTable';
import type { GateAccountBookEntry, GateFuturesPositionClose } from '@/types/gate';

const FONT = "'Plus Jakarta Sans', sans-serif";

// ─── LabelWithTooltip ────────────────────────────────────────────────────────

function LabelWithTooltip({ label, tooltip, fontSize = 13.5 }: { label: string; tooltip: string; fontSize?: number }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
      <span
        style={{
          fontWeight: 600,
          fontSize,
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

// ─── ArcGauge ────────────────────────────────────────────────────────────────

function ArcGauge({ value, max, color, maxLabel: maxLabelProp }: { value: number; max: number; color: string; maxLabel?: string }) {
  const frac = Math.min(1, Math.max(0, value / max));
  const maxLabel = maxLabelProp ?? (max >= 100 ? `${max}` : max % 1 === 0 ? `${max}` : max.toFixed(1));
  return (
    <svg viewBox="0 0 100 66" preserveAspectRatio="xMaxYMax meet" style={{ width: '100%', height: '100%', display: 'block' }}>
      {/* Track */}
      <path d="M6,50 A44,44 0 0 1 94,50" fill="none" stroke="#ecebe6" strokeWidth={11} strokeLinecap="round" />
      {/* Value arc */}
      <path
        d="M6,50 A44,44 0 0 1 94,50"
        fill="none"
        stroke={color}
        strokeWidth={11}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${(frac * 100).toFixed(1)} 100`}
      />
      {/* Tick labels — sit 14px below arc endpoints at y=50 */}
      <text x="4" y="64" textAnchor="start" fill="#b3b1a7" fontSize="8.5" fontFamily={FONT} fontWeight="600">0</text>
      <text x="96" y="64" textAnchor="end" fill="#b3b1a7" fontSize="8.5" fontFamily={FONT} fontWeight="600">{maxLabel}</text>
    </svg>
  );
}

// ─── DrawdownChart ────────────────────────────────────────────────────────────

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

function DrawdownChart({ entries }: { entries: GateAccountBookEntry[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { drawdownSeries, filledDates } = useMemo(() => {
    if (entries.length < 2) return { drawdownSeries: [], filledDates: [] as string[] };
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      const day = new Date(e.time * 1000).toISOString().slice(0, 10);
      byDay[day] = parseFloat(e.balance);
    }
    const sortedDays = Object.keys(byDay).sort();
    const filledBalances: number[] = [];
    const filledDates: string[] = [];
    if (sortedDays.length > 0) {
      const start = new Date(sortedDays[0]);
      const end = new Date(sortedDays[sortedDays.length - 1]);
      let lastBal = byDay[sortedDays[0]];
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (byDay[key] !== undefined) lastBal = byDay[key];
        if (lastBal > 0) { filledBalances.push(lastBal); filledDates.push(key); }
      }
    }
    let peak = filledBalances[0] ?? 0;
    const drawdownSeries = filledBalances.map(b => {
      if (b > peak) peak = b;
      return peak > 0 ? ((b - peak) / peak) * 100 : 0;
    });
    return { drawdownSeries, filledDates };
  }, [entries]);

  if (drawdownSeries.length < 2) {
    return <div style={{ width: '100%', height: '100%', background: '#fafaf8', borderRadius: 8 }} />;
  }

  const W = 300, H = 150, pt = 12, pb = 12;
  const n = drawdownSeries.length;
  const mn = Math.min(...drawdownSeries);
  const mx = Math.max(...drawdownSeries, 0);
  const sp = (mx - mn) || 1;
  const X = (i: number) => (W * i) / (n - 1);
  const Y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / sp);
  const pts = drawdownSeries.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${X(n - 1).toFixed(1)},0 L${X(0).toFixed(1)},0 Z`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };

  const leftPct = hoverIdx !== null ? (X(hoverIdx) / W) * 100 : 0;
  const topPct  = hoverIdx !== null ? (Y(drawdownSeries[hoverIdx]) / H) * 100 : 0;
  const tipLeft = Math.max(14, Math.min(86, leftPct));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#df5338" stopOpacity={0}    />
            <stop offset="3%"   stopColor="#df5338" stopOpacity={0.015}/>
            <stop offset="8%"   stopColor="#df5338" stopOpacity={0.04} />
            <stop offset="15%"  stopColor="#df5338" stopOpacity={0.08} />
            <stop offset="30%"  stopColor="#df5338" stopOpacity={0.13} />
            <stop offset="50%"  stopColor="#df5338" stopOpacity={0.22} />
            <stop offset="65%"  stopColor="#df5338" stopOpacity={0.40} />
            <stop offset="80%"  stopColor="#df5338" stopOpacity={0.65} />
            <stop offset="90%"  stopColor="#df5338" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#df5338" stopOpacity={1}    />
          </linearGradient>
          <linearGradient id="ddGrad-mx" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#fff" stopOpacity={0} />
            <stop offset="4%"   stopColor="#fff" stopOpacity={1} />
            <stop offset="96%"  stopColor="#fff" stopOpacity={1} />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id="ddGrad-mask">
            <rect x={0} y={0} width={W} height={H} fill="url(#ddGrad-mx)" />
          </mask>
        </defs>
        {area && <path d={area} fill="url(#ddGrad)" mask="url(#ddGrad-mask)" />}
        <path d={line} fill="none" stroke="#df5338" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Hover overlay — HTML elements match design's buildSpark pattern */}
      <div onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} />
      {hoverIdx !== null && (
        <>
          <div style={{ position: 'absolute', left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: '#df5338', border: '2px solid #fff', boxShadow: '0 0 0 1px #df5338', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: `${tipLeft}%`, bottom: '88%', transform: 'translateX(-50%)', background: '#1a1813', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 6, fontFamily: FONT, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(20,18,12,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span>{drawdownSeries[hoverIdx].toFixed(1)}%</span>
            {filledDates[hoverIdx] && (
              <span style={{ fontSize: 9, fontWeight: 500, color: '#9b988d' }}>
                {new Date(filledDates[hoverIdx]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SmallGaugeCard ───────────────────────────────────────────────────────────

function SmallGaugeCard({ label, tooltip, value, gaugeValue, gaugeMax, gaugeMaxLabel, color, valueColor = '#16140f' }: {
  label: string;
  tooltip: string;
  value: string;
  gaugeValue: number;
  gaugeMax: number;
  gaugeMaxLabel?: string;
  color: string;
  valueColor?: string;
}) {
  return (
    <div style={{
      background: '#fafaf8',
      border: '1px solid #f0efec',
      borderRadius: 15,
      padding: '15px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <LabelWithTooltip label={label} tooltip={tooltip} fontSize={11.5} />
        <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: valueColor }}>{value}</span>
      </div>
      <div style={{ marginTop: 'auto', height: 108 }}>
        <ArcGauge value={gaugeValue} max={gaugeMax} color={color} maxLabel={gaugeMaxLabel} />
      </div>
    </div>
  );
}

// ─── SmallSparkCard ───────────────────────────────────────────────────────────

function SmallSparkCard({ label, tooltip, value, sparkData, sparkDates, color }: {
  label: string;
  tooltip: string;
  value: string;
  sparkData: number[];
  sparkDates?: string[];
  color: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 300, Hs = 90, pt = 12, pb = 12;
  const n = sparkData.length;
  let sparkLine = '';
  let area = '';
  let ptsArr: { x: number; y: number }[] = [];
  if (n >= 2) {
    const mn = Math.min(...sparkData), mx = Math.max(...sparkData), sp = (mx - mn) || 1;
    const X = (i: number) => (W * i) / (n - 1);
    const Y = (v: number) => pt + (Hs - pt - pb) * (1 - (v - mn) / sp);
    ptsArr = sparkData.map((v, i) => ({ x: X(i), y: Y(v) }));
    sparkLine = smoothPath(ptsArr);
    area = `${sparkLine} L${(W).toFixed(1)},${Hs - pb} L0,${Hs - pb} Z`;
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };

  const leftPct = hoverIdx !== null ? (ptsArr[hoverIdx]?.x / W) * 100 : 0;
  const topPct  = hoverIdx !== null ? (ptsArr[hoverIdx]?.y / Hs) * 100 : 0;
  const tipLeft = Math.max(14, Math.min(86, leftPct));
  const hv = hoverIdx !== null ? sparkData[hoverIdx] : null;

  return (
    <div style={{
      background: '#fafaf8',
      border: '1px solid #f0efec',
      borderRadius: 15,
      padding: '15px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <LabelWithTooltip label={label} tooltip={tooltip} fontSize={11.5} />
        <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em', color: '#16140f' }}>{value}</span>
      </div>
      <div style={{ marginTop: 'auto', height: 108, position: 'relative' }}>
        {sparkLine ? (
          <>
            <svg viewBox={`0 0 ${W} ${Hs}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#volGrad)" />
              <path d={sparkLine} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)} style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }} />
            {hoverIdx !== null && (
              <>
                <div style={{ position: 'absolute', left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%,-50%)', width: 8, height: 8, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: `0 0 0 1px ${color}`, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: `${tipLeft}%`, bottom: '88%', transform: 'translateX(-50%)', background: '#1a1813', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '4px 8px', borderRadius: 6, fontFamily: FONT, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(20,18,12,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span>{hv !== null ? `${hv.toFixed(1)}%` : ''}</span>
                  {sparkDates?.[hoverIdx] && (
                    <span style={{ fontSize: 9, fontWeight: 500, color: '#9b988d' }}>
                      {new Date(sparkDates[hoverIdx]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Best/worst helpers ───────────────────────────────────────────────────────

function bwFmtLev(lev: string): string {
  const n = parseFloat(lev);
  return !n ? 'Cross' : `${n}×`;
}
function bwRetPct(p: GateFuturesPositionClose): string {
  const pnl = parseFloat(p.pnl);
  const entry = parseFloat(p.side === 'long' ? p.long_price : p.short_price) || 0;
  const size = Math.abs(parseFloat(p.max_size) || 0);
  const notional = size * 0.0001 * entry;
  const lev = parseFloat(p.leverage) || 0;
  if (lev > 0 && notional > 0) {
    const pct = (pnl / (notional / lev)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }
  return '';
}

// ─── KeyMetricsRow ────────────────────────────────────────────────────────────

export function KeyMetricsRow() {
  const { data: rawPositions, isLoading } = usePositionHistory();
  const { data: rawEntries } = useAccountBook();
  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const stats = useMemo(() => computeTradeStats(positions, entries), [positions, entries]);

  const [drawerTrade, setDrawerTrade] = useState<GateFuturesPositionClose | null>(null);
  const [bestHover, setBestHover] = useState(false);
  const [worstHover, setWorstHover] = useState(false);

  const { bestPos, worstPos } = useMemo(() => {
    if (!positions.length) return { bestPos: null, worstPos: null };
    const sorted = [...positions].sort((a, b) => a.time - b.time);
    const pnls = sorted.map(p => parseFloat(p.pnl));
    return {
      bestPos: sorted[pnls.indexOf(Math.max(...pnls))],
      worstPos: sorted[pnls.indexOf(Math.min(...pnls))],
    };
  }, [positions]);

  // Two health colors only — same as legend
  const HEALTHY = '#2faa63';
  const DOWNSIDE = '#df5338';

  const sortinoColor = stats.sortino >= 1 ? HEALTHY : DOWNSIDE;
  const sharpeColor  = stats.sharpe  >= 1 ? HEALTHY : DOWNSIDE;
  const calmarColor  = stats.calmar  >= 0.5 ? HEALTHY : DOWNSIDE;
  const rorColor     = stats.riskOfRuin < 5 ? HEALTHY : DOWNSIDE;
  const volColor     = stats.volatilityAnn < 100 ? HEALTHY : DOWNSIDE;

  // Rolling 180-day annualized volatility sparkline with dates
  const { volSparkData, volSparkDates } = useMemo(() => {
    if (entries.length < 2) return { volSparkData: [] as number[], volSparkDates: [] as string[] };
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      const day = new Date(e.time * 1000).toISOString().slice(0, 10);
      byDay[day] = parseFloat(e.balance);
    }
    const days = Object.keys(byDay).sort();
    const bals: number[] = [];
    const balDates: string[] = [];
    if (days.length > 0) {
      const start = new Date(days[0]);
      const end = new Date(days[days.length - 1]);
      let last = byDay[days[0]];
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (byDay[key] !== undefined) last = byDay[key];
        if (last > 0) { bals.push(last); balDates.push(key); }
      }
    }
    const returns: number[] = [];
    const returnDates: string[] = [];
    for (let i = 1; i < bals.length; i++) {
      returns.push((bals[i] - bals[i - 1]) / bals[i - 1]);
      returnDates.push(balDates[i]);
    }
    // Rolling 180-day annualized vol at each point
    const WINDOW = 180;
    const rollVol: number[] = [];
    for (let i = 0; i < returns.length; i++) {
      const w = returns.slice(Math.max(0, i - WINDOW + 1), i + 1);
      const mean = w.reduce((s, v) => s + v, 0) / w.length;
      const variance = w.reduce((s, v) => s + (v - mean) ** 2, 0) / w.length;
      rollVol.push(Math.sqrt(variance) * Math.sqrt(365) * 100);
    }
    // Downsample to 26 points, always including the last point
    if (rollVol.length <= 26) return { volSparkData: rollVol, volSparkDates: returnDates };
    const step = Math.floor(rollVol.length / 25);
    const idxs = Array.from({ length: 25 }, (_, i) => i * step);
    const last = rollVol.length - 1;
    if (idxs[idxs.length - 1] !== last) idxs.push(last);
    return {
      volSparkData: idxs.map(i => rollVol[i]),
      volSparkDates: idxs.map(i => returnDates[i]),
    };
  }, [entries]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          {[0, 1].map(i => <Skeleton key={i} className="h-52 rounded-[20px]" />)}
        </div>
        <Skeleton className="h-80 rounded-[20px]" />
      </div>
    );
  }

  const winRate = stats.winRate;
  const circumference = 2 * Math.PI * 52;
  const greenArc = winRate * circumference;

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Section A — 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'stretch' }}>

        {/* Card 1: Win rate donut */}
        <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: 24, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: '#1a1813' }}>Win rate</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26, marginTop: 16, flex: 1 }}>
            <svg viewBox="0 0 120 120" style={{ width: 148, height: 148, flex: '0 0 auto' }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="#f0efeb" strokeWidth="13" />
              <circle
                cx="60" cy="60" r="52"
                fill="none" stroke="#2faa63" strokeWidth="13"
                strokeLinecap="round"
                strokeDasharray={`${greenArc.toFixed(1)} ${(circumference - greenArc).toFixed(1)}`}
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="57" textAnchor="middle" fill="#1a1813" fontSize="24" fontFamily={FONT} fontWeight="800">
                {(winRate * 100).toFixed(1)}%
              </text>
              <text x="60" y="76" textAnchor="middle" fill="#a8a69b" fontSize="11" fontFamily={FONT} fontWeight="600">
                win rate
              </text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
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
          {/* Win / loss split bar — anchored at bottom */}
          <div style={{ marginTop: 'auto', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: '#9b988d' }}>Win / loss split</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#8c8a81' }}>
                <span style={{ color: '#1f9d55' }}>{stats.wins}W</span>
                {' · '}
                <span style={{ color: '#df5338' }}>{stats.losses}L</span>
              </span>
            </div>
            <div style={{ display: 'flex', height: 12, gap: 3 }}>
              <div style={{ width: `${(winRate * 100).toFixed(1)}%`, background: '#2faa63', borderRadius: 99 }} />
              <div style={{ width: `${(100 - winRate * 100).toFixed(1)}%`, background: '#ec6a52', borderRadius: 99 }} />
            </div>
          </div>
        </div>

        {/* Card 2: Best & worst */}
        <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: 24, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', color: '#1a1813' }}>Best &amp; worst</span>
          {/* Best trade card */}
          <div
            onClick={() => bestPos && setDrawerTrade(bestPos)}
            onMouseEnter={() => bestPos && setBestHover(true)}
            onMouseLeave={() => setBestHover(false)}
            style={{
              borderRadius: 14,
              background: bestHover
                ? 'linear-gradient(180deg,rgba(255,255,255,0.68) 0%,rgba(255,255,255,0) 52%),linear-gradient(180deg,#f6fdf8,#cee9d9)'
                : '#f1faf4',
              border: `1px solid ${bestHover ? '#b5d9c6' : '#d3ecdd'}`,
              boxShadow: bestHover ? 'inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
              overflow: 'hidden',
              cursor: bestPos ? 'pointer' : 'default',
              transition: 'background .18s, border-color .18s, box-shadow .18s',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px' }}>
              <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: '#ffffff', border: '1px solid #cfe9da', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1f9d55' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" />
                </svg>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: '#1a1813' }}>BTC/USDT.P</span>
                <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', color: '#1f9d55', background: '#e3f3ea', padding: '3px 7px', borderRadius: 6 }}>BEST</span>
              </div>
              <span style={{ fontWeight: 500, fontSize: 12, color: '#8c8a81' }}>
                {bestPos ? new Date(bestPos.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : stats.bestTrade.date}
              </span>
            </div>
            {/* Stats strip */}
            <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid #d3ecdd' }}>
              {[
                { label: 'Side', value: bestPos?.side === 'long' ? 'Long' : 'Short', color: '#1f9d55' },
                { label: 'Lev', value: bestPos ? bwFmtLev(bestPos.leverage) : '—', color: '#1a1813' },
                { label: 'Return', value: bestPos ? bwRetPct(bestPos) : '—', color: '#1f9d55' },
              ].map((col, i) => (
                <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 13px', borderLeft: i > 0 ? '1px solid #d3ecdd' : 'none' }}>
                  <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#a3a196' }}>{col.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.value}</span>
                </div>
              ))}
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 13px', borderLeft: '1px solid #d3ecdd' }}>
                <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#a3a196' }}>P&L</span>
                <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: '-0.01em', color: '#1f9d55' }}>
                  +${stats.bestTrade.pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          {/* Worst trade card */}
          <div
            onClick={() => worstPos && setDrawerTrade(worstPos)}
            onMouseEnter={() => worstPos && setWorstHover(true)}
            onMouseLeave={() => setWorstHover(false)}
            style={{
              borderRadius: 14,
              background: worstHover
                ? 'linear-gradient(180deg,rgba(255,255,255,0.68) 0%,rgba(255,255,255,0) 52%),linear-gradient(180deg,#fffbfa,#f4ddd5)'
                : '#fcf0ed',
              border: `1px solid ${worstHover ? '#e4c0b0' : '#f3d6cd'}`,
              boxShadow: worstHover ? 'inset 0 1px 0 rgba(255,255,255,0.9)' : 'none',
              overflow: 'hidden',
              cursor: worstPos ? 'pointer' : 'default',
              transition: 'background .18s, border-color .18s, box-shadow .18s',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 15px' }}>
              <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: '#ffffff', border: '1px solid #f3d6cd', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#df5338' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" />
                </svg>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: '#1a1813' }}>BTC/USDT.P</span>
                <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.06em', color: '#df5338', background: '#fbe4de', padding: '3px 7px', borderRadius: 6 }}>WORST</span>
              </div>
              <span style={{ fontWeight: 500, fontSize: 12, color: '#8c8a81' }}>
                {worstPos ? new Date(worstPos.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : stats.worstTrade.date}
              </span>
            </div>
            {/* Stats strip */}
            <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid #f3d6cd' }}>
              {[
                { label: 'Side', value: worstPos?.side === 'long' ? 'Long' : 'Short', color: worstPos?.side === 'long' ? '#1f9d55' : '#df5338' },
                { label: 'Lev', value: worstPos ? bwFmtLev(worstPos.leverage) : '—', color: '#1a1813' },
                { label: 'Return', value: worstPos ? bwRetPct(worstPos) : '—', color: '#df5338' },
              ].map((col, i) => (
                <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 13px', borderLeft: i > 0 ? '1px solid #f3d6cd' : 'none' }}>
                  <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#a3a196' }}>{col.label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: col.color }}>{col.value}</span>
                </div>
              ))}
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 13px', borderLeft: '1px solid #f3d6cd' }}>
                <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: '#a3a196' }}>P&L</span>
                <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: '-0.01em', color: '#df5338' }}>
                  −${Math.abs(stats.worstTrade.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section B — Risk & efficiency */}
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813', display: 'block' }}>Risk &amp; efficiency</span>
            <span style={{ fontWeight: 500, fontSize: 13, color: '#9b988d', display: 'block', marginTop: 3 }}>Drawdown, volatility &amp; risk-adjusted return</span>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
              <span style={{ width: 18, height: 4, borderRadius: 99, background: '#2faa63', display: 'inline-block' }} />Healthy
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 12.5, color: '#8c8a81' }}>
              <span style={{ width: 18, height: 4, borderRadius: 99, background: '#df5338', display: 'inline-block' }} />Downside
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>

          {/* Row 1: MDD hero + Sortino hero */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }}>

            {/* Max Drawdown hero */}
            <div style={{
              background: '#fafaf8',
              border: '1px solid #f0efec',
              borderRadius: 15,
              padding: '22px 26px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 18,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto', maxWidth: '42%' }}>
                <LabelWithTooltip
                  label="Max drawdown"
                  tooltip="Largest peak-to-trough decline in account balance. The deeper this is, the harder recovery becomes."
                />
                <span style={{ fontWeight: 800, fontSize: 46, lineHeight: 1, letterSpacing: '-0.03em', color: '#df5338' }}>
                  {stats.maxDrawdownPct > 0 ? `−${stats.maxDrawdownPct.toFixed(1)}%` : '—'}
                </span>
                <span style={{ fontWeight: 500, fontSize: 12, color: '#b3b1a7' }}>peak to trough{stats.maxDrawdownDate ? ` · ${stats.maxDrawdownDate}` : ''}</span>
              </div>
              <div style={{ flex: 1, height: 150 }}>
                <DrawdownChart entries={entries} />
              </div>
            </div>

            {/* Sortino hero */}
            <div style={{
              background: '#fafaf8',
              border: '1px solid #f0efec',
              borderRadius: 15,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <LabelWithTooltip
                  label="Sortino ratio"
                  tooltip="Like Sharpe but only penalizes downside volatility. Higher is better — it rewards consistent gains without large losses."
                />
                <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 1, letterSpacing: '-0.02em', color: '#16140f' }}>
                  {stats.sortino > 0 ? stats.sortino.toFixed(2) : '—'}
                </span>
                <span style={{ fontWeight: 500, fontSize: 12, color: '#b3b1a7' }}>downside-adjusted</span>
              </div>
              <div style={{ width: '50%', height: 142 }}>
                <ArcGauge value={stats.sortino} max={4} color={sortinoColor} />
              </div>
            </div>
          </div>

          {/* Row 2: 4 small cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            <SmallGaugeCard
              label="Sharpe ratio"
              tooltip="Risk-adjusted return using total volatility. Above 1.0 is good; above 2.0 is excellent for most strategies."
              value={stats.sharpe > 0 ? stats.sharpe.toFixed(2) : '—'}
              gaugeValue={stats.sharpe}
              gaugeMax={3}
              color={sharpeColor}
            />
            <SmallGaugeCard
              label="Calmar ratio"
              tooltip="Annual return divided by max drawdown. Higher means you earn more return per unit of drawdown risk."
              value={stats.calmar > 0 ? stats.calmar.toFixed(2) : '—'}
              gaugeValue={stats.calmar}
              gaugeMax={4}
              color={calmarColor}
            />
            <SmallGaugeCard
              label="Risk of ruin"
              tooltip="Estimated probability of the account reaching zero, given current edge and assuming 2% risk per trade."
              value={stats.riskOfRuin < 0.1 ? '<0.1%' : `${stats.riskOfRuin.toFixed(1)}%`}
              gaugeValue={stats.riskOfRuin}
              gaugeMax={100}
              gaugeMaxLabel="100%"
              color={rorColor}
            />
            <SmallSparkCard
              label="Annualized volatility"
              tooltip="Daily return standard deviation scaled to a full year. Measures how violently your balance swings, regardless of direction."
              value={stats.volatilityAnn > 0 ? `${stats.volatilityAnn.toFixed(1)}%` : '—'}
              sparkData={volSparkData}
              sparkDates={volSparkDates}
              color={volColor}
            />
          </div>
        </div>
      </div>
    </div>

    {drawerTrade && <TradeDetailDrawer p={drawerTrade} onClose={() => setDrawerTrade(null)} />}
    </>
  );
}
