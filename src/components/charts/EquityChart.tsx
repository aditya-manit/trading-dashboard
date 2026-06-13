'use client';

import { useState, useMemo } from 'react';
import { useAccountBook } from '@/hooks/useAccountBook';
import { useAccount } from '@/hooks/useAccount';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { buildEquityData } from '@/lib/trade-stats';

type Range = '1M' | '3M' | '6M' | '1Y' | 'ALL';

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x},${pts[0].y}` : '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

const W = 1000, H = 300, padL = 8, padR = 8, padT = 24, padB = 30;
const GREEN = '#2faa63';
const RED   = '#df5338';
const FONT = "'Plus Jakarta Sans', sans-serif";

function fmt(v: number) { return '$' + Math.round(v).toLocaleString('en-US'); }
function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EquityChart() {
  const { data: rawEntries } = useAccountBook();
  const { data: account } = useAccount();
  const { data: btcCandles } = useBtcCandles(365);
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const [range, setRange] = useState<Range>('ALL');
  const [hover, setHover] = useState<number | null>(null);
  const [benchOn, setBenchOn] = useState(false);

  const currentBalance = parseFloat(account?.total ?? '0');
  const currentTs = Math.floor(Date.now() / 1000);

  const data = useMemo(() => {
    const pts = buildEquityData(entries, range);
    if (!pts.length) return [];
    if (currentBalance > 0) {
      const last = pts[pts.length - 1];
      if (currentTs > last.time + 60) {
        return [...pts, { time: currentTs, balance: currentBalance }];
      }
    }
    return pts;
  }, [entries, range, currentBalance, currentTs]);

  // BTC buy & hold benchmark line
  const benchLine = useMemo(() => {
    if (!benchOn || !btcCandles || !btcCandles.length || data.length < 2) return null;
    const candles = [...btcCandles].sort((a, b) => a.t - b.t);

    const findBtcPrice = (ts: number): number => {
      let best = candles[0], bestDiff = Math.abs(ts - candles[0].t);
      for (const c of candles) {
        const d = Math.abs(ts - c.t);
        if (d < bestDiff) { bestDiff = d; best = c; }
      }
      return parseFloat(best.c) || 0;
    };

    const initPrice = findBtcPrice(data[0].time);
    if (!initPrice) return null;
    const btcAmt = data[0].balance / initPrice;
    return data.map(pt => ({ time: pt.time, value: btcAmt * findBtcPrice(pt.time) }));
  }, [benchOn, btcCandles, data]);

  const firstBal = data[0]?.balance ?? 0;
  const lastBal = data[data.length - 1]?.balance ?? 0;
  const changePct = firstBal > 0 ? ((lastBal - firstBal) / firstBal) * 100 : 0;

  if (!data.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Account growth</span>
        </div>
        <div style={{ width: '100%', aspectRatio: '1000/300' }}>
          <svg viewBox="0 0 1000 300" style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              <linearGradient id="skelShimmer" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#f0efec" stopOpacity={1} />
                <stop offset="45%"  stopColor="#e8e6e1" stopOpacity={1} />
                <stop offset="55%"  stopColor="#f5f4f0" stopOpacity={1} />
                <stop offset="100%" stopColor="#f0efec" stopOpacity={1} />
                <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="2 0" dur="1.6s" repeatCount="indefinite" />
              </linearGradient>
              <linearGradient id="skelFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#e8e6e1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#e8e6e1" stopOpacity={0} />
              </linearGradient>
              <clipPath id="skelClip">
                <rect x="8" y="24" width="984" height="246" />
              </clipPath>
            </defs>
            {[0.18, 0.44, 0.70, 0.96].map((t, i) => (
              <line key={i} x1={8} x2={992} y1={t * 270} y2={t * 270} stroke="#f0efec" strokeWidth={1.5} />
            ))}
            {[0.18, 0.44, 0.70, 0.96].map((t, i) => (
              <rect key={i} x={8} y={t * 270 - 14} width={62} height={11} rx={5} fill="url(#skelShimmer)" />
            ))}
            <path
              d="M8,210 C80,195 140,175 200,158 C260,140 300,155 360,138 C420,120 460,100 520,88 C580,75 630,92 690,78 C740,66 800,55 860,48 C900,44 940,50 992,42 L992,270 L8,270 Z"
              fill="url(#skelFill)" clipPath="url(#skelClip)"
            />
            <path
              d="M8,210 C80,195 140,175 200,158 C260,140 300,155 360,138 C420,120 460,100 520,88 C580,75 630,92 690,78 C740,66 800,55 860,48 C900,44 940,50 992,42"
              fill="none" stroke="url(#skelShimmer)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
            />
            {[8, 248, 496, 744, 950].map((x, i) => (
              <rect key={i} x={i === 4 ? x - 28 : x} y={278} width={i === 0 ? 52 : i === 4 ? 28 : 44} height={11} rx={5} fill="url(#skelShimmer)" />
            ))}
          </svg>
        </div>
      </div>
    );
  }

  const n = data.length;
  const isUp = data.length >= 2 ? data[data.length - 1].balance >= data[0].balance : true;
  const color = isUp ? GREEN : RED;

  // Y scale includes benchmark so both lines stay in view
  const vals = data.map(p => p.balance);
  if (benchLine) benchLine.forEach(p => vals.push(p.value));
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const span = (mx - mn) || 1;
  mn -= span * 0.12; mx += span * 0.08;

  const X = (i: number) => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
  const Y = (v: number) => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));
  const pts = data.map((p, i) => ({ x: X(i), y: Y(p.balance) }));
  const line = smoothPath(pts);
  const area = line + ` L${X(n - 1).toFixed(1)},${H - padB} L${X(0).toFixed(1)},${H - padB} Z`;

  const benchPts = benchLine ? benchLine.map((pt, i) => ({ x: X(i), y: Y(pt.value) })) : null;
  const benchPath = benchPts ? smoothPath(benchPts) : null;

  const grids = [0, 0.33, 0.66, 1].map((t, k) => {
    const gv = mx - (mx - mn) * t, gy = Y(gv);
    return (
      <g key={k}>
        <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="rgba(20,20,12,0.05)" strokeWidth={1} />
        <text x={padL + 2} y={gy - 6} fill="#b6b4aa" fontSize={13} fontWeight={600} fontFamily={FONT}>{fmt(gv)}</text>
      </g>
    );
  });

  const xticks = [0, 0.25, 0.5, 0.75, 1].map((t, k) => {
    const idx = Math.round(t * (n - 1)), xx = X(idx);
    const anchor = k === 0 ? 'start' : k === 4 ? 'end' : 'middle';
    return (
      <text key={k} x={xx} y={H - 6} fill="#b6b4aa" fontSize={13} fontWeight={600} textAnchor={anchor} fontFamily={FONT}>
        {k === 4 ? 'Now' : fmtDate(data[idx].time)}
      </text>
    );
  });

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    const idx = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
    if (idx !== hover) setHover(idx);
  };

  const hoverEls: React.ReactNode[] = [];
  if (hover != null && hover >= 0 && hover < n) {
    const hx = X(hover), hy = Y(data[hover].balance);
    const tw = 176;
    const hbv = benchLine ? benchLine[hover].value : null;
    const th = hbv ? 78 : 52;
    let tx = hx + 14;
    if (tx + tw > W - padR) tx = hx - 14 - tw;
    const ty = Math.max(padT, hy - th - 12);
    const isNow = hover === n - 1 && data[hover].time === currentTs;
    const delta = hbv ? data[hover].balance - hbv : 0;

    hoverEls.push(
      <line key="hl" x1={hx} x2={hx} y1={padT} y2={H - padB} stroke={color} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.5} />,
      <circle key="hc" cx={hx} cy={hy} r={5.5} fill={color} stroke="#fff" strokeWidth={2.5} />,
    );
    if (hbv) {
      hoverEls.push(
        <circle key="hbc" cx={hx} cy={Y(hbv)} r={4} fill="#9b8cd9" stroke="#fff" strokeWidth={2} />
      );
    }
    hoverEls.push(
      <g key="tt" filter="url(#ttShadow)">
        <rect x={tx} y={ty} width={tw} height={th} rx={10} fill="#fff" stroke="#eceae5" />
        <text x={tx + 14} y={ty + 20} fill="#9b988d" fontSize={12} fontWeight={600} fontFamily={FONT}>
          {isNow ? 'Live · Now' : fmtDate(data[hover].time)}
        </text>
        <text x={tx + 14} y={ty + 40} fill="#1a1813" fontSize={18} fontWeight={800} fontFamily={FONT}>{fmt(data[hover].balance)}</text>
        {hbv && (
          <>
            <text x={tx + 14} y={ty + 58} fill="#6a45c4" fontSize={12} fontWeight={600} fontFamily={FONT}>BTC hold: {fmt(hbv)}</text>
            <text x={tx + 14} y={ty + 74} fill={delta >= 0 ? '#1f9d55' : '#df5338'} fontSize={11} fontWeight={700} fontFamily={FONT}>
              {delta >= 0 ? '+' : ''}{fmt(delta)} vs hold
            </text>
          </>
        )}
      </g>
    );
  }

  const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'ALL'];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Account growth</span>
          {changePct !== 0 && (
            <span style={{ fontWeight: 700, fontSize: 13, color: isUp ? '#1f9d55' : '#df5338', background: isUp ? '#e9f6ee' : '#fbeae6', padding: '5px 11px', borderRadius: 8 }}>
              {isUp ? '+' : ''}{changePct.toFixed(1)}% this period
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
          {/* BTC HODL benchmark toggle */}
          <button
            onClick={() => setBenchOn(b => !b)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 12px', borderRadius: 9,
              border: `1px solid ${benchOn ? '#cdbcff' : '#ececea'}`,
              background: benchOn ? '#f3eefe' : '#fff',
              color: benchOn ? '#6a45c4' : '#9b988d',
              fontFamily: FONT, fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <span style={{
              width: 15, height: 15, borderRadius: 4, flexShrink: 0,
              border: `1.5px solid ${benchOn ? '#7c5cff' : '#cfccc4'}`,
              background: benchOn ? '#7c5cff' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {benchOn && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 3.5 3.5 6 8 1"/>
                </svg>
              )}
            </span>
            vs BTC HODL
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>Connected</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: '#2f8a55', background: '#eaf6ef', padding: '5px 10px', borderRadius: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2faa63', display: 'inline-block' }} />
              Gate.io
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3, background: '#f4f4f2', borderRadius: 11, padding: 4, border: '1px solid #ececea' }}>
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => { setRange(r); setHover(null); }}
                style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', background: range === r ? '#ffffff' : 'transparent', color: range === r ? '#1a1813' : '#9b988d', boxShadow: range === r ? '0 1px 2px rgba(20,20,12,0.1)' : 'none', transition: 'all .15s' }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend row — HTML div so it never overlaps SVG grid labels */}
      {benchOn && benchLine && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, color: '#9b988d', fontFamily: FONT }}>
            <span style={{ width: 18, height: 2.5, background: color, borderRadius: 2, display: 'inline-block' }} />
            You
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, color: '#9b988d', fontFamily: FONT }}>
            <span style={{ width: 18, display: 'inline-block', borderTop: '2px dashed #9b8cd9' }} />
            BTC buy &amp; hold
          </span>
        </div>
      )}

      <div style={{ width: '100%', aspectRatio: '1000/300' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="gradEq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.20} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id="ttShadow" x="-30%" y="-30%" width="160%" height="200%">
              <feDropShadow dx={0} dy={4} stdDeviation={7} floodColor="rgba(20,20,12,0.14)" />
            </filter>
          </defs>
          {grids}
          <path d={area} fill="url(#gradEq)" />
          {benchPath && (
            <path d={benchPath} fill="none" stroke="#9b8cd9" strokeWidth={2} strokeDasharray="5 5" opacity={0.9} />
          )}
          <path d={line} fill="none" stroke={color} strokeWidth={2.75} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={X(n - 1)} cy={Y(data[n - 1].balance)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
          {xticks}
          {hoverEls}
          <rect x={0} y={0} width={W} height={H} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)} style={{ cursor: 'crosshair' }} />
        </svg>
      </div>
    </div>
  );
}
