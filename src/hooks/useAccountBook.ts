import useSWR from 'swr';
import type { GateAccountBookEntry } from '@/types/gate';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAccountBook() {
  return useSWR<GateAccountBookEntry[]>('/api/gate/account-book', fetcher, {
    refreshInterval: 60_000,
  });
}
