import type { CalendarEvent } from '@/hooks/useCalendar';

// Detects a central-bank rate decision / statement (specific phrases only — NOT
// a bare "rate", so data like "Unemployment Rate" doesn't slip through).
const CB_DECISION = /\b(SNB|BOJ|ECB|BOE|RBA|RBNZ|BOC|FOMC|MPC)\b|monetary policy|policy rate|cash rate|bank rate|refinancing rate|deposit facility rate|rate decision|rate statement|rate vote|press conf/i;

// Events worth surfacing to a BTC/USDT perp trader:
//   High-impact  AND  ( USD  OR  a non-USD central-bank decision )
// USD high-impact = the real macro movers (Fed/CPI/NFP/PCE). Non-USD is kept
// only for central-bank decisions (BoJ/ECB/BoE/SNB — global liquidity); minor-
// currency *data* (NZD GDP, GBP Claimant Count, …) is filtered out.
export function isBtcRelevant(e: CalendarEvent): boolean {
  if (e.impact !== 'High') return false;
  if (e.country === 'USD') return true;
  return CB_DECISION.test(e.title);
}

// Why this event passed the filter — shown as a small chip on each card.
export function relevanceTag(e: CalendarEvent): { label: string; bg: string; color: string } {
  if (e.country === 'USD') return { label: 'US MACRO', bg: '#fdf3e6', color: '#c9821f' };
  return { label: 'CENTRAL BANK', bg: '#f3eefe', color: '#7c5cff' };
}
