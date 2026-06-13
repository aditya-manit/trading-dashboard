'use client';

import useSWR from 'swr';

export interface BtcCandle {
  t: number;
  c: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

// from: unix timestamp (seconds) — the start of the equity data window.
// Pass it so the route fetches candles starting from that date rather than
// always returning the newest 365 days (which would miss older equity points).
export function useBtcCandles(from?: number) {
  const limit = 400; // enough headroom for any range
  const url = from
    ? `/api/gate/btc-candles?from=${from}&limit=${limit}`
    : null; // don't fetch until we know the equity start time

  return useSWR<BtcCandle[]>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3_600_000,
  });
}
