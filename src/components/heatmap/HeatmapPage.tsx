'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useHeatmap, useHeatmapHistory, type HeatmapData,
  type HeatSymbol, type HeatModel, type HeatInterval,
} from '@/hooks/useHeatmap';
import { computeHeatmapMetrics } from '@/lib/heatmap-metrics';

const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "'Plus Jakarta Sans', sans-serif";

const SYMBOLS: HeatSymbol[] = ['BTC', 'ETH', 'SOL'];
const MODELS: HeatModel[] = ['model1', 'model2', 'model3'];
const INTERVALS: HeatInterval[] = ['12h', '24h', '48h', '3d', '1w', '2w', '1mo', '3mo'];

type RGB = [number, number, number];
type Ramp = [number, RGB][];

// magma/inferno ramp lookup
function ramped(ramp: Ramp, u: number): RGB {
  if (u < 0) u = 0; if (u > 1) u = 1;
  for (let i = 1; i < ramp.length; i++) {
    if (u <= ramp[i][0]) {
      const a = ramp[i - 1], b = ramp[i], f = (u - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
        Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
        Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

interface Palette { plotTop: string; plotBot: string; up: string; down: string; lastLine: string; profCross: string; rowHi: string; ramp: Ramp; }
function palette(dark: boolean): Palette {
  return dark
    ? { plotTop: '#150c24', plotBot: '#0a0613', up: '#2ad17f', down: '#f04866', lastLine: 'rgba(233,230,242,0.5)', profCross: 'rgba(255,255,255,0.45)', rowHi: 'rgba(255,255,255,0.08)', ramp: [[0, [10, 6, 22]], [0.13, [40, 16, 70]], [0.28, [110, 28, 96]], [0.45, [176, 48, 88]], [0.6, [221, 84, 60]], [0.74, [240, 128, 26]], [0.87, [249, 201, 70]], [1, [252, 255, 180]]] }
    : { plotTop: '#fdfcf9', plotBot: '#f4f1ea', up: '#1f9d55', down: '#df5338', lastLine: 'rgba(40,36,28,0.42)', profCross: 'rgba(40,36,28,0.42)', rowHi: 'rgba(124,92,255,0.12)', ramp: [[0, [252, 250, 245]], [0.12, [252, 232, 160]], [0.3, [250, 194, 84]], [0.48, [243, 140, 48]], [0.64, [228, 82, 60]], [0.8, [188, 40, 86]], [1, [120, 20, 90]]] };
}

function niceStep(range: number, target: number): number {
  const raw = range / target, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
  const s = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return s * mag;
}
const fmtUsd = (v: number) => { const s = v < 0 ? '-' : ''; v = Math.abs(v); return s + '$' + (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v.toFixed(0)); };
const fmtPrice = (p: number) => Math.round(p).toLocaleString('en-US');
const fmtVal = (v: number) => (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)));
const pad2 = (x: number) => String(x).padStart(2, '0');
const fmtShort = (ts: number) => { const d = new Date(ts * 1000); return d.getDate() + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const fmtCross = (ts: number) => { const d = new Date(ts * 1000); const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return `${wd[d.getDay()]} ${d.getDate()} ${mo[d.getMonth()]} '${String(d.getFullYear()).slice(2)}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

interface View { x0: number; x1: number; p0: number; p1: number }

// Standing liquidation book = the latest time column (not summed across time, which
// double-counts persistent levels + re-counts consumed liquidity). Split shorts
// (above price) / longs (below) with cumulative curves outward from price.
interface Profile { tot: number[]; total: number; maxT: number; peak: number; peakPrice: number; last: number; chg: number; priceJ: number; cum: number[]; shortTotal: number; longTotal: number; maxCum: number }
function computeProfile(d: HeatmapData): Profile | null {
  const ya = d.y_axis, ld = d.liquidation_leverage_data, cs = d.price_candlesticks;
  if (!ya?.length || !ld?.length || !cs?.length) return null;
  const Y = ya.length;
  let lastX = 0; for (const r of ld) if (r[0] > lastX) lastX = r[0];
  const tot = new Array(Y).fill(0); let total = 0;
  for (const r of ld) if (r[0] === lastX) { tot[r[1]] += r[2]; total += r[2]; }
  let peak = 0, maxT = 1; for (let j = 0; j < Y; j++) { if (tot[j] > tot[peak]) peak = j; if (tot[j] > maxT) maxT = tot[j]; }
  const last = +cs[cs.length - 1][4], first = +cs[0][1];
  let priceJ = 0, best = Infinity; for (let j = 0; j < Y; j++) { const dd = Math.abs(ya[j] - last); if (dd < best) { best = dd; priceJ = j; } }
  const cum = new Array(Y).fill(0);
  let shortTotal = 0; for (let j = priceJ + 1; j < Y; j++) { shortTotal += tot[j]; cum[j] = shortTotal; }
  let longTotal = 0; for (let j = priceJ - 1; j >= 0; j--) { longTotal += tot[j]; cum[j] = longTotal; }
  return { tot, total, maxT, peak, peakPrice: ya[peak], last, chg: (last - first) / first * 100, priceJ, cum, shortTotal, longTotal, maxCum: Math.max(shortTotal, longTotal, 1) };
}

interface Mark { short: string; price: number; line: string; color: string }
interface Prepared { Y: number; X: number; max: number; ya: number[]; cs: HeatmapData['price_candlesticks']; lkp: Map<number, number>; dat: HeatmapData['liquidation_leverage_data'] }
function prepare(d: HeatmapData): Prepared | null {
  const ya = d.y_axis, dat = d.liquidation_leverage_data, cs = d.price_candlesticks;
  if (!ya?.length || !dat?.length || !cs?.length) return null;
  let max = 1, X = 0; const lkp = new Map<number, number>();
  for (const r of dat) { if (r[2] > max) max = r[2]; if (r[0] + 1 > X) X = r[0] + 1; lkp.set(r[0] * 100000 + r[1], r[2]); }
  return { Y: ya.length, X: Math.max(X, cs.length), max, ya, cs, lkp, dat };
}

interface HoverState { x: number; y: number; w: number; h: number; price: number; lev: number; ts: number }
interface ProfHover { x: number; y: number; w: number; h: number; j: number; price: number }

export function HeatmapPage({ initialSymbol = 'BTC', onClose }: { initialSymbol?: HeatSymbol; onClose?: () => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { const t = localStorage.getItem('lh_theme'); return t === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const dark = theme === 'dark';
  const [symbol, setSymbol] = useState<HeatSymbol>(initialSymbol);
  const [model, setModel] = useState<HeatModel>('model1');
  const [interval, setIntervalV] = useState<HeatInterval>('24h');
  const { data, isLoading, isValidating, mutate } = useHeatmap(symbol, model, interval);

  const prep = useMemo(() => (data && !data.error && data.configured !== false ? prepare(data) : null), [data]);
  const prof = useMemo(() => (prep ? computeProfile(data as HeatmapData) : null), [prep, data]);
  const metrics = useMemo(() => (prep ? computeHeatmapMetrics(data) : null), [prep, data]);
  const { data: hist, mutate: mutateHist } = useHeatmapHistory(symbol, interval);

  useEffect(() => {
    if (!metrics) return;
    fetch('/api/heatmap/metrics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol, interval, price: metrics.price, tll: metrics.totalFuel, lcg: metrics.lcg, lcgGap: metrics.lcgGap }) }).then(() => mutateHist()).catch(() => {});
  }, [metrics, symbol, interval, mutateHist]);

  const trend = useMemo(() => {
    const SPARK = 14, rows = hist?.history || [], today = new Date().toISOString().slice(0, 10);
    const prior = rows.filter((r) => r.day < today), prev = prior.length ? prior[prior.length - 1] : null;
    return { tllSeries: rows.map((r) => r.tll).slice(-SPARK), gapSeries: rows.map((r) => r.lcg_gap).slice(-SPARK), tllPrev: prev?.tll ?? null, gapPrev: prev?.lcg_gap ?? null };
  }, [hist]);

  const marks = useMemo<Mark[]>(() => {
    if (!metrics) return [];
    const dn = dark ? '#ff6b9d' : '#d6336c', dnl = dark ? 'rgba(255,107,157,0.92)' : 'rgba(214,51,108,0.9)';
    const out: Mark[] = [{ short: 'CoG', price: metrics.lcg, line: 'rgba(124,92,255,0.9)', color: '#7c5cff' }];
    if (metrics.nearestAbove) out.push({ short: 'MAG ↑', price: metrics.nearestAbove.peakPrice, line: 'rgba(31,157,85,0.88)', color: '#1f9d55' });
    if (metrics.nearestBelow) out.push({ short: 'MAG ↓', price: metrics.nearestBelow.peakPrice, line: dnl, color: dn });
    if (metrics.strongest) out.push({ short: 'WALL', price: metrics.strongest.peakPrice, line: 'rgba(43,108,232,0.9)', color: '#2b6ce8' });
    return out;
  }, [metrics, dark]);

  // ---- view (zoom/pan) ----
  const viewRef = useRef<View | null>(null);
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const heatRef = useRef<HTMLCanvasElement | null>(null);
  const profRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const paxRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [profHover, setProfHover] = useState<ProfHover | null>(null);

  const getView = useCallback((): View => {
    if (!viewRef.current && prep) viewRef.current = { x0: 0, x1: 1, p0: prep.ya[0], p1: prep.ya[prep.Y - 1] };
    return viewRef.current as View;
  }, [prep]);
  const isZoomed = useCallback(() => {
    if (!prep || !viewRef.current) return false; const V = viewRef.current;
    return V.x0 > 0.001 || V.x1 < 0.999 || V.p0 > prep.ya[0] + 0.5 || V.p1 < prep.ya[prep.Y - 1] - 0.5;
  }, [prep]);
  const resetView = useCallback(() => { viewRef.current = null; bump(); }, [bump]);
  useEffect(() => { viewRef.current = null; setHover(null); setProfHover(null); }, [data]);

  const clampView = useCallback((V: View) => {
    if (!prep) return V; const lo = prep.ya[0], hi = prep.ya[prep.Y - 1];
    let sx = V.x1 - V.x0; const minSx = 4 / (prep.X - 1); if (sx < minSx) sx = minSx; if (sx > 1) sx = 1; if (V.x0 < 0) V.x0 = 0; V.x1 = V.x0 + sx; if (V.x1 > 1) { V.x1 = 1; V.x0 = 1 - sx; }
    let sp = V.p1 - V.p0; const minSp = (hi - lo) * 0.03; if (sp < minSp) sp = minSp; if (sp > hi - lo) sp = hi - lo; if (V.p0 < lo) V.p0 = lo; V.p1 = V.p0 + sp; if (V.p1 > hi) { V.p1 = hi; V.p0 = hi - sp; } return V;
  }, [prep]);

  // refs so the once-attached listeners read live values
  const refs = useRef({ prep, getView, clampView, bump });
  refs.current = { prep, getView, clampView, bump };

  const drawAll = useCallback(() => {
    const P = palette(theme === 'dark'); const D = prep; if (!D) return;
    const V = getView(); if (!V) return;
    // heatmap
    const hc = heatRef.current;
    if (hc) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = hc.clientWidth, H = hc.clientHeight;
      if (W && H) {
        hc.width = Math.round(W * dpr); hc.height = Math.round(H * dpr);
        const ctx = hc.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const Y = D.Y, X = D.X, mx = D.max, ya = D.ya, spx = V.x1 - V.x0, spp = V.p1 - V.p0;
        const yP = (p: number) => (V.p1 - p) / spp * H, dp = (ya[Y - 1] - ya[0]) / (Y - 1);
        const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, P.plotTop); bg.addColorStop(1, P.plotBot); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        const cw = (1 / (X - 1)) / spx * W + 1, ch = dp / spp * H + 0.9;
        for (const r of D.dat) { const x = (r[0] / (X - 1) - V.x0) / spx * W; if (x < -cw || x > W) continue; const p = ya[r[1]]; if (p < V.p0 - dp || p > V.p1 + dp) continue; const c = ramped(P.ramp, r[2] / mx); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(x, yP(p) - ch / 2, cw, ch); }
        const cs = D.cs, n = cs.length, slot = (1 / (n - 1)) / spx * W, cbw = Math.max(1.2, slot * 0.5);
        for (let i = 0; i < n; i++) { const cx = (i / (n - 1) - V.x0) / spx * W; if (cx < -5 || cx > W + 5) continue; const o = +cs[i][1], hi = +cs[i][2], lo = +cs[i][3], cl = +cs[i][4], up = cl >= o; ctx.strokeStyle = up ? P.up : P.down; ctx.fillStyle = up ? P.up : P.down; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + 0.5, yP(hi)); ctx.lineTo(cx + 0.5, yP(lo)); ctx.stroke(); const yt = yP(Math.max(o, cl)), yb = yP(Math.min(o, cl)); ctx.fillRect(cx - cbw / 2, yt, cbw, Math.max(1.2, yb - yt)); }
        const last = +cs[n - 1][4]; ctx.strokeStyle = P.lastLine; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, yP(last)); ctx.lineTo(W, yP(last)); ctx.stroke(); ctx.setLineDash([]);
        const vis = marks.filter((m) => m.price >= V.p0 && m.price <= V.p1);
        vis.forEach((m) => { const y = yP(m.price); ctx.strokeStyle = m.line; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
        ctx.setLineDash([]); ctx.font = '700 9px ' + MONO; ctx.textBaseline = 'middle';
        const usedX: Record<number, number> = {};
        vis.forEach((m) => { const y = yP(m.price), tw = ctx.measureText(m.short).width, pad = 7, bh = 15, bw = tw + pad * 2, yk = Math.round(y / 8), bx = usedX[yk] != null ? usedX[yk] : 5; usedX[yk] = bx + bw + 4; const by = y - bh / 2; ctx.fillStyle = m.color; if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill(); } else ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = '#fff'; ctx.fillText(m.short, bx + pad, y + 0.5); });
      }
    }
    // profile
    const pc = profRef.current, a = prof;
    if (pc && a) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = pc.clientWidth, H = pc.clientHeight;
      if (W && H) {
        pc.width = Math.round(W * dpr); pc.height = Math.round(H * dpr);
        const ctx = pc.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        const Y = D.Y, ya = D.ya, spp = V.p1 - V.p0, yP = (p: number) => (V.p1 - p) / spp * H, dp = (ya[Y - 1] - ya[0]) / (Y - 1), ch = dp / spp * H + 0.8;
        const priceY = yP(a.last);
        ctx.fillStyle = 'rgba(42,209,127,0.055)'; ctx.fillRect(0, 0, W, priceY);
        ctx.fillStyle = 'rgba(240,72,102,0.055)'; ctx.fillRect(0, priceY, W, H - priceY);
        const hj = profHover ? profHover.j : -1;
        for (let j = 0; j < Y; j++) { const p = ya[j]; if (p < V.p0 - dp || p > V.p1 + dp) continue; const v = a.tot[j] / a.maxT, y = yP(p) - ch / 2; if (j === hj) { ctx.fillStyle = P.rowHi; ctx.fillRect(0, y - 0.5, W, ch + 1); } if (v < 0.004) continue; const c = ramped(P.ramp, Math.pow(v, 0.7)), len = Math.max(1.5, v * (W - 2)); ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(0, y, len, ch); }
        const xc = (cv: number) => cv / a.maxCum * (W - 2);
        ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, priceY); for (let j = a.priceJ + 1; j < Y; j++) ctx.lineTo(xc(a.cum[j]), yP(ya[j])); ctx.strokeStyle = P.up; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, priceY); for (let j = a.priceJ - 1; j >= 0; j--) ctx.lineTo(xc(a.cum[j]), yP(ya[j])); ctx.strokeStyle = P.down; ctx.stroke();
        ctx.strokeStyle = P.profCross; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, priceY); ctx.lineTo(W, priceY); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }, [theme, prep, prof, marks, profHover, getView]);

  const drawRef = useRef(drawAll); drawRef.current = drawAll;
  // redraw on data/theme/marks changes AND on every view mutation (tick), since
  // zoom/pan mutate the view ref in place (which alone wouldn't change drawAll).
  useEffect(() => { drawAll(); }, [drawAll, tick]);
  useEffect(() => {
    const host = plotRef.current; if (!host) return;
    const ro = new ResizeObserver(() => drawRef.current()); ro.observe(host);
    return () => ro.disconnect();
  }, [prep]);

  // wheel / pan attached once to the canvas
  const setHeat = useCallback((el: HTMLCanvasElement | null) => {
    if (!el || el === heatRef.current) return; heatRef.current = el;
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); const { getView: gv, clampView: cv, bump: bp } = refs.current; const V = gv(); if (!V) return;
      const r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      let d = e.deltaY; if (e.deltaMode === 1) d *= 16; const f = Math.min(1.6, Math.max(0.625, Math.exp(d * 0.00085)));
      if (e.shiftKey) { const sp = (V.p1 - V.p0) * f, py = V.p1 - fy * (V.p1 - V.p0); V.p1 = py + fy * sp; V.p0 = V.p1 - sp; }
      else { const sp = (V.x1 - V.x0) * f, fxv = V.x0 + fx * (V.x1 - V.x0); V.x0 = fxv - fx * sp; V.x1 = V.x0 + sp; }
      cv(V); drawRef.current(); bp();
    }, { passive: false });
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; e.preventDefault();
      const { getView: gv, clampView: cv, bump: bp } = refs.current; const V = gv(); if (!V) return;
      const r = el.getBoundingClientRect(), s = { mx: e.clientX, my: e.clientY, x0: V.x0, x1: V.x1, p0: V.p0, p1: V.p1, w: r.width, h: r.height };
      document.body.classList.add('lh-dragging'); setHover(null);
      const move = (ev: MouseEvent) => { const dx = (ev.clientX - s.mx) / s.w, dy = (ev.clientY - s.my) / s.h, spx = s.x1 - s.x0, spp = s.p1 - s.p0; V.x0 = s.x0 - dx * spx; V.x1 = s.x1 - dx * spx; V.p0 = s.p0 + dy * spp; V.p1 = s.p1 + dy * spp; cv(V); drawRef.current(); bp(); };
      const up = () => { document.body.classList.remove('lh-dragging'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    drawRef.current();
  }, []);

  // dedicated price-axis wheel zoom (ns-resize), as in the dc.html
  const setPriceAxis = useCallback((el: HTMLDivElement | null) => {
    if (!el || el === paxRef.current) return; paxRef.current = el;
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); const { getView: gv, clampView: cv, bump: bp } = refs.current; const V = gv(); if (!V) return;
      const r = el.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height;
      let d = e.deltaY; if (e.deltaMode === 1) d *= 16; const f = Math.min(1.6, Math.max(0.625, Math.exp(d * 0.00085)));
      const sp = (V.p1 - V.p0) * f, py = V.p1 - fy * (V.p1 - V.p0); V.p1 = py + fy * sp; V.p0 = V.p1 - sp;
      cv(V); drawRef.current(); bp();
    }, { passive: false });
  }, []);

  const onHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!prep) return; const V = getView(); if (!V) return;
    const r = e.currentTarget.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const { Y, X, ya, cs, lkp } = prep;
    const price = V.p1 - (my / r.height) * (V.p1 - V.p0), f = V.x0 + (mx / r.width) * (V.x1 - V.x0);
    const xi = Math.max(0, Math.min(X - 1, Math.round(f * (X - 1)))), dp = (ya[Y - 1] - ya[0]) / (Y - 1);
    const yi = Math.max(0, Math.min(Y - 1, Math.round((price - ya[0]) / dp)));
    const lev = lkp.get(xi * 100000 + yi) || 0, ci = Math.max(0, Math.min(cs.length - 1, Math.round(f * (cs.length - 1))));
    setHover({ x: mx, y: my, w: r.width, h: r.height, price, lev, ts: +cs[ci][0] });
  };
  const onProfHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!prep) return; const V = getView(); if (!V) return;
    const r = e.currentTarget.getBoundingClientRect(), my = e.clientY - r.top, mx = e.clientX - r.left;
    const { Y, ya } = prep, price = V.p1 - (my / r.height) * (V.p1 - V.p0), dp = (ya[Y - 1] - ya[0]) / (Y - 1);
    const j = Math.max(0, Math.min(Y - 1, Math.round((price - ya[0]) / dp)));
    setProfHover({ x: mx, y: my, w: r.width, h: r.height, j, price: ya[j] });
  };

  const toggleTheme = () => { const t = dark ? 'light' : 'dark'; try { localStorage.setItem('lh_theme', t); } catch {} setTheme(t); };

  const notConfigured = data?.configured === false;
  const errMsg = data?.error;

  return (
    <div className="lhx" data-theme={theme} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: SANS, color: 'var(--ink)', overflow: 'hidden' }}>
      <style>{LH_CSS}</style>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '13px 24px', borderBottom: '1px solid var(--border)', flex: '0 0 auto', flexWrap: 'wrap', rowGap: 12 }}>
        {onClose && (
          <button onClick={onClose} title="Back" style={iconBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c5cff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9d55', boxShadow: '0 0 8px #1f9d55' }} />Live · {symbol} / USDT
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>Liquidation Heatmap</span>
            <button onClick={() => mutate()} title="Refresh data" disabled={isValidating} style={iconBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={isValidating ? { animation: 'lhspin .8s linear infinite' } : undefined}><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
            </button>
            <button onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'} style={iconBtn}>
              {dark
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" /></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
            </button>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Controls symbol={symbol} model={model} interval={interval} onSym={setSymbol} onModel={setModel} onInterval={setIntervalV} />
        </div>
      </div>

      {/* stats strip */}
      {metrics && <div style={{ padding: '12px 16px 4px', flex: '0 0 auto' }}><StatsStrip m={metrics} trend={trend} /></div>}

      {/* main */}
      <div style={{ flex: 1, display: 'flex', gap: 14, padding: '14px 16px', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
          {prep ? (
            <>
              <div ref={plotRef} onMouseMove={onHover} onMouseLeave={() => setHover(null)} onDoubleClick={resetView} style={{ position: 'absolute', left: 58, top: 14, right: 64, bottom: 30, overflow: 'visible', cursor: 'crosshair', zIndex: 8 }}>
                <canvas ref={setHeat} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', borderRadius: 8 }} />
                {isZoomed() && (
                  <button onClick={resetView} className="lh-rst" title="Reset zoom" style={{ position: 'absolute', left: 8, top: 8, zIndex: 5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 8px', background: 'rgba(26,24,19,0.84)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, color: '#f3f0ff' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                    <span className="lh-rstlbl">Reset zoom</span>
                  </button>
                )}
                {hover && <Crosshair hv={hover} />}
              </div>
              <div style={{ position: 'absolute', left: 10, top: 14, width: 44, bottom: 30, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 9.5, color: 'var(--muted)', marginBottom: 6, whiteSpace: 'nowrap' }}>{(prep.max / 1e6).toFixed(2)}M</span>
                <div style={{ flex: 1, width: 13, borderRadius: 4, background: 'linear-gradient(180deg,#78145a,#bc2856,#e4523c,#f68c30,#fac854,#fce8a0,#faf8fc)' }} />
                <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 9.5, color: 'var(--muted)', marginTop: 6 }}>0</span>
              </div>
              <div ref={setPriceAxis} style={{ position: 'absolute', right: 0, top: 14, width: 64, bottom: 30, cursor: 'ns-resize' }}>
                <PriceAxis prep={prep} getView={getView} marks={marks} />
              </div>
              <TimeAxis prep={prep} getView={getView} />
            </>
          ) : (
            <Overlay state={notConfigured ? 'config' : errMsg ? 'error' : isLoading ? 'loading' : 'empty'} msg={errMsg} onRetry={() => mutate()} />
          )}
        </div>

        {/* liquidity-by-price profile */}
        {prof && (
          <div style={{ flex: '0 0 220px', position: 'relative', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div onMouseMove={onProfHover} onMouseLeave={() => setProfHover(null)} style={{ position: 'absolute', left: 14, top: 14, right: 14, bottom: 30, overflow: 'visible' }}>
              <canvas ref={profRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
              {profHover && (
                <div style={{ pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: profHover.y, height: 1, background: 'var(--cross)' }} />
                  <div style={{ position: 'absolute', right: 0, top: profHover.y, transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 700, fontSize: 9.5, color: 'var(--tagink)', background: 'var(--tagbg)', borderRadius: 3, padding: '1px 4px' }}>${fmtPrice(profHover.price)}</div>
                </div>
              )}
              <div style={{ position: 'absolute', left: 0, top: -2, pointerEvents: 'none' }}>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', textShadow: '0 1px 4px var(--halo),0 0 3px var(--halo)' }}>Liquidation map · now</span>
                <ProfHead prof={prof} hover={profHover} />
              </div>
            </div>
            <div style={{ position: 'absolute', left: 14, right: 14, bottom: 6, height: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                <ProfLegendItem c="#1f9d55" arrow="▲" label="SHORTS" val={fmtUsd(prof.shortTotal)} />
                <ProfLegendItem c="#df5338" arrow="▼" label="LONGS" val={fmtUsd(prof.longTotal)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 24px', borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#7c5cff' }} />Liquidation leverage</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: '#1f9d55' }} />Price</span>
        </span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: 10.5, color: 'var(--faint)', whiteSpace: 'nowrap' }}>Live dataset · Apify liquidation-heatmap Actor</span>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, flex: '0 0 auto', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, color: '#7c5cff', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' };

const LH_CSS = `
.lhx{--bg:#e9e8e4;--panel:#ffffff;--ink:#1a1813;--muted:#9b988d;--faint:#a8a296;--border:#e7dffa;--divider:#f0ecfa;--navactive:#f1ecfb;--navink:#5b46c9;--dotidle:#d8d3ca;--tagbg:#1a1813;--tagink:#ffffff;--cross:rgba(40,36,28,0.32);--halo:#ffffff;}
.lhx[data-theme=dark]{--bg:#0b0913;--panel:#13101c;--ink:#f3eeff;--muted:#8b8699;--faint:#615c75;--border:rgba(255,255,255,0.09);--divider:rgba(255,255,255,0.08);--navactive:rgba(255,255,255,0.10);--navink:#cbb8ff;--dotidle:rgba(255,255,255,0.22);--tagbg:#e7e3f0;--tagink:#0a0613;--cross:rgba(255,255,255,0.24);--halo:#0a0613;}
@keyframes lhspin{to{transform:rotate(360deg);}}
body.lh-dragging,body.lh-dragging *{cursor:grabbing !important;}
.lh-rst .lh-rstlbl{max-width:0;overflow:hidden;opacity:0;white-space:nowrap;font-weight:700;font-size:10.5px;letter-spacing:0.04em;transition:max-width .22s ease,opacity .18s ease,margin-left .22s ease;}
.lh-rst:hover .lh-rstlbl{max-width:90px;opacity:1;margin-left:5px;}
`;

function Controls({ symbol, model, interval, onSym, onModel, onInterval }: { symbol: HeatSymbol; model: HeatModel; interval: HeatInterval; onSym: (v: HeatSymbol) => void; onModel: (v: HeatModel) => void; onInterval: (v: HeatInterval) => void }) {
  const btnRow = <T extends string>(opts: readonly T[], val: T, on: (v: T) => void, mono: boolean, fmt?: (o: T) => string) => (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {opts.map((o) => { const active = o === val; return (
        <button key={o} onClick={() => on(o)} style={{ cursor: 'pointer', border: 'none', borderRadius: 7, padding: '5px 10px 5px 8px', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono ? MONO : SANS, fontWeight: active ? 800 : 700, fontSize: 11, whiteSpace: 'nowrap', color: active ? 'var(--navink)' : 'var(--muted)', background: active ? 'var(--navactive)' : 'transparent', transition: 'all .14s' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto', background: active ? '#7c5cff' : 'var(--dotidle)' }} />{fmt ? fmt(o) : o}
        </button>
      ); })}
    </div>
  );
  const cell = (label: string, body: React.ReactNode, last?: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderRight: last ? 'none' : '1px solid var(--divider)' }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
      {body}
    </div>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' }}>
      {cell('Symbol', btnRow(SYMBOLS, symbol, onSym, false))}
      {cell('Model', btnRow(MODELS, model, onModel, false, (o) => 'Model ' + o.slice(5)))}
      {cell('Interval', btnRow(INTERVALS, interval, onInterval, true), true)}
    </div>
  );
}

function StatsStrip({ m, trend }: { m: NonNullable<ReturnType<typeof computeHeatmapMetrics>>; trend: { tllSeries: number[]; gapSeries: number[]; tllPrev: number | null; gapPrev: number | null } }) {
  const GRN = '#1f9d55', RED = '#df5338', PUR = '#7c5cff', MUT = 'var(--muted)';
  const label = (t: string) => <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: MUT, whiteSpace: 'nowrap' }}>{t}</span>;
  const big = (t: string) => <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{t}</span>;
  const bigA = (arrow: string, ac: string, num: string) => <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: ac, fontSize: 14 }}>{arrow}</span>{num}</span>;
  const sm = (t: string, c: string) => <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: c, whiteSpace: 'nowrap' }}>{t}</span>;
  const cell = (lab: string, kids: React.ReactNode, last?: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 20px', flex: '1 1 0', minWidth: 0, borderRight: last ? 'none' : '1px solid var(--divider)' }}>{label(lab)}<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', rowGap: 2 }}>{kids}</div></div>
  );
  const up = m.lcgGap >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' }}>
      {cell('Center of gravity', <>{big(fmtPrice(m.lcg))}{sm((up ? '▲ +' : '▼ −') + Math.abs(m.lcgGap).toFixed(2) + '%', up ? GRN : RED)}<GapDelta cur={m.lcgGap} prev={trend.gapPrev} /><Spark data={trend.gapSeries} color="#7c5cff" /></>)}
      {cell('Nearest magnet ↑', m.nearestAbove ? <>{bigA('↑', GRN, fmtPrice(m.nearestAbove.peakPrice))}{sm(fmtVal(m.nearestAbove.mass), PUR)}{sm('+' + m.nearestAbove.dist.toFixed(2) + '%', GRN)}</> : big('—'))}
      {cell('Nearest magnet ↓', m.nearestBelow ? <>{bigA('↓', RED, fmtPrice(m.nearestBelow.peakPrice))}{sm(fmtVal(m.nearestBelow.mass), PUR)}{sm('−' + m.nearestBelow.dist.toFixed(2) + '%', RED)}</> : big('—'))}
      {cell('Strongest wall', m.strongest ? <>{big(fmtPrice(m.strongest.peakPrice))}{sm(fmtVal(m.strongest.mass), PUR)}{sm(Math.round(m.strongest.share * 100) + '%', MUT)}</> : big('—'))}
      {cell('Leverage load · σ', <>{big(fmtVal(m.totalFuel))}<FuelDelta cur={m.totalFuel} prev={trend.tllPrev} /><Spark data={trend.tllSeries} color="#ef9512" />{sm('σ ' + m.sigma.toFixed(1) + '%', MUT)}</>, true)}
    </div>
  );
}

function FuelDelta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null || prev === 0) return <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>1st pt</span>;
  const pct = (cur / prev - 1) * 100, up = pct >= 0;
  return <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: up ? '#ef9512' : '#1f9d55' }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%</span>;
}
function GapDelta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev == null) return <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--faint)' }}>1st pt</span>;
  const d = cur - prev, up = d >= 0;
  return <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: up ? '#1f9d55' : '#df5338' }}>{up ? '▲' : '▼'}{Math.abs(d).toFixed(2)}pp</span>;
}
function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 46, h = 15, mn = Math.min(...data), mx = Math.max(...data), rng = mx - mn || 1;
  const x = (i: number) => (i / (data.length - 1)) * w, y = (v: number) => h - 1 - ((v - mn) / rng) * (h - 2);
  return (
    <svg width={w} height={h} style={{ display: 'block', flex: '0 0 auto' }}>
      <polyline points={data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={1.7} fill={color} />
    </svg>
  );
}

function PriceAxis({ prep, getView, marks }: { prep: Prepared; getView: () => View; marks: Mark[] }) {
  const V = getView(); if (!V) return null;
  const span = V.p1 - V.p0, step = niceStep(span, 7), els: React.ReactNode[] = [];
  for (let p = Math.ceil(V.p0 / step) * step; p <= V.p1; p += step) { const top = (V.p1 - p) / span * 100; els.push(<span key={'t' + Math.round(p)} style={{ position: 'absolute', right: 10, top: top + '%', transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 600, fontSize: 10, color: 'var(--muted)' }}>{fmtPrice(p)}</span>); }
  const last = +prep.cs[prep.cs.length - 1][4];
  if (last >= V.p0 && last <= V.p1) els.push(<div key="cur" style={{ position: 'absolute', right: 6, top: (V.p1 - last) / span * 100 + '%', transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 700, fontSize: 10, color: 'var(--tagink)', background: 'var(--tagbg)', borderRadius: 3, padding: '2px 5px' }}>{fmtPrice(last)}</div>);
  const mt = marks.filter((m) => m.price >= V.p0 && m.price <= V.p1).map((m) => ({ m, top: (V.p1 - m.price) / span * 100 })).sort((a, b) => a.top - b.top);
  let lastTop = -99;
  mt.forEach((t, i) => { if (t.top - lastTop < 3.2) t.top = lastTop + 3.2; lastTop = t.top; els.push(<div key={'m' + i} style={{ position: 'absolute', right: 6, top: t.top + '%', transform: 'translateY(-50%)', fontFamily: MONO, fontWeight: 700, fontSize: 9.5, color: '#fff', background: t.m.color, borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(40,36,28,0.3)' }}>{fmtPrice(t.m.price)}</div>); });
  return <>{els}</>;
}

function TimeAxis({ prep, getView }: { prep: Prepared; getView: () => View }) {
  const V = getView(); if (!V) return null;
  const cs = prep.cs, n = cs.length, span = V.x1 - V.x0, els: React.ReactNode[] = [];
  const stepCols = Math.max(1, Math.round(niceStep(span * (n - 1), 6))), c0 = Math.ceil(V.x0 * (n - 1) / stepCols) * stepCols;
  for (let ci = c0; ci <= V.x1 * (n - 1) + 0.001; ci += stepCols) { const idx = Math.min(n - 1, Math.max(0, Math.round(ci))), left = (ci / (n - 1) - V.x0) / span * 100; if (left < -2 || left > 102) continue; els.push(<span key={ci} style={{ position: 'absolute', left: left + '%', top: 3, transform: 'translateX(-50%)', fontFamily: MONO, fontWeight: 600, fontSize: 9.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtShort(+cs[idx][0])}</span>); }
  return <div style={{ position: 'absolute', left: 58, bottom: 6, right: 64, height: 20 }}>{els}</div>;
}

function Crosshair({ hv }: { hv: HoverState }) {
  const cardW = 208;
  let tx = hv.x + 16; if (tx + cardW > hv.w) tx = hv.x - 16 - cardW; if (tx < 2) tx = 2;
  let ty = hv.y + 14; if (ty + 44 > hv.h) ty = hv.y - 14 - 44; if (ty < 2) ty = 2;
  const lev = hv.lev >= 1e6 ? (hv.lev / 1e6).toFixed(2) + 'M' : hv.lev >= 1e3 ? (hv.lev / 1e3).toFixed(1) + 'K' : String(Math.round(hv.lev));
  const tag = (st: React.CSSProperties, txt: string) => <div style={{ position: 'absolute', zIndex: 30, fontFamily: MONO, fontWeight: 700, fontSize: 9.5, color: 'var(--tagink)', background: 'var(--tagbg)', borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap', boxShadow: '0 1px 6px rgba(0,0,0,0.5)', ...st }}>{txt}</div>;
  return (
    <div style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: hv.x, top: 0, width: 1, height: hv.h, background: 'var(--cross)' }} />
      <div style={{ position: 'absolute', top: hv.y, left: 0, height: 1, width: hv.w, background: 'var(--cross)' }} />
      {tag({ right: -62, top: hv.y, transform: 'translateY(-50%)' }, fmtPrice(hv.price))}
      <div style={{ position: 'absolute', left: hv.x, bottom: -27, transform: 'translateX(-50%)', zIndex: 30, fontFamily: MONO, fontWeight: 700, fontSize: 9.5, color: 'var(--tagink)', background: 'var(--tagbg)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 4, padding: '3px 8px', whiteSpace: 'nowrap' }}>{fmtCross(hv.ts)}</div>
      <div style={{ position: 'absolute', left: tx, top: ty, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,0.4)', padding: '11px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c5cff', flex: '0 0 auto' }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--muted)' }}>Liquidation Leverage</span>
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{lev}</span>
        </div>
      </div>
    </div>
  );
}

function ProfHead({ prof, hover }: { prof: Profile; hover: ProfHover | null }) {
  const wrap = (kids: React.ReactNode) => <div style={{ marginTop: 4, height: 34, display: 'flex', flexDirection: 'column', gap: 3, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 4px var(--halo),0 0 3px var(--halo)' }}>{kids}</div>;
  if (hover) {
    const side = hover.j > prof.priceJ ? 'short' : hover.j < prof.priceJ ? 'long' : null;
    const sc = side === 'short' ? '#1f9d55' : side === 'long' ? '#df5338' : 'var(--muted)';
    const slab = side === 'short' ? 'Short cum' : side === 'long' ? 'Long cum' : 'At price';
    return wrap(<>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>${fmtPrice(hover.price)}</span>
      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, color: '#7c5cff' }}>Liq {fmtUsd(prof.tot[hover.j])}</span>
        {side && <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10.5, color: sc }}>{slab} {fmtUsd(prof.cum[hover.j])}</span>}
      </div>
    </>);
  }
  return wrap(<div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
    <span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.05em', color: '#ef9512' }}>PEAK</span>
    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>${fmtPrice(prof.peakPrice)}</span>
  </div>);
}

function ProfLegendItem({ c, arrow, label, val }: { c: string; arrow: string; label: string; val: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: c, fontSize: 8.5 }}>{arrow}</span>
      <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, color: 'var(--ink)' }}>{val}</span>
    </div>
  );
}

function Overlay({ state, msg, onRetry }: { state: 'loading' | 'config' | 'error' | 'empty'; msg?: string; onRetry: () => void }) {
  const center: React.CSSProperties = { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 };
  if (state === 'loading') return <div style={center}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.4} strokeLinecap="round" style={{ animation: 'lhspin .8s linear infinite' }}><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /></svg><span style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)' }}>Running CoinGlass heatmap Actor…</span></div></div>;
  if (state === 'config') return <div style={center}><div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}><span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>Apify not connected</span><span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>Set <code style={{ fontFamily: MONO }}>APIFY_TOKEN</code> in <code style={{ fontFamily: MONO }}>.env.local</code> (and Vercel) to enable the liquidation heatmap.</span></div></div>;
  return <div style={center}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{state === 'empty' ? 'No heatmap data returned' : 'Couldn’t load the heatmap'}</span>{msg && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--muted)', maxWidth: 480, wordBreak: 'break-word' }}>{msg}</span>}<button onClick={onRetry} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 12, color: '#fff', background: '#7c5cff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>Retry</button></div></div>;
}
