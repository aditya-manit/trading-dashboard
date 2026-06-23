import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';
import { fetchHeatmapData, HeatmapFetchError } from '@/lib/apify-heatmap';

// Liquidation heatmap data, proxied from the Apify "coinglass-liquidation-heatmap"
// Actor (api_merge/coinglass-liquidation-heatmap). The Actor runs CoinGlass
// synchronously and returns one dataset item:
//   { success, message, y_axis:number[], liquidation_leverage_data:[xi,yi,val][],
//     price_candlesticks:[ts,o,h,l,c,v][], updateTime }
// Owner-gated (a run costs Apify compute units) behind the proxy. The actual fetch
// lives in lib/apify-heatmap so the daily cron capture can reuse it.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'BTC';
  const model = searchParams.get('model') || 'model1';
  const interval = searchParams.get('interval') || '24h';

  try {
    return NextResponse.json(await fetchHeatmapData(symbol, model, interval));
  } catch (err) {
    if (err instanceof HeatmapFetchError) {
      if (err.status === 501) return NextResponse.json({ configured: false }, { status: 501 });
      return NextResponse.json({ error: err.message, detail: err.detail }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
