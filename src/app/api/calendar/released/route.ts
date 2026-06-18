import { NextResponse } from 'next/server';
import { enrichReleased, insightKey } from '@/lib/event-insight';
import { isBtcRelevant } from '@/lib/calendar-filter';
import type { CalendarEvent, ReleasedInfo } from '@/hooks/useCalendar';

// Already-released relevant events this week: actual figure + surprise +
// realized reaction (Claude web search, persisted). Keyed by `currency|title`.
// No cap: the feed is week-scoped and the BTC filter is strict, so this is
// naturally ~10-12 events — we enrich the whole week so the drawer's Released
// tab is always complete. Web search is capped 5-concurrent in enrichReleased
// and settled events are archived (never re-fetched), so it's a one-time cost.
const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'user-agent': 'Mozilla/5.0 (trading-dashboard)' },
      next: { revalidate: 21600 },
    });
    if (!res.ok) return NextResponse.json({});
    const data: CalendarEvent[] = await res.json();
    if (!Array.isArray(data)) return NextResponse.json({});

    const nowMs = Date.now();
    const released = data
      .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() < nowMs)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const map = await enrichReleased(released.map((e) => ({ country: e.country, title: e.title, date: e.date, forecast: e.forecast })));
    const out: Record<string, ReleasedInfo> = {};
    for (const e of released) {
      const info = map[insightKey(e.country, e.title)];
      if (info) out[insightKey(e.country, e.title)] = info;
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({});
  }
}
