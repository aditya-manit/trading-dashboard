import useSWR from 'swr';
import type { GateFuturesTrade } from '@/types/gate';

// coerce a non-array response (auth/error object) to [] so callers never crash.
const fetcher = (url: string): Promise<GateFuturesTrade[]> => fetch(url).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []));

export function useTrades(limit = 200) {
  return useSWR<GateFuturesTrade[]>(`/api/gate/trades?limit=${limit}`, fetcher, {
    refreshInterval: 60_000,
  });
}
