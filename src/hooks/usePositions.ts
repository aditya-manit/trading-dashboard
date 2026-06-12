import useSWR from 'swr';
import type { GateFuturesPosition } from '@/types/gate';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePositions() {
  return useSWR<GateFuturesPosition[]>('/api/gate/positions', fetcher, {
    refreshInterval: 15_000,
  });
}
