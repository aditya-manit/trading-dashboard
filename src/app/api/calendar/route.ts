import { NextResponse } from 'next/server';
import { enrichReactions, enrichPrints, insightKey, btcDailyMoves } from '@/lib/event-insight';
import { isBtcRelevant } from '@/lib/calendar-filter';
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
      const nowMs = Date.now();
      const relevant = data
        .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() >= nowMs)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const strip = relevant.slice(0, 4); // only these get the web-searched prints

      const [reactions, printsMap, moves] = await Promise.all([
        enrichReactions(relevant.map((e) => ({ country: e.country, title: e.title }))),
        enrichPrints(strip.map((e) => ({ country: e.country, title: e.title }))),
        btcDailyMoves(),
      ]);

      for (const e of relevant) {
        const r = reactions[insightKey(e.country, e.title)];
        if (!r) continue;
        // Prints only for the strip cards; fill each with BTC's real move on
        // that date, dropping any we have no candle for.
        const prints = (printsMap[insightKey(e.country, e.title)] ?? [])
          .map((p) => ({ date: p.date, pct: moves.get(p.date) }))
          .filter((p): p is { date: string; pct: number } => typeof p.pct === 'number')
          .slice(0, 2);
        e.insight = { condition: r.condition, assets: r.assets, prints };
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
