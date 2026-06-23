'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useHeatmap, useHeatmapHistory, type HeatmapData,
  type HeatSymbol, type HeatModel, type HeatInterval,
} from '@/hooks/useHeatmap';
import { computeHeatmapMetrics, type Cluster } from '@/lib/heatmap-metrics';
import { HoverTip } from '@/components/plan/HoverTip';

const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

const SYMBOLS: HeatSymbol[] = ['BTC', 'ETH', 'SOL'];
const MODELS: HeatModel[] = ['model1', 'model2', 'model3'];
const INTERVALS: HeatInterval[] = ['12h', '24h', '48h', '3d', '1w', '2w', '1mo', '3mo'];

// ---- magma colormap (verbatim from the handoff dc.html) ----
const MAGMA: [number, [number, number, number]][] = [
  [0, [0, 0, 4]], [0.13, [31, 12, 72]], [0.25, [85, 15, 109]], [0.38, [136, 34, 106]],
  [0.5, [186, 54, 85]], [0.62, [227, 89, 51]], [0.75, [249, 140, 10]], [0.87, [249, 201, 50]], [1, [252, 255, 164]],
];
function magma(u: number): [number, number, number] {
  if (u < 0) u = 0; if (u > 1) u = 1;
  for (let i = 1; i < MAGMA.length; i++) {
    if (u <= MAGMA[i][0]) {
      const a = MAGMA[i - 1], b = MAGMA[i], f = (u - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
        Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
        Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
      ];
    }
  }
  return MAGMA[MAGMA.length - 1][1];
}

