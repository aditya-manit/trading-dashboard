import { NextResponse } from 'next/server';
import { getDefinitions } from '@/lib/event-definitions';
import { isBtcRelevant } from '@/lib/calendar-filter';
import type { CalendarEvent } from '@/hooks/useCalendar';

// Plain-language definitions for the relevant events' titles, shown on hover.
// Cache-first (curated seed + on-disk cache); only brand-new titles hit Claude,
// and they're persisted after. Returns a { title → definition } map.
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
    const titles = data
      .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() >= nowMs)
      .map((e) => e.title);

    return NextResponse.json(await getDefinitions(titles));
  } catch {
    return NextResponse.json({});
  }
}
