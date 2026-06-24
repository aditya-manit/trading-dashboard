import type { HeatmapData } from '@/hooks/useHeatmap';

// Derived liquidation-heatmap metrics, computed from the SAME /api/heatmap payload
// (no extra Actor run). Everything works in ABSOLUTE USD notional (`value`), never
// the normalized color — brightness is val/max and would mislead. See the long
// design discussion: clusters are grouped walls, distance is %, size is share of
// total fuel, and the proximity scale τ is the window's realized volatility
// (self-tuning across 12h/24h/1w), floored so a dead-flat window can't collapse it.

export interface Cluster {
  lo: number;        // zone low price (the dense CORE — see CORE_FRAC)
  hi: number;        // zone high price (core)
  peakPrice: number; // price of the strongest level in the zone (the magnet line)
  peak: number;      // value of that single strongest level (USD) — magnets report this
  mass: number;      // Σ surviving fuel in the CORE band (USD) — wall reports this
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
const CORE_FRAC = 0.35;    // a wall's reported band = contiguous levels ≥ 35% of its peak
                           // (a moderate dense core), so a broad smear collapses to its center
                           // without shrinking to a single cell (0.5 = tighter, 0.25 = wider)

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

  // 2) Group adjacent above-baseline levels into runs, then report each as its
  //    dense CORE (contiguous levels ≥ CORE_FRAC of the run's peak around that
  //    peak) — so a broad continuous smear collapses to its bright center
  //    instead of a 2%-wide band. mass/lo/hi describe the core; peak is the
  //    single strongest level.
  const gap = GAP_FRAC * price;
  const runs: { p: number; v: number }[][] = [];
  let cur: { p: number; v: number }[] | null = null;
  for (const r of levels) {
    if (r.v > baseline) {
      if (cur && r.p - cur[cur.length - 1].p <= gap) cur.push(r);
      else { if (cur) runs.push(cur); cur = [r]; }
    } else if (cur && r.p - cur[cur.length - 1].p > gap) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);

  const clusters: Cluster[] = runs.map((mem) => {
    let pi = 0; for (let i = 1; i < mem.length; i++) if (mem[i].v > mem[pi].v) pi = i;
    const peak = mem[pi].v, floor = CORE_FRAC * peak;
    let a = pi, b = pi;
    while (a - 1 >= 0 && mem[a - 1].v >= floor) a--;
    while (b + 1 < mem.length && mem[b + 1].v >= floor) b++;
    let mass = 0; for (let i = a; i <= b; i++) mass += mem[i].v;
    const peakPrice = mem[pi].p, dist = Math.abs(peakPrice / price - 1) * 100;
    return { lo: mem[a].p, hi: mem[b].p, peakPrice, peak, mass, share: totalFuel ? mass / totalFuel : 0, dist, side: peakPrice >= price ? 'above' : 'below', score: 0 };
  });

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