function fmtVal(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}
function fmtPrice(p: number): string {
  return p >= 1000 ? Math.round(p).toLocaleString('en-US') : p.toFixed(2);
}
function fmtAxisTime(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getDate()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtFullTime(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getDate()} ${mo[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// "Nice" round step so price ticks land on human numbers.
function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 2 ? 2.5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

interface Prepared {
  Y: number; X: number; pMin: number; pMax: number; max: number;
  lkp: Map<number, number>;
  candles: HeatmapData['price_candlesticks'];
  last: number;
}

function prepare(d: HeatmapData): Prepared | null {
  const y = d.y_axis, cs = d.price_candlesticks, dat = d.liquidation_leverage_data;
  if (!y?.length || !cs?.length || !dat?.length) return null;
  const Y = y.length;
  let X = 0, max = 1;
  const lkp = new Map<number, number>();
  for (let k = 0; k < dat.length; k++) {
    const xi = dat[k][0], yi = dat[k][1], v = dat[k][2];
    if (xi + 1 > X) X = xi + 1;
    if (v > max) max = v;
    lkp.set(xi * 100000 + yi, v);
  }
  X = Math.max(X, cs.length);
  return { Y, X, pMin: y[0], pMax: y[Y - 1], max, lkp, candles: cs, last: +cs[cs.length - 1][4] };
}

function drawCanvas(cv: HTMLCanvasElement, p: Prepared, dat: HeatmapData['liquidation_leverage_data']) {
  const cssW = cv.clientWidth, cssH = cv.clientHeight;
  if (!cssW || !cssH) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  const ctx = cv.getContext('2d'); if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cssW, H = cssH, { Y, X, pMin, pMax, max } = p, rng = pMax - pMin || 1;
  const yOf = (price: number) => (pMax - price) / rng * H;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160a26'); bg.addColorStop(1, '#08030f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  const cw = W / X + 1, ch = H / Y + 0.9;
  for (let k = 0; k < dat.length; k++) {
    const c = magma(dat[k][2] / max);
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(dat[k][0] / X * W, H * (1 - (dat[k][1] + 1) / Y), cw, ch);
  }

  // faint price gridlines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
  const gStep = niceStep(rng, 7);
  for (let pr = Math.ceil(pMin / gStep) * gStep; pr < pMax; pr += gStep) {
    const yy = Math.round(yOf(pr)) + 0.5;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
  }

  // candlesticks
  const cs = p.candles, n = cs.length, slot = W / n, cbw = Math.max(2, slot * 0.52);
  for (let i = 0; i < n; i++) {
    const o = +cs[i][1], hi = +cs[i][2], lo = +cs[i][3], c = +cs[i][4], cx = slot * i + slot / 2, up = c >= o;
    ctx.strokeStyle = up ? '#2ad17f' : '#f04866'; ctx.fillStyle = up ? '#2ad17f' : '#f04866'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + 0.5, yOf(hi)); ctx.lineTo(cx + 0.5, yOf(lo)); ctx.stroke();
    const yt = yOf(Math.max(o, c)), yb = yOf(Math.min(o, c));
    ctx.fillRect(cx - cbw / 2, yt, cbw, Math.max(1.3, yb - yt));
  }

  // last-price dashed line
  ctx.strokeStyle = 'rgba(232,228,242,0.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, yOf(p.last)); ctx.lineTo(W, yOf(p.last)); ctx.stroke(); ctx.setLineDash([]);
}

interface Hover { x: number; y: number; w: number; h: number; price: number; lev: number; ts: number }

export function HeatmapPage() {
  const [symbol, setSymbol] = useState<HeatSymbol>('BTC');
  const [model, setModel] = useState<HeatModel>('model1');
  const [interval, setIntervalV] = useState<HeatInterval>('24h');
  const { data, isLoading, error, mutate, isValidating } = useHeatmap(symbol, model, interval);

  const prepared = useMemo(() => (data && !data.error && data.configured !== false ? prepare(data) : null), [data]);
  const metrics = useMemo(() => (prepared ? computeHeatmapMetrics(data) : null), [prepared, data]);
  const { data: hist, mutate: mutateHist } = useHeatmapHistory(symbol, interval);

  // Persist today's metrics (one row per day+symbol+interval) so the strip can
  // show a trend, not a context-free number. Free — reuses the computed payload.
  useEffect(() => {
    if (!metrics) return;
    fetch('/api/heatmap/metrics', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol, interval, price: metrics.price, tll: metrics.totalFuel, lcg: metrics.lcg, lcgGap: metrics.lcgGap }),
    }).then(() => mutateHist()).catch(() => {});
  }, [metrics, symbol, interval, mutateHist]);

  // Day-over-day comparison: previous = latest stored row before today (UTC).
  const trend = useMemo(() => {
    const rows = hist?.history || [];
    const today = new Date().toISOString().slice(0, 10);
    const prior = rows.filter((r) => r.day < today);
    const prev = prior.length ? prior[prior.length - 1] : null;
    return { tllSeries: rows.map((r) => r.tll), gapSeries: rows.map((r) => r.lcg_gap), tllPrev: prev?.tll ?? null, gapPrev: prev?.lcg_gap ?? null };
  }, [hist]);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  // draw on data change + on container resize
  useEffect(() => {
    const cv = cvRef.current, host = plotRef.current;
    if (!cv || !host || !prepared || !data) return;
    const render = () => drawCanvas(cv, prepared, data.liquidation_leverage_data);
    render();
    const ro = new ResizeObserver(render);
    ro.observe(host);
    return () => ro.disconnect();
  }, [prepared, data]);

  // axis ticks
  const priceTicks = useMemo(() => {
    if (!prepared) return [];
    const { pMin, pMax } = prepared, rng = pMax - pMin || 1, step = niceStep(rng, 7);
    const out: { price: number; topPct: number }[] = [];
    for (let pr = Math.ceil(pMin / step) * step; pr <= pMax + 1e-6; pr += step) {
      out.push({ price: pr, topPct: (pMax - pr) / rng * 100 });
    }
    return out;
  }, [prepared]);

  const timeTicks = useMemo(() => {
    if (!prepared) return [];
    const cs = prepared.candles, n = cs.length, count = Math.min(7, n);
    const out: { ts: number; leftPct: number }[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i / (count - 1 || 1)) * (n - 1));
      out.push({ ts: +cs[idx][0], leftPct: (idx + 0.5) / n * 100 });
    }
    return out;
  }, [prepared]);

  const lastTopPct = prepared ? (prepared.pMax - prepared.last) / (prepared.pMax - prepared.pMin || 1) * 100 : 0;

  const onHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!prepared) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const { Y, X, pMin, pMax, lkp, candles } = prepared, rng = pMax - pMin || 1;
    const price = pMax - (my / r.height) * rng;
    const xi = Math.max(0, Math.min(X - 1, Math.floor(mx / r.width * X)));
    const yi = Math.max(0, Math.min(Y - 1, Math.round((price - pMin) / rng * (Y - 1))));
    const lev = lkp.get(xi * 100000 + yi) || 0;
    const ts = +candles[Math.min(xi, candles.length - 1)][0];
    setHover({ x: mx, y: my, w: r.width, h: r.height, price, lev, ts });
  };

  const notConfigured = data?.configured === false;
  const errMsg = error ? String(error) : data?.error;
  const noData = data && !prepared && !notConfigured && !errMsg;

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#0b0518', fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: 'hidden', color: '#e7e3f0' }}>
      <style>{'@keyframes hmShimmer{0%{opacity:.4}50%{opacity:.85}100%{opacity:.4}}@keyframes hmSpin{to{transform:rotate(360deg)}}'}</style>

      {/* topbar: title + controls + legend */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 13, rowGap: 9, padding: '11px 18px', background: '#120a22', borderBottom: '1px solid rgba(255,255,255,0.07)', flex: '0 0 auto' }}>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: '#f3eeff' }}>Liquidation heatmap</span>
        <Seg label="Symbol" options={SYMBOLS} value={symbol} onChange={setSymbol} />
        <Seg label="Model" options={MODELS} value={model} onChange={setModel} mono />
        <Seg label="Interval" options={INTERVALS} value={interval} onChange={setIntervalV} mono tight />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <LegendDot color="#8b5cf6" label="Liquidation Leverage" />
          <LegendDot color="#26d07c" label="Price" />
          <button onClick={() => mutate()} disabled={isValidating} title="Re-run Actor"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 700, fontSize: 11, color: '#c9c2da', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', cursor: isValidating ? 'default' : 'pointer', opacity: isValidating ? 0.6 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={isValidating ? { animation: 'hmSpin .8s linear infinite' } : undefined}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* derived metrics strip */}
      {metrics && <MetricsStrip m={metrics} trend={trend} />}

      {/* chart */}
      <div style={{ flex: 1, position: 'relative', background: '#0a0416', overflow: 'hidden' }}>
        {prepared ? (
          <>
            {/* value colorbar */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: 56, bottom: 50 }}>
              <span style={{ position: 'absolute', left: 8, top: 8, fontFamily: MONO, fontWeight: 600, fontSize: 10, color: '#9b93ad' }}>{fmtVal(prepared.max)}</span>
              <div style={{ position: 'absolute', left: 14, top: 30, bottom: 30, width: 13, borderRadius: 4, background: 'linear-gradient(180deg,#fcffa4,#f9cb35,#f98c0a,#e85b30,#bb3754,#88226a,#56136e,#1f0c48,#0a0416)' }} />
              <span style={{ position: 'absolute', left: 13, bottom: 8, fontFamily: MONO, fontWeight: 600, fontSize: 10, color: '#9b93ad' }}>0</span>
            </div>

            {/* plot */}
            <div ref={plotRef} onMouseMove={onHover} onMouseLeave={() => setHover(null)} style={{ position: 'absolute', left: 56, top: 0, right: 62, bottom: 50, overflow: 'visible' }}>
              <canvas ref={cvRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
              {hover && <HoverCard hv={hover} />}
            </div>

            {/* price axis */}
            <div style={{ position: 'absolute', right: 0, top: 0, width: 62, bottom: 50 }}>
              {priceTicks.map((t) => (
                <span key={t.price} style={{ position: 'absolute', right: 9, top: `${t.topPct}%`, transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: '#b7b0c6' }}>{fmtPrice(t.price)}</span>
              ))}
              <div style={{ position: 'absolute', right: 5, top: `${lastTopPct}%`, transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 700, fontSize: 10.5, color: '#0a0416', background: '#d6d0e6', borderRadius: 3, padding: '2px 5px' }}>{fmtPrice(prepared.last)}</div>
            </div>

            {/* time axis */}
            <div style={{ position: 'absolute', left: 56, bottom: 30, right: 62, height: 20 }}>
              {timeTicks.map((t, i) => (
                <span key={i} style={{ position: 'absolute', left: `${t.leftPct}%`, top: 4, transform: 'translateX(-50%)', fontFamily: MONO, fontWeight: 600, fontSize: 9.5, color: '#8a829b', whiteSpace: 'nowrap' }}>{fmtAxisTime(t.ts)}</span>
              ))}
            </div>
          </>
        ) : (
          <Overlay state={notConfigured ? 'config' : errMsg ? 'error' : noData ? 'empty' : 'loading'} msg={errMsg} onRetry={() => mutate()} />
        )}
        {prepared && (isLoading || isValidating) && (
          <div style={{ position: 'absolute', top: 12, left: 64, fontFamily: MONO, fontSize: 10.5, color: '#9b93ad', animation: 'hmShimmer 1.2s ease-in-out infinite' }}>updating…</div>
        )}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', background: '#120a22', borderTop: '1px solid rgba(255,255,255,0.07)', flex: '0 0 auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 11.5, color: '#a79fbb' }}>
          <span style={{ width: 17, height: 17, borderRadius: 5, background: '#8b5cf6', color: '#0a0416', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, flex: '0 0 auto' }}>?</span>
          Bright bands are clusters of stacked leverage — the magnets price gets pulled toward to trigger liquidations.
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 10.5, color: '#6f6885', whiteSpace: 'nowrap' }}>
          {data?.updateTime ? `CoinGlass · updated ${fmtFullTime(Math.round(data.updateTime / 1000))}` : 'CoinGlass via Apify liquidation-heatmap Actor'}
        </span>
      </div>
    </div>
  );
}

