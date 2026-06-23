'use client';

import { useSyncExternalStore } from 'react';
import type { HeatSymbol } from '@/hooks/useHeatmap';

// Tiny global store so deep components (workbook Step 5, plan editor Levels card)
// can launch the liquidation heatmap as a full-screen overlay, optionally
// preselecting the symbol they're working on. The page underneath stays mounted,
// so closing returns the user exactly where they were.
//
// Persisted to localStorage so a browser refresh reopens the heatmap if it was
// open (otherwise a reload drops back to the underlying page). Closing clears it.

interface LaunchState { open: boolean; symbol: HeatSymbol }

const KEY = 'lh_open';
const DEFAULT: LaunchState = { open: false, symbol: 'BTC' };

function readInitial(): LaunchState {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<LaunchState>;
    const symbol = p.symbol === 'ETH' || p.symbol === 'SOL' ? p.symbol : 'BTC';
    return { open: !!p.open, symbol };
  } catch { return DEFAULT; }
}

let state: LaunchState = readInitial();
const listeners = new Set<() => void>();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };
const emit = () => { persist(); listeners.forEach((l) => l()); };

export const heatmapLaunch = {
  open(symbol: HeatSymbol = 'BTC') { state = { open: true, symbol }; emit(); },
  close() { if (!state.open) return; state = { ...state, open: false }; emit(); },
};

export function useHeatmapLaunch(): LaunchState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => DEFAULT, // server snapshot: closed (avoids hydration mismatch; client syncs after)
  );
}
