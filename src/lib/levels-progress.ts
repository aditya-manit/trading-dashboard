'use client';
import { useSyncExternalStore } from 'react';

// Levels Map progress — presentation/progress state for the plan drawer's gamified rail.
// NOT plan data: ticking nodes only writes these localStorage keys, never the plan's prices.
type HitMap = Record<string, Record<string, boolean>>; // planId → { levelKey → hit }
type BankMap = Record<string, boolean>; // planId → streak already counted for this plan

interface LevelsState {
  hit: HitMap;
  streak: number;
  banked: BankMap;
  cel: string | null; // transient celebration key `${planId}|${levelKey}` (drives the pop/glow)
}

const KEYS = { hit: 'tdplan_levels_hit', streak: 'tdplan_levels_streak', banked: 'tdplan_levels_banked' } as const;

const read = <T,>(k: string, fallback: T): T => {
  try { const s = localStorage.getItem(k); if (s != null) return JSON.parse(s) as T; } catch { /* ignore */ }
  return fallback;
};

let state: LevelsState = { hit: {}, streak: 0, banked: {}, cel: null };
let hydrated = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  state = {
    hit: read<HitMap>(KEYS.hit, {}),
    streak: read<number>(KEYS.streak, 0),
    banked: read<BankMap>(KEYS.banked, {}),
    cel: null,
  };
  emit();
}

const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

let celTimer: ReturnType<typeof setTimeout> | null = null;

export const levelsProgress = {
  hitFor(id: string): Record<string, boolean> { return state.hit[id] || {}; },
  bankedFor(id: string): boolean { return !!state.banked[id]; },
  toggle(id: string, key: string) {
    const cur = state.hit[id] || {};
    const now = !cur[key];
    const hit = { ...state.hit, [id]: { ...cur, [key]: now } };
    write(KEYS.hit, hit);
    state = { ...state, hit, cel: now ? id + '|' + key : null };
    emit();
    if (now) {
      if (celTimer) clearTimeout(celTimer);
      const key2 = id + '|' + key;
      celTimer = setTimeout(() => { if (state.cel === key2) { state = { ...state, cel: null }; emit(); } }, 900);
    }
  },
  reset(id: string) {
    const hit = { ...state.hit }; delete hit[id];
    const banked = { ...state.banked }; delete banked[id];
    write(KEYS.hit, hit); write(KEYS.banked, banked);
    state = { ...state, hit, banked, cel: null };
    emit();
  },
  // ±1 streak, one lock per plan (Reset unlocks). `complete` gates the +1 (plan cleanly followed).
  bump(id: string, dir: 1 | -1) {
    if (state.banked[id]) return;
    const streak = Math.max(0, state.streak + dir);
    const banked = { ...state.banked, [id]: true };
    write(KEYS.streak, String(streak)); write(KEYS.banked, banked);
    state = { ...state, streak, banked, cel: null };
    emit();
  },
};

function subscribe(cb: () => void) { hydrate(); listeners.add(cb); return () => { listeners.delete(cb); }; }
const getSnapshot = () => state;
const serverSnapshot: LevelsState = { hit: {}, streak: 0, banked: {}, cel: null };

export function useLevelsProgress(): LevelsState {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}
