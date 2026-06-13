import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') ?? '365';
  const from = searchParams.get('from');
  const interval = searchParams.get('interval') ?? '1d';

  const params = new URLSearchParams({ contract: 'BTC_USDT', interval, limit });
  if (from) params.set('from', from);

  try {
    const res = await fetch(
      `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?${params}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
