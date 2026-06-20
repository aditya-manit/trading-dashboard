import { NextResponse } from 'next/server';
import { gateRequest } from '@/lib/gate-client';
import { requireOwner } from '@/lib/auth-guard';
import type { GateFuturesPosition } from '@/types/gate';

export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;
  try {
    const positions = await gateRequest<GateFuturesPosition[]>(
      '/futures/usdt/positions',
      { contract: 'BTC_USDT' },
    );
    const open = positions.filter((p) => p.size !== 0);
    return NextResponse.json(open);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
