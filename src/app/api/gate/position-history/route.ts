import { NextResponse } from 'next/server';
import { gateRequest } from '@/lib/gate-client';
import type { GateFuturesPositionClose } from '@/types/gate';

// Gate.io constraint: `from` cannot be more than 180 days before now (absolute, not relative to `to`).
// Solution: use from = now-179d, to = now, then paginate by offset within that window.
const LIMIT = 1000;
const MAX_PAGES = 50;

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 179 * 86400; // stay just inside the 180-day limit

    const all: GateFuturesPositionClose[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await gateRequest<GateFuturesPositionClose[]>(
        '/futures/usdt/position_close',
        { limit: String(LIMIT), offset: String(offset), from: String(from), to: String(now) },
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < LIMIT) break;
      offset += LIMIT;
    }

    all.sort((a, b) => b.time - a.time); // newest first
    return NextResponse.json(all);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
