'use client';

import { useState, useMemo } from 'react';
import { useAccountBook } from '@/hooks/useAccountBook';
import { useAccount } from '@/hooks/useAccount';
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
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const [range, setRange] = useState<Range>('ALL');
  const [hover, setHover] = useState<number | null>(null);

  const currentBalance = parseFloat(account?.total ?? '0');
  const currentTs = Math.floor(Date.now() / 1000);

  // Build chart data then append current live balance as final point
  const data = useMemo(() => {
    const pts = buildEquityData(entries, range);
    if (!pts.length) return [];
    // Append current balance only if it's newer than the last entry and different
    if (currentBalance > 0) {
      const last = pts[pts.length - 1];
      if (currentTs > last.time + 60) {
        return [...pts, { time: currentTs, balance: currentBalance }];
      }
    }
    return pts;
  }, [entries, range, currentBalance, currentTs]);

  const firstBal = data[0]?.balance ?? 0;
  const lastBal = data[data.length - 1]?.balance ?? 0;
  const changePct = firstBal > 0 ? ((lastBal - firstBal) / firstBal) * 100 : 0;

  if (!data.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Account growth</span>
        </div>
        <div style={{ width: '100%', aspectRatio: '1000/300', background: '#fafaf8', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#b3b1a7', fontSize: 14, fontWeight: 600 }}>Loading equity data…</span>
        </div>
      </div>
    );
  }

  const n = data.length;
  const isUp = data.length >= 2 ? data[data.length - 1].balance >= data[0].balance : true;
  const color = isUp ? GREEN : RED;

  const vals = data.map(p => p.balance);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const span = (mx - mn) || 1;
  mn -= span * 0.12; mx += span * 0.08;

  const X = (i: number) => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
  const Y = (v: number) => padT + (H - padT - padB) * (1 - (v - mn) / (mx - mn));
  const pts = data.map((p, i) => ({ x: X(i), y: Y(p.balance) }));
  const line = smoothPath(pts);
  const area = line + ` L${X(n - 1).toFixed(1)},${H - padB} L${X(0).toFixed(1)},${H - padB} Z`;

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
    const tw = 168, th = 52;
    let tx = hx + 14;
    if (tx + tw > W - padR) tx = hx - 14 - tw;
    const ty = Math.max(padT, hy - th - 12);
    const isNow = hover === n - 1 && data[hover].time === currentTs;
    hoverEls.push(
      <line key="hl" x1={hx} x2={hx} y1={padT} y2={H - padB} stroke={color} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.5} />,
      <circle key="hc" cx={hx} cy={hy} r={5.5} fill={color} stroke="#fff" strokeWidth={2.5} />,
      <g key="tt" filter="url(#ttShadow)">
        <rect x={tx} y={ty} width={tw} height={th} rx={10} fill="#fff" stroke="#eceae5" />
        <text x={tx + 15} y={ty + 21} fill="#9b988d" fontSize={13} fontWeight={600} fontFamily={FONT}>
          {isNow ? 'Live · Now' : fmtDate(data[hover].time)}
        </text>
        <text x={tx + 15} y={ty + 41} fill="#1a1813" fontSize={18} fontWeight={800} fontFamily={FONT}>{fmt(data[hover].balance)}</text>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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

      <div style={{ width: '100%', aspectRatio: '1000/300' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id="gradEq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.20} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id="ttShadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx={0} dy={4} stdDeviation={7} floodColor="rgba(20,20,12,0.14)" />
            </filter>
          </defs>
          {grids}
          <path d={area} fill="url(#gradEq)" />
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