interface Trend { tllSeries: number[]; gapSeries: number[]; tllPrev: number | null; gapPrev: number | null }

function MetricsStrip({ m, trend }: { m: ReturnType<typeof computeHeatmapMetrics>; trend: Trend }) {
  if (!m) return null;
  const up = m.lcgGap >= 0;
  const sideTag = (c: Cluster | null) => (c ? (c.side === 'above' ? '#26d07c' : '#f04866') : '#9b93ad');
  const magnet = (label: string, c: Cluster | null, dir: '↑' | '↓') => (
    <Cell label={label}>
      {c ? (
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 14, color: '#f3eeff' }}>{dir} {fmtPrice(c.peakPrice)}</span>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: '#8b5cf6' }}>{fmtVal(c.mass)}</span>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: dir === '↑' ? '#26d07c' : '#f04866' }}>{dir === '↑' ? '+' : '−'}{c.dist.toFixed(2)}%</span>
        </span>
      ) : <span style={{ color: '#6f6885', fontSize: 12 }}>—</span>}
    </Cell>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, padding: '0 6px', background: '#0e0720', borderBottom: '1px solid rgba(255,255,255,0.07)', flex: '0 0 auto', overflowX: 'auto' }}>
      <Cell label="Center of gravity" hint="Fuel-weighted price — the magnet the whole book leans toward. Δ = drift vs yesterday (gap widening up = upward pull strengthening).">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 14, color: '#f3eeff' }}>{fmtPrice(m.lcg)}</span>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: up ? '#26d07c' : '#f04866' }}>{up ? '▲ +' : '▼ −'}{Math.abs(m.lcgGap).toFixed(2)}%</span>
          <GapDelta cur={m.lcgGap} prev={trend.gapPrev} />
          <Spark data={trend.gapSeries} color="#8b5cf6" />
        </span>
      </Cell>
      {magnet('Nearest magnet ↑', m.nearestAbove, '↑')}
      {magnet('Nearest magnet ↓', m.nearestBelow, '↓')}
      <Cell label="Strongest wall" hint="Biggest cluster of stacked leverage, regardless of distance">
        {m.strongest ? (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 14, color: '#f3eeff' }}>{fmtPrice(m.strongest.peakPrice)}</span>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: '#8b5cf6' }}>{fmtVal(m.strongest.mass)}</span>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: sideTag(m.strongest) }}>{(m.strongest.share * 100).toFixed(0)}%</span>
          </span>
        ) : <span style={{ color: '#6f6885' }}>—</span>}
      </Cell>
      <Cell label="Total fuel · σ" hint="Total surviving liquidation leverage (TLL). Δ = vs yesterday — rising (amber) = leverage building / cascade fuel; falling (green) = deleveraged. σ = realized vol = distance scale τ.">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 14, color: '#f3eeff' }}>{fmtVal(m.totalFuel)}</span>
          <FuelDelta cur={m.totalFuel} prev={trend.tllPrev} />
          <Spark data={trend.tllSeries} color="#ffa31a" />
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: '#7c7390' }}>σ {m.sigma.toFixed(1)}%</span>
        </span>
      </Cell>
    </div>
  );
}

