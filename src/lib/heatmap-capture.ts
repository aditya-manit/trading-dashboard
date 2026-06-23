import { fetchHeatmapData } from './apify-heatmap';
import { computeHeatmapMetrics } from './heatmap-metrics';
import { supabaseAdmin } from './supabase/admin';

// Capture the canonical heatmap metrics for today (one row per symbol+interval in
// heatmap_metrics_daily). Called by the daily cron (folded into /api/keepalive so
// we stay within Vercel Hobby's one-cron limit) AND opportunistically on page load.
// Best-effort: each pull is independent and failures don't throw, so a transient
// Apify "run-failed" just skips that day rather than breaking the keepalive ping.

// Keep this small — each entry is one Apify Actor run/day (compute units). BTC 24h
// is the canonical daily read (TLL/LCG are window-dependent, so we trend per interval).
const CANONICAL: { symbol: string; model: string; interval: string }[] = [
  { symbol: 'BTC', model: 'model1', interval: '24h' },
];

export async function captureDailyHeatmapMetrics() {
  const sb = supabaseAdmin();
  if (!sb) return { ok: false, reason: 'no-supabase' as const };
  const day = new Date().toISOString().slice(0, 10); // UTC
  const results: { symbol: string; interval: string; ok: boolean; reason?: string }[] = [];
  for (const c of CANONICAL) {
    try {
      const data = await fetchHeatmapData(c.symbol, c.model, c.interval);
      const m = computeHeatmapMetrics(data);
      if (!m) { results.push({ symbol: c.symbol, interval: c.interval, ok: false, reason: 'no-metrics' }); continue; }
      const { error } = await sb.from('heatmap_metrics_daily').upsert({
        day, symbol: c.symbol, interval: c.interval,
        price: m.price, tll: m.totalFuel, lcg: m.lcg, lcg_gap: m.lcgGap, updated_at: new Date().toISOString(),
      });
      results.push({ symbol: c.symbol, interval: c.interval, ok: !error, reason: error?.message });
    } catch (e) {
      results.push({ symbol: c.symbol, interval: c.interval, ok: false, reason: String(e) });
    }
  }
  return { ok: true, day, results };
}
