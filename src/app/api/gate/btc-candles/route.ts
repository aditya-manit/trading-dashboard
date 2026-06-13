import { NextResponse } from 'next/server';

// Gate.io spot candlestick returns array-of-arrays:
// [time_str, quote_volume, close, high, low, open, ...]
// We normalise to { t: number, c: string } before sending to client.

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') ?? '400';
  const from  = searchParams.get('from');

  const params = new URLSearchParams({ currency_pair: 'BTC_USDT', interval: '1d', limit });
  if (from) params.set('from', from);

  try {
    const res = await fetch(
      `https://api.gateio.ws/api/v4/spot/candlesticks?${params}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json([]);

    const raw: string[][] = await res.json();
    // Normalise: index 0 = unix time (string), index 2 = close price (string)
    const data = raw.map(c => ({ t: parseInt(c[0], 10), c: c[2] }));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
