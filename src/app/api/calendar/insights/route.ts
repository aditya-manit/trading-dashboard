import { NextResponse } from 'next/server';
import { enrichReactions, enrichPrints, insightKey, btcDailyMoves, btcWindowMove } from '@/lib/event-insight';
import { isBtcRelevant } from '@/lib/calendar-filter';
import type { CalendarEvent, EventInsight } from '@/hooks/useCalendar';

// The slow half of the calendar: Claude-generated reactions (all relevant
// events) + web-searched, Gate-measured "2 prints" (the 4 strip cards).
// Returned as a map keyed by `currency|title` so the client can merge it onto
// the fast feed and skeleton these rows until it arrives.
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
    const relevant = data
      .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() >= nowMs)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const strip = relevant.slice(0, 4); // only these get the web-searched prints

    const [reactions, printsMap, moves] = await Promise.all([
      enrichReactions(relevant.map((e) => ({ country: e.country, title: e.title }))),
      enrichPrints(strip.map((e) => ({ country: e.country, title: e.title }))),
      btcDailyMoves(),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const out: Record<string, EventInsight> = {};
    for (const e of relevant) {
      const r = reactions[insightKey(e.country, e.title)];
      if (!r) continue;
      // The print fires at the SAME ET time as the upcoming event — reuse its
      // time-of-day (incl. offset) so each print date gets the right release ts.
      const timeSuffix = e.date.length > 10 ? e.date.slice(10) : 'T12:00:00Z';
      const raw = (printsMap[insightKey(e.country, e.title)] ?? [])
        .filter((p) => p.date < today) // completed past occurrences only
        .slice(0, 2);
      const prints = (await Promise.all(raw.map(async (p) => {
        const pct = moves.get(p.date); // whole-day move
        if (typeof pct !== 'number') return null;
        const reactPct = await btcWindowMove(new Date(p.date + timeSuffix).getTime(), 4); // 4h reaction
        return { date: p.date, pct, reactPct };
      }))).filter((p): p is { date: string; pct: number; reactPct: number | undefined } => p !== null);
      out[insightKey(e.country, e.title)] = { condition: r.condition, assets: r.assets, prints };
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({});
  }
}
