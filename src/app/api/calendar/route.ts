import { NextResponse } from 'next/server';
import { enrichInsights, insightKey, btcDailyMoves } from '@/lib/event-insight';
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
      // Only enrich the 4 cards the strip actually shows (next upcoming
      // high-impact, by time) — not every event in the drawer. Keeps the
      // web-search + candle work to what's displayed.
      const nowMs = Date.now();
      const strip = data
        .filter((e) => e.impact === 'High' && new Date(e.date).getTime() >= nowMs)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

      const [insights, moves] = await Promise.all([
        enrichInsights(strip.map((e) => ({ country: e.country, title: e.title }))),
        btcDailyMoves(),
      ]);
      for (const e of strip) {
        const ins = insights[insightKey(e.country, e.title)];
        if (!ins) continue;
        // Fill each print's % with BTC's real move on that date; drop dates we
        // have no candle for (out of range / future / mis-estimated).
        const prints = (ins.prints ?? [])
          .map((p) => ({ date: p.date, pct: moves.get(p.date) }))
          .filter((p): p is { date: string; pct: number } => typeof p.pct === 'number')
          .slice(0, 2);
        e.insight = { ...ins, prints };
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
