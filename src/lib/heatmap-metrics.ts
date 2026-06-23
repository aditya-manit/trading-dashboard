import type { HeatmapData } from '@/hooks/useHeatmap';

// Derived liquidation-heatmap metrics, computed from the SAME /api/heatmap payload
// (no extra Actor run). Everything works in ABSOLUTE USD notional (`value`), never
// the normalized color — brightness is val/max and would mislead. See the long
// design discussion: clusters are grouped walls, distance is %, size is share of
// total fuel, and the proximity scale τ is the window's realized volatility
// (self-tuning across 12h/24h/1w), floored so a dead-flat window can't collapse it.

export interface Cluster {
  lo: number;        // zone low price
  hi: number;        // zone high price
  peakPrice: number; // price of the strongest level in the zone (the magnet line)
  mass: number;      // Σ surviving fuel in the zone (USD)
  share: number;     // mass / totalFuel  (0..1, scale-free)
  dist: number;      // |peakPrice − price| / price × 100  (% from current price)
  side: 'above' | 'below';
  score: number;     // size-aware proximity score: share · exp(−dist/τ)
}

export interface HeatmapMetrics {
  price: number;          // current price (last close)
  sigma: number;          // realized window volatility, % (1σ move)
  tau: number;            // proximity scale used = max(0.5, sigma), %
  totalFuel: number;      // Σ surviving fuel across all levels (USD) — "TLL"
  clusterCount: number;
  nearestAbove: Cluster | null; // top size-aware magnet above price
  nearestBelow: Cluster | null; // top size-aware magnet below price
  strongest: Cluster | null;    // biggest wall overall (pure mass, distance-agnostic)
  lcg: number;            // liquidation center of gravity (fuel-weighted price)
  lcgGap: number;         // (lcg / price − 1) × 100  (>0 ⇒ fuel sits above ⇒ upward pull)
}

// Tunables (documented design choices, not magic — see discussion).
const NOW_FRAC = 0.02;     // "now" edge = last max(3, 2% of columns)
const GAP_FRAC = 0.0025;   // merge adjacent active levels within 0.25% of price
const TAU_FLOOR = 0.5;     // % — safety rail for near-zero-vol windows

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function computeHeatmapMetrics(d: HeatmapData | undefined | null): HeatmapMetrics | null {
  if (!d || !d.y_axis?.length || !d.price_candlesticks?.length || !d.liquidation_leverage_data?.length) return null;
  const cs = d.price_candlesticks, X = cs.length;
  const price = +cs[X - 1][4];
  if (!(price > 0)) return null;

  // 1) Surviving fuel per price level = max over the last w columns (the "now" edge).
  const w = Math.max(3, Math.round(NOW_FRAC * X));
  const L = new Map<number, number>();
  for (const [xi, yi, v] of d.liquidation_leverage_data) {
    if (xi >= X - w) {
      const p = d.y_axis[yi];
      if (p === undefined) continue;
      if (!L.has(p) || v > (L.get(p) as number)) L.set(p, v);
    }
  }
  const levels = [...L.entries()].map(([p, v]) => ({ p, v })).sort((a, b) => a.p - b.p);
  if (!levels.length) return null;

  const totalFuel = levels.reduce((s, r) => s + r.v, 0);
  const baseline = median(levels.filter((r) => r.v > 0).map((r) => r.v));

  // 2) Group adjacent above-baseline levels into clusters (walls).
  const gap = GAP_FRAC * price;
  const clusters: Cluster[] = [];
  let cur: { lo: number; hi: number; mass: number; peak: number; peakPrice: number } | null = null;
  const flush = () => {
    if (!cur) return;
    const dist = Math.abs(cur.peakPrice / price - 1) * 100;
    clusters.push({
      lo: cur.lo, hi: cur.hi, peakPrice: cur.peakPrice, mass: cur.mass,
      share: totalFuel ? cur.mass / totalFuel : 0, dist,
      side: cur.peakPrice >= price ? 'above' : 'below', score: 0,
    });
    cur = null;
  };
  for (const r of levels) {
    if (r.v > baseline) {
      if (cur && r.p - cur.hi <= gap) {
        cur.hi = r.p; cur.mass += r.v;
        if (r.v > cur.peak) { cur.peak = r.v; cur.peakPrice = r.p; }
      } else { flush(); cur = { lo: r.p, hi: r.p, mass: r.v, peak: r.v, peakPrice: r.p }; }
    } else if (cur && r.p - cur.hi > gap) { flush(); }
  }
  flush();

  // 3) τ = realized window volatility (1σ move %), floored.
  const rets: number[] = [];
  for (let i = 1; i < X; i++) rets.push(Math.log(+cs[i][4] / +cs[i - 1][4]));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));
  const sigma = sd * Math.sqrt(rets.length) * 100;
  const tau = Math.max(TAU_FLOOR, sigma);

  // Metric 1 — size-aware proximity score, top per side.
  for (const c of clusters) c.score = c.share * Math.exp(-c.dist / tau);
  const best = (side: 'above' | 'below') =>
    clusters.filter((c) => c.side === side).sort((a, b) => b.score - a.score)[0] || null;
  const nearestAbove = best('above');
  const nearestBelow = best('below');

  // Metric 2 — strongest wall (pure mass).
  const strongest = clusters.length ? [...clusters].sort((a, b) => b.mass - a.mass)[0] : null;

  // Metric 3 — liquidation center of gravity (baseline-subtracted fuel-weighted price).
  let num = 0, den = 0;
  for (const r of levels) { const ex = Math.max(0, r.v - baseline); num += r.p * ex; den += ex; }
  const lcg = den ? num / den : price;
  const lcgGap = (lcg / price - 1) * 100;

  return { price, sigma, tau, totalFuel, clusterCount: clusters.length, nearestAbove, nearestBelow, strongest, lcg, lcgGap };
}
