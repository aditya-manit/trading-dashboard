import { NextResponse } from 'next/server';

// ForexFactory's economic calendar, published by FairEconomy as a static JSON
// feed (no key). They ask consumers not to poll — fetch once and cache. We
// revalidate every 6h, which is well within their guidance.
//
// This route returns ONLY the raw feed (fast) so cards can render immediately;
// the slow Claude/Gate enrichment lives in /api/calendar/insights, fetched
// separately so its rows can show skeletons while it loads.
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
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
