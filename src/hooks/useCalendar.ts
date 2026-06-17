import useSWR from 'swr';

// One event from the ForexFactory / FairEconomy economic-calendar feed.
// `country` actually holds the currency code (USD, EUR, JPY…); `date` is
// ISO-8601 with a US-Eastern offset baked in. There is no `actual` field.
export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: 'Low' | 'Medium' | 'High' | 'Holiday' | string;
  forecast: string;
  previous: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useCalendar() {
  return useSWR<CalendarEvent[]>('/api/calendar', fetcher, {
    refreshInterval: 1_800_000, // 30 min (route itself caches 6h upstream)
    revalidateOnFocus: false,
  });
}
