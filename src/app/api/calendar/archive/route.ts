import { NextResponse } from 'next/server';
import { getArchive } from '@/lib/event-insight';
import type { ReleasedInfo } from '@/hooks/useCalendar';

// Full released-event archive — EVERY settled relevant event, all weeks (not
// just the current ForexFactory feed). Powers the news drawer's "All" toggle.
// occ_key = `currency|title|YYYY-MM-DD`; returns events sorted newest-first.

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const arch = await getArchive();
    const events = Object.entries(arch).map(([k, info]) => {
      const parts = k.split('|');
      const country = parts[0];
      const date = parts[parts.length - 1];
      const title = parts.slice(1, -1).join('|');
      return { country, title, date, info: info as ReleasedInfo };
    }).sort((a, b) => b.date.localeCompare(a.date)); // date descending
    return NextResponse.json(events);
  } catch {
    return NextResponse.json([]);
  }
}
