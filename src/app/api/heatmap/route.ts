import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth-guard';

// Liquidation heatmap data, proxied from the Apify "coinglass-liquidation-heatmap"
// Actor (api_merge/coinglass-liquidation-heatmap). APIFY_TOKEN is server-only —
// never exposed to the client (same rule as the Gate/Anthropic keys). The Actor
// runs CoinGlass synchronously and returns one dataset item:
//   { success, message, y_axis:number[], liquidation_leverage_data:[xi,yi,val][],
//     price_candlesticks:[ts,o,h,l,c,v][], updateTime }
// Owner-gated (a run costs Apify compute units) behind the proxy.

const ACTOR = 'api_merge~coinglass-liquidation-heatmap';
const TOKEN = process.env.APIFY_TOKEN;

const SYMBOLS = new Set(['BTC', 'ETH', 'SOL']);
const MODELS = new Set(['model1', 'model2', 'model3']);
const INTERVALS = new Set(['12h', '24h', '48h', '3d', '1w', '2w', '1mo', '3mo']);

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  if (!TOKEN) return NextResponse.json({ configured: false }, { status: 501 });

  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || 'BTC').toUpperCase();
  const model = searchParams.get('model') || 'model1';
  const interval = searchParams.get('interval') || '24h';
  if (!SYMBOLS.has(symbol) || !MODELS.has(model) || !INTERVALS.has(interval)) {
    return NextResponse.json({ error: 'bad symbol/model/interval' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(TOKEN)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol, model, interval }),
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({ error: `apify ${res.status}`, detail: body.slice(0, 300) }, { status: 502 });
    }
    const items = (await res.json()) as unknown;
    const item = Array.isArray(items) ? items[0] : items;
    if (!item || typeof item !== 'object') {
      return NextResponse.json({ error: 'empty actor result' }, { status: 502 });
    }
    return NextResponse.json(item);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
