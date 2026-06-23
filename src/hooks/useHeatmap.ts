import useSWR from 'swr';

// One dataset item from the Apify coinglass-liquidation-heatmap Actor.
export interface HeatmapData {
  success?: boolean;
  message?: string;
  y_axis: number[];                              // price levels (Y axis)
  liquidation_leverage_data: [number, number, number][]; // [xIndex, yIndex, value]
  price_candlesticks: [number, string, string, string, string, string][]; // [tsSec, o, h, l, c, v]
  updateTime?: number;
  configured?: boolean;                          // false → APIFY_TOKEN unset server-side
  error?: string;
}

export type HeatSymbol = 'BTC' | 'ETH' | 'SOL';
export type HeatModel = 'model1' | 'model2' | 'model3';
export type HeatInterval = '12h' | '24h' | '48h' | '3d' | '1w' | '2w' | '1mo' | '3mo';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Liquidation heatmap for the chosen symbol/model/interval. CACHE-FIRST: the
// Actor run costs Apify compute units, so we fetch a given symbol/model/interval
// ONCE (first mount with no cached data) and never auto-revalidate after that —
// reopening the tab serves the cached chart. Fresh data is on-demand only:
// changing a control (new cache key → one fetch) or the manual Refresh button
// (`mutate()`). `revalidateIfStale:false` is what suppresses the on-mount/on-
// remount refetch; focus/reconnect revalidation is off too.
export function useHeatmap(symbol: HeatSymbol, model: HeatModel, interval: HeatInterval) {
  return useSWR<HeatmapData>(
    `/api/heatmap?symbol=${symbol}&model=${model}&interval=${interval}`,
    fetcher,
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
    },
  );
}

// Daily metric history (TLL + center-of-gravity), per symbol+interval, oldest→newest.
// Powers the strip's day-over-day Δ + sparklines. Cheap (Supabase read, no Actor run).
export interface HeatmapDailyRow { day: string; price: number; tll: number; lcg: number; lcg_gap: number }
export function useHeatmapHistory(symbol: HeatSymbol, interval: HeatInterval) {
  return useSWR<{ configured: boolean; history: HeatmapDailyRow[] }>(
    `/api/heatmap/metrics?symbol=${symbol}&interval=${interval}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}
