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

// Liquidation heatmap for the chosen symbol/model/interval. The Actor run is
// slow-ish (CoinGlass scrape), so keep a generous dedupe + manual revalidate.
export function useHeatmap(symbol: HeatSymbol, model: HeatModel, interval: HeatInterval) {
  return useSWR<HeatmapData>(
    `/api/heatmap?symbol=${symbol}&model=${model}&interval=${interval}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, keepPreviousData: true },
  );
}
