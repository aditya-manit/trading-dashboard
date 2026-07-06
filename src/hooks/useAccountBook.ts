import useSWR from 'swr';
import type { GateAccountBookEntry } from '@/types/gate';

// coerce a non-array response (auth/error object) to [] so callers never crash.
const fetcher = (url: string): Promise<GateAccountBookEntry[]> => fetch(url).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []));

export function useAccountBook() {
  return useSWR<GateAccountBookEntry[]>('/api/gate/account-book', fetcher, {
    refreshInterval: 60_000,
  });
}
