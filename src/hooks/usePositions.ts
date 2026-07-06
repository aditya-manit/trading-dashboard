import useSWR from 'swr';
import type { GateFuturesPosition } from '@/types/gate';

// coerce a non-array response (e.g. an auth/error object) to [] so callers that
// .find/.filter/.map never crash when the API fails.
const fetcher = (url: string): Promise<GateFuturesPosition[]> => fetch(url).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []));

export function usePositions() {
  return useSWR<GateFuturesPosition[]>('/api/gate/positions', fetcher, {
    refreshInterval: 15_000,
  });
}
