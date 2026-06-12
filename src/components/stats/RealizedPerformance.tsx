'use client';

import { useMemo } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { computeTradeStats } from '@/lib/trade-stats';
import { Skeleton } from '@/components/ui/skeleton';

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

function Sparkline({ data, color, gradId }: { data: number[]; color: string; gradId: string }) {
  const W = 300, H = 90, pt = 12, pb = 12, pl = 4, pr = 8;
  const n = data.length;
  if (n < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data);
  const sp = (mx - mn) || 1;
  const X = (i: number) => pl + (W - pl - pr) * (i / (n - 1));
  const Y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / sp);
  const pts = data.map((v, i) => ({ x: X(i), y: Y(v) }));
  const line = smoothPath(pts);
  const area = line + ` L${X(n - 1).toFixed(1)},${H} L${X(0).toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.26} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RealizedPerformance() {
  const { data: raw, isLoading } = usePositionHistory();
  const positions = Array.isArray(raw) ? raw : [];
  const stats = useMemo(() => computeTradeStats(positions, []), [positions]);

  if (isLoading) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px' }}>
        <Skeleton className="h-8 w-48 mb-4" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { grossProfit, grossLoss, profitFactor } = stats;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #f0efec', borderRadius: 20, padding: '24px 26px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em', color: '#1a1813' }}>Realized performance</span>
          <span style={{ fontWeight: 500, fontSize: 13, color: '#9b988d' }}>Closed trades · all time</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13, color: '#3a3a34', background: '#f4f4f2', border: '1px solid #ececea', padding: '8px 13px', borderRadius: 10 }}>
          Profit factor <span style={{ color: '#1f9d55' }}>{profitFactor.toFixed(2)}</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ background: '#fafaf8', border: '1px solid #f0efec', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#9b988d' }}>Gross profit</span>
            <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#16140f' }}>
              ${grossProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: '#1f9d55' }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 6, background: '#e9f6ee', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>▲</span>
              {stats.wins} winning trades
            </span>
          </div>
          <div style={{ width: '46%', height: 74, alignSelf: 'center' }}>
            <Sparkline data={stats.profitSparkline} color="#2faa63" gradId="spUp" />
          </div>
        </div>

        <div style={{ background: '#fafaf8', border: '1px solid #f0efec', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#9b988d' }}>Gross loss</span>
            <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#16140f' }}>
              ${grossLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12.5, color: '#df5338' }}>
              <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 6, background: '#fbeae6', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>▼</span>
              {stats.losses} losing trades
            </span>
          </div>
          <div style={{ width: '46%', height: 74, alignSelf: 'center' }}>
            <Sparkline data={stats.lossSparkline} color="#df5338" gradId="spDown" />
          </div>
        </div>
      </div>
    </div>
  );
}
