import type { HeatmapData } from '@/hooks/useHeatmap';

// Shared server-side fetch of the Apify "coinglass-liquidation-heatmap" Actor,
// used by both /api/heatmap (interactive) and the daily capture (cron). APIFY_TOKEN
// is server-only — never exposed to the client (same rule as the Gate/Anthropic keys).

const ACTOR = 'api_merge~coinglass-liquidation-heatmap';
export const HEAT_SYMBOLS = new Set(['BTC', 'ETH', 'SOL']);
export const HEAT_MODELS = new Set(['model1', 'model2', 'model3']);
export const HEAT_INTERVALS = new Set(['12h', '24h', '48h', '3d', '1w', '2w', '1mo', '3mo']);

// Carries the HTTP status the route should surface (501 unconfigured / 400 bad / 502 upstream).
export class HeatmapFetchError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function fetchHeatmapData(symbol: string, model: string, interval: string): Promise<HeatmapData> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new HeatmapFetchError('not configured', 501);
  const sym = symbol.toUpperCase();
  if (!HEAT_SYMBOLS.has(sym) || !HEAT_MODELS.has(model) || !HEAT_INTERVALS.has(interval)) {
    throw new HeatmapFetchError('bad symbol/model/interval', 400);
  }
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ symbol: sym, model, interval }), cache: 'no-store' },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HeatmapFetchError(`apify ${res.status}`, 502, body.slice(0, 300));
  }
  const items = (await res.json()) as unknown;
  const item = Array.isArray(items) ? items[0] : items;
  if (!item || typeof item !== 'object') throw new HeatmapFetchError('empty actor result', 502);
  return item as HeatmapData;
}