// Day-over-day deltas. Fuel: rising = amber (leverage building), falling = green.
function FuelDelta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null || prev === 0) return <span style={{ fontFamily: MONO, fontSize: 10, color: '#6f6885' }}>1st pt</span>;
  const pct = (cur / prev - 1) * 100, up = pct >= 0;
  return <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: up ? '#ffa31a' : '#26d07c' }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%</span>;
}
// Gap drift (percentage points): more positive (fuel rising above) = green.
function GapDelta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null) return <span style={{ fontFamily: MONO, fontSize: 10, color: '#6f6885' }}>1st pt</span>;
  const d = cur - prev, up = d >= 0;
  return <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: up ? '#26d07c' : '#f04866' }}>{up ? '▲' : '▼'}{Math.abs(d).toFixed(2)}pp</span>;
}
// Tiny trend sparkline over the daily series (oldest→newest).
function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 50, h = 16, mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 1 - ((v - mn) / rng) * (h - 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block', flex: '0 0 auto' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={1.8} fill={color} />
    </svg>
  );
}

function Cell({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const labelEl = (
    <span style={{ fontWeight: 800, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c7390', borderBottom: hint ? '1px dotted #514a63' : undefined }}>{label}</span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 16px', borderRight: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap', justifyContent: 'center' }}>
      {hint ? <HoverTip tip={hint} width={220} style={{ cursor: 'help' }}>{labelEl}</HoverTip> : labelEl}
      {children}
    </div>
  );
}

function Seg<T extends string>({ label, options, value, onChange, mono, tight }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; mono?: boolean; tight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 800, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c7390' }}>{label}</span>
      <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 3 }}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button key={opt} onClick={() => onChange(opt)} style={{
              fontFamily: mono ? MONO : 'inherit', fontWeight: active ? 800 : 700,
              fontSize: tight ? 10 : 10.5, color: active ? '#1a1226' : '#9b93ad',
              padding: tight ? '4px 7px' : '4px 9px', borderRadius: 6,
              background: active ? '#d9cff2' : 'transparent', border: 'none', cursor: 'pointer',
            }}>{opt}</button>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5, color: '#c9c2da' }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />{label}
    </span>
  );
}

