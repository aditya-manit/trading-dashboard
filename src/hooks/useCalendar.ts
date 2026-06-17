import useSWR from 'swr';

export type AssetDir = 'up' | 'down' | 'flat';

// Editorial "market reaction" annotation, generated server-side (Claude) for
// high-impact events: the bullish-for-the-currency scenario and likely moves.
export interface EventInsight {
  condition: string;
  assets: { sym: string; dir: AssetDir }[];
  // Last ≤2 occurrences of this event: the date (Claude's estimate of when the
  // event last fired) + BTC's measured daily % move on that date (from Gate).
  prints?: { date: string; pct: number }[];
}

// One event from the ForexFactory / FairEconomy economic-calendar feed.
// `country` actually holds the currency code (USD, EUR, JPY…); `date` is
// ISO-8601 with a US-Eastern offset baked in. There is no `actual` field.
// `insight` is attached by /api/calendar for high-impact events.
export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: 'Low' | 'Medium' | 'High' | 'Holiday' | string;
  forecast: string;
  previous: string;
  insight?: EventInsight;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Identity used to merge insights onto feed events.
export const eventKey = (e: { country: string; title: string }) => `${e.country}|${e.title}`;

// Fast: the raw economic-calendar feed (renders cards immediately).
export function useCalendar() {
  return useSWR<CalendarEvent[]>('/api/calendar', fetcher, {
    refreshInterval: 1_800_000, // 30 min (route itself caches 6h upstream)
    revalidateOnFocus: false,
  });
}

// Slow: Claude/Gate enrichment (reaction + "2 prints"), keyed by `currency|title`.
// Cards skeleton these rows until this resolves.
export function useCalendarInsights() {
  return useSWR<Record<string, EventInsight>>('/api/calendar/insights', fetcher, {
    refreshInterval: 1_800_000,
    revalidateOnFocus: false,
  });
}
