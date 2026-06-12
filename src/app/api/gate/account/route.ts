import { NextResponse } from 'next/server';
import { gateRequest } from '@/lib/gate-client';
import type { GateFuturesAccount } from '@/types/gate';

export async function GET() {
  try {
    const account = await gateRequest<GateFuturesAccount>('/futures/usdt/accounts');
    return NextResponse.json(account);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
