import { NextResponse } from 'next/server';
import { gateRequest } from '@/lib/gate-client';
import type { GateAccountBookEntry } from '@/types/gate';

// Gate.io account_book constraints:
//   - max time range per request: 30 days
//   - no absolute lookback limit (can go back years)
// Strategy: walk backwards in 30-day windows, paginate by offset within each window,
// stop after 2 consecutive empty windows (means we've passed account creation).

const LIMIT = 1000;
const WINDOW = 30 * 86400;
const MAX_WINDOWS = 6;           // 6 × 30 days = 180 days (Gate.io hard limit)
const MAX_PAGES_PER_WINDOW = 20; // 20 × 1000 = 20k entries per window max

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const seen = new Set<string>();
    const all: GateAccountBookEntry[] = [];
    let emptyWindows = 0;

    for (let w = 0; w < MAX_WINDOWS; w++) {
      const to   = now - w * WINDOW;
      const from = to  - WINDOW;
      let offset = 0;
      let windowCount = 0;

      for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
        const batch = await gateRequest<GateAccountBookEntry[]>(
          '/futures/usdt/account_book',
          { limit: String(LIMIT), offset: String(offset), from: String(from), to: String(to) },
        );
        if (!Array.isArray(batch) || batch.length === 0) break;

        for (const e of batch) {
          const key = `${e.time}_${e.type}_${e.change}`;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(e);
            windowCount++;
          }
        }
        if (batch.length < LIMIT) break;
        offset += LIMIT;
      }

      if (windowCount === 0) {
        emptyWindows++;
        if (emptyWindows >= 2) break;
      } else {
        emptyWindows = 0;
      }
    }

    all.sort((a, b) => a.time - b.time);
    return NextResponse.json(all);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
