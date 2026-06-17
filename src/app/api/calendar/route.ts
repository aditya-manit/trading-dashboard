import { NextResponse } from 'next/server';
import { enrichInsights, insightKey } from '@/lib/event-insight';
import type { CalendarEvent } from '@/hooks/useCalendar';

// ForexFactory's economic calendar, published by FairEconomy as a static JSON
// feed (no key). They ask consumers not to poll — fetch once and cache. We
// revalidate every 6h, which is well within their guidance. High-impact events
// are annotated with a Claude-generated "market reaction" line (cached
// in-process; skipped if ANTHROPIC_API_KEY is unset).
const FEED_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'user-agent': 'Mozilla/5.0 (trading-dashboard)' },
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const data: CalendarEvent[] = await res.json();

    if (Array.isArray(data)) {
      const high = data.filter((e) => e.impact === 'High');
      const insights = await enrichInsights(high.map((e) => ({ country: e.country, title: e.title })));
      for (const e of high) {
        const ins = insights[insightKey(e.country, e.title)];
        if (ins) e.insight = ins;
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
