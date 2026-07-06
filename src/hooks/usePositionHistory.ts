import useSWR from 'swr';
import type { GateFuturesPositionClose } from '@/types/gate';

// coerce a non-array response (auth/error object) to [] so callers never crash.
const fetcher = (url: string): Promise<GateFuturesPositionClose[]> => fetch(url).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []));

export function usePositionHistory() {
  return useSWR<GateFuturesPositionClose[]>('/api/gate/position-history', fetcher, {
    refreshInterval: 60_000,
  });
}
