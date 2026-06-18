import type { CalendarEvent } from '@/hooks/useCalendar';

// Detects a central-bank rate decision / statement / presser (specific phrases
// only — NOT a bare "rate", so data like "Unemployment Rate" doesn't slip in).
const CB_DECISION = /\b(BOJ|ECB|BOE|MPC)\b|monetary policy|policy rate|bank rate|refinancing rate|deposit facility rate|rate decision|rate statement|rate vote|press conf/i;

// Central banks whose decisions actually move BTC: BoJ (JPY), ECB (EUR),
// BoE (GBP). SNB/RBA/RBNZ/BoC mostly move only their own FX — excluded.
const MAJOR_CB = new Set(['JPY', 'EUR', 'GBP']);

// Events worth surfacing to a BTC/USDT perp trader:
//   High-impact  AND  ( USD  OR  a MAJOR central-bank decision )
// USD high-impact = the real macro movers (Fed/CPI/NFP/PCE). Non-USD is kept
// ONLY for BoJ/ECB/BoE rate decisions; minor-currency *data* (NZD GDP, GBP
// Claimant Count, …) and minor central banks (SNB/RBA/…) are filtered out.
export function isBtcRelevant(e: CalendarEvent): boolean {
  if (e.impact !== 'High') return false;
  if (e.country === 'USD') return true;
  return MAJOR_CB.has(e.country) && CB_DECISION.test(e.title);
}

// Why this event passed the filter — shown as a small chip on each card.
// US MACRO in green, CENTRAL BANK in brand purple.
export function relevanceTag(e: CalendarEvent): { label: string; color: string } {
  return e.country === 'USD'
    ? { label: 'US MACRO', color: '#1f9d55' }
    : { label: 'CENTRAL BANK', color: '#7c5cff' };
}
