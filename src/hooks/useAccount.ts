import useSWR from 'swr';
import type { GateFuturesAccount } from '@/types/gate';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAccount() {
  return useSWR<GateFuturesAccount>('/api/gate/account', fetcher, {
    refreshInterval: 30_000,
  });
}
