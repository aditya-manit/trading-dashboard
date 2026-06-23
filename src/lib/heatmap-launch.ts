'use client';

import { useSyncExternalStore } from 'react';
import type { HeatSymbol } from '@/hooks/useHeatmap';

// Tiny global store so deep components (workbook Step 5, plan editor Levels card)
// can launch the liquidation heatmap as a full-screen overlay, optionally
// preselecting the symbol they're working on. The page underneath stays mounted,
// so closing returns the user exactly where they were.

interface LaunchState { open: boolean; symbol: HeatSymbol }

let state: LaunchState = { open: false, symbol: 'BTC' };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const heatmapLaunch = {
  open(symbol: HeatSymbol = 'BTC') { state = { open: true, symbol }; emit(); },
  close() { if (!state.open) return; state = { ...state, open: false }; emit(); },
};

export function useHeatmapLaunch(): LaunchState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state,
  );
}
