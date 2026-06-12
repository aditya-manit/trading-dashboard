import useSWR from 'swr';
import type { GateFuturesTrade } from '@/types/gate';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useTrades(limit = 200) {
  return useSWR<GateFuturesTrade[]>(`/api/gate/trades?limit=${limit}`, fetcher, {
    refreshInterval: 60_000,
  });
}
