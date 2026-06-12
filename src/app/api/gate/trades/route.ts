import { NextResponse } from 'next/server';
import { gateRequest } from '@/lib/gate-client';
import type { GateFuturesTrade } from '@/types/gate';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ?? '200';
  const offset = searchParams.get('offset') ?? '0';

  try {
    const trades = await gateRequest<GateFuturesTrade[]>('/futures/usdt/my_trades', {
      contract: 'BTC_USDT',
      limit,
      offset,
    });
    return NextResponse.json(trades);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