function HoverCard({ hv }: { hv: Hover }) {
  const cardW = 218, cardH = 96;
  let tx = hv.x + 16; if (tx + cardW > hv.w) tx = hv.x - 16 - cardW; if (tx < 2) tx = 2;
  let ty = hv.y + 14; if (ty + cardH > hv.h) ty = hv.y - 14 - cardH; if (ty < 2) ty = 2;
  const row = (color: string, label: string, val: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
      <span style={{ fontWeight: 600, fontSize: 13, color: '#5a5568' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontWeight: 700, fontSize: 13, color: '#1a1226' }}>{val}</span>
    </div>
  );
  return (
    <div style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: hv.x - 5, top: hv.y - 5, width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: tx, top: ty, width: cardW, background: '#f4f2f7', borderRadius: 12, boxShadow: '0 12px 34px rgba(0,0,0,0.45)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1226' }}>{fmtFullTime(hv.ts)}</span>
        {row('#26d07c', 'Price', fmtPrice(hv.price))}
        {row('#8b5cf6', 'Liquidation Leverage', fmtVal(hv.lev))}
      </div>
    </div>
  );
}

function Overlay({ state, msg, onRetry }: { state: 'loading' | 'config' | 'error' | 'empty'; msg?: string; onRetry: () => void }) {
  const center: React.CSSProperties = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 };
  if (state === 'loading') {
    return (
      <div style={center}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth={2.4} strokeLinecap="round" style={{ animation: 'hmSpin .8s linear infinite' }}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#9b93ad', animation: 'hmShimmer 1.2s ease-in-out infinite' }}>Running CoinGlass heatmap Actor…</span>
        </div>
      </div>
    );
  }
  if (state === 'config') {
    return (
      <div style={center}>
        <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#f3eeff' }}>Apify not connected</span>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b93ad', lineHeight: 1.6 }}>
            Set <code style={{ fontFamily: MONO, color: '#c9c2da' }}>APIFY_TOKEN</code> in <code style={{ fontFamily: MONO, color: '#c9c2da' }}>.env.local</code> (and Vercel) to enable the liquidation heatmap. It runs the <code style={{ fontFamily: MONO, color: '#c9c2da' }}>api_merge/coinglass-liquidation-heatmap</code> Actor server-side.
          </span>
        </div>
      </div>
    );
  }
  return (
    <div style={center}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#f3eeff' }}>{state === 'empty' ? 'No heatmap data returned' : 'Couldn’t load the heatmap'}</span>
        {msg && <span style={{ fontFamily: MONO, fontSize: 11, color: '#8a829b', maxWidth: 480, wordBreak: 'break-word' }}>{msg}</span>}
        <button onClick={onRetry} style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: 12, color: '#1a1226', background: '#d9cff2', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );
}
