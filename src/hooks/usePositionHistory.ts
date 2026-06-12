import useSWR from 'swr';
import type { GateFuturesPositionClose } from '@/types/gate';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePositionHistory() {
  return useSWR<GateFuturesPositionClose[]>('/api/gate/position-history', fetcher, {
    refreshInterval: 60_000,
  });
}
