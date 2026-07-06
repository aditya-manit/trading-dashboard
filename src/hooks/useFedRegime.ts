'use client';
import useSWR from 'swr';

export type FedRegime = 'hiking' | 'holding' | 'cutting';
export interface FedRegimeData {
  regime: FedRegime;
  rate: number | null; // effective fed funds rate %
  asOf?: string; // ISO month of the latest reading
  delta?: number; // change over the last ~6 months (pp)
}

const fetcher = (u: string): Promise<FedRegimeData> => fetch(u).then((r) => r.json());

// Auto-derived Fed policy regime (from the fed funds rate via FRED). Cached long
// — the rate moves monthly. Returns undefined while loading.
export function useFedRegime(): FedRegimeData | undefined {
  const { data } = useSWR<FedRegimeData>('/api/fed-regime', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 6 * 3600_000,
  });
  return data;
}
