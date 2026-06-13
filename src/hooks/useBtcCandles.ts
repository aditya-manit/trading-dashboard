'use client';

import useSWR from 'swr';

export interface BtcCandle {
  t: number;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useBtcCandles(limit = 365) {
  return useSWR<BtcCandle[]>(
    `/api/gate/btc-candles?limit=${limit}&interval=1d`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 3_600_000 }
  );
}
