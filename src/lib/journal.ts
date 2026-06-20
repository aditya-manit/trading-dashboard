// Journal — post-trade review + plan-adherence scoring. Ported from the handoff-23
// design's journalAdherence / journalBuild, but driven by REAL Gate.io closed
// trades (the design used 25 demo trades). Process-only scoring (never P&L):
// gate on direction, then weighted dimensions → 0-100 + a suggested letter grade.

import type { GateFuturesPositionClose } from '@/types/gate';
import {
  type Plan, type PlanDraft, planToDraft, tpCompute, tpMoney, TP_EQUITY,
} from './plan-model';
import type { JournalRecord } from './plan-store';

const BTC_CONTRACT_SIZE = 0.0001;

// The flattened trade shape the journal UI + adherence consume.
export interface JTrade {
  pid: string;        // 'BTC/USDT.P#<time>' — matches the trade-drawer link key
  sym: string;        // 'BTC/USDT.P'
  date: string;       // 'Jun 09'
  sideLong: boolean;
  up: boolean;
  lev: string;        // '10x'
  pnl: string;        // '+$3,800'
  ret: string;        // '+5.2%'
  entryStr: string;
  exitStr: string;
  marginStr: string;
  durStr: string;
  entryN: number;
  exitN: number;
  levN: number;
  marginN: number;
  pnlN: number;
}

export interface AdhCheck {
  label: string;
  s: number;          // 0..1
  weight: number | null;
  gate?: boolean;
  got: string;
  want: string;
  detail: string;
  conf: 'hard' | 'inferred';
}

export interface Adherence {
  key: 'unplanned' | 'followed' | 'off';
  label: string;
  color: string;
  bg: string;
  border: string;
  checks: AdhCheck[] | null;
  followed: boolean;
  dirMatch?: boolean;
  scored: boolean;
  score?: number;
  suggGrade?: string;
  suggColor?: string;
  suggLabel?: string;
}

export interface JEntry {
  t: JTrade;
  plan: Plan | null;
  adh: Adherence;
  planned: boolean;
  reviewed: boolean;
  rec: JournalRecord;
}

export interface JStats {
  total: number;
  plannedN: number;
  unplannedN: number;
  offN: number;
  followedN: number;
  adherence: number;
  coverage: number;
  winPlanned: number;
  winUnplanned: number;
  pnlPlanned: number;
  pnlUnplanned: number;
  reviewedN: number;
  toReview: number;
}

// ── trade mapping ───────────────────────────────────────────────────────────
const entryPriceRaw = (p: GateFuturesPositionClose) => (p.side === 'long' ? p.long_price : p.short_price);
const exitPriceRaw = (p: GateFuturesPositionClose) => (p.side === 'long' ? p.short_price : p.long_price);

function notionalUsd(p: GateFuturesPositionClose): number {
  const size = Math.abs(parseFloat(p.max_size) || 0);
  const entry = parseFloat(entryPriceRaw(p)) || 0;
  return size * BTC_CONTRACT_SIZE * entry;
}
function retPct(p: GateFuturesPositionClose): string {
  const pnl = parseFloat(p.pnl);
  const lev = parseFloat(p.leverage) || 0;
  const notional = notionalUsd(p);
  if (lev > 0 && notional > 0) {
    const pct = (pnl / (notional / lev)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  }
  const entry = parseFloat(entryPriceRaw(p));
  const exit = parseFloat(exitPriceRaw(p));
  if (!entry || !exit) return '';
  const pct = ((exit - entry) / entry) * 100 * (p.side === 'short' ? -1 : 1);
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
function holdDuration(p: GateFuturesPositionClose): string {
  const secs = p.time - (p.first_open_time || p.time);
  if (secs <= 0) return '—';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
const fmtPrice = (s: string) => {
  const n = parseFloat(s);
  return n ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';
};
const fmtLev = (lev: string) => {
  const n = parseFloat(lev);
  return !n || n === 0 ? 'Cross' : `${n}x`;
};

export function mapTrade(p: GateFuturesPositionClose): JTrade {
  const pnlN = parseFloat(p.pnl) || 0;
  const up = pnlN >= 0;
  const sideLong = p.side === 'long';
  const entryN = parseFloat(entryPriceRaw(p)) || 0;
  const exitN = parseFloat(exitPriceRaw(p)) || 0;
  const levN = parseFloat(p.leverage) || 0;
  const notional = notionalUsd(p);
  const marginN = levN > 0 && notional > 0 ? notional / levN : 0;
  return {
    pid: `BTC/USDT.P#${p.time}`,
    sym: 'BTC/USDT.P',
    date: new Date(p.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sideLong, up,
    lev: fmtLev(p.leverage),
    pnl: `${up ? '+$' : '-$'}${Math.abs(pnlN).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    ret: retPct(p),
    entryStr: fmtPrice(entryPriceRaw(p)),
    exitStr: fmtPrice(exitPriceRaw(p)),
    marginStr: marginN > 0 ? '$' + Math.round(marginN).toLocaleString('en-US') : '—',
    durStr: holdDuration(p),
    entryN, exitN, levN, marginN, pnlN,
  };
}

export const jPnlNum = (s: string): number => {
  const neg = String(s).indexOf('−') > -1 || String(s).indexOf('-') > -1;
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return (neg ? -1 : 1) * (isNaN(n) ? 0 : n);
};
export const jMoney = (n: number): string => (n < 0 ? '−$' : '+$') + Math.abs(Math.round(n)).toLocaleString('en-US');

// ── adherence (process-only) ─────────────────────────────────────────────────
const num = (v: unknown): number => {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : NaN;
};
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function journalAdherence(t: JTrade, plan: Plan | null): Adherence {
  if (!plan) return { key: 'unplanned', label: 'Unplanned', color: '#9b988d', bg: '#f3f2ef', border: '#e9e7e1', checks: null, followed: false, scored: false };
  const d: PlanDraft = planToDraft(plan);
  const c = tpCompute(d);
  const isLong = plan.dir === 'long';
  const dirMatch = plan.dir === (t.sideLong ? 'long' : 'short');
  const win = t.up;

  const pEntry = num(d.entry), pStop = num(d.stop);
  const zoneLo = d.entryMode === 'zone' ? Math.min(num(d.ez1), num(d.ez2)) : NaN;
  const zoneHi = d.entryMode === 'zone' ? Math.max(num(d.ez1), num(d.ez2)) : NaN;
  const tgts = [num(d.t1), num(d.t2), num(d.t3)].filter(isFinite);
  const pTarget = tgts.length ? tgts[0] : NaN;
  const pLev = (typeof d.lev === 'number' ? d.lev : parseInt(String(d.lev), 10)) || parseInt(String(plan.lev), 10) || 99;
  const pMarginPct = isFinite(c.marginPct) ? c.marginPct : NaN;

  const aEntry = t.entryN, aExit = t.exitN, aLev = t.levN;
  const aMarginPct = (t.marginN / TP_EQUITY) * 100;

  const checks: AdhCheck[] = [];
  const dims: { weight: number; s: number }[] = [];
  const pct = (x: number) => (x * 100).toFixed(2).replace(/\.?0+$/, '') + '%';

  // 0. DIRECTION — the gate
  checks.push({ label: 'Traded the planned direction', s: dirMatch ? 1 : 0, weight: null, gate: true,
    got: t.sideLong ? 'Long' : 'Short', want: isLong ? 'Long' : 'Short',
    detail: dirMatch ? 'Matched the plan' : 'Opposite side — voids the plan', conf: 'hard' });

  // 1. ENTRY — within 0.5% of plan / inside zone
  if (isFinite(aEntry) && (isFinite(pEntry) || isFinite(zoneLo))) {
    let s: number, dev = 0, inZone = false;
    if (isFinite(zoneLo) && aEntry >= zoneLo && aEntry <= zoneHi) { s = 1; inZone = true; }
    else {
      const ref = isFinite(pEntry) ? pEntry : (aEntry < zoneLo ? zoneLo : zoneHi);
      dev = Math.abs(aEntry - ref) / ref;
      s = clamp01((0.015 - dev) / 0.010);
    }
    dims.push({ weight: 15, s });
    checks.push({ label: 'Entry near plan', s, weight: 15, got: tpMoney(aEntry, aEntry < 1000 ? 2 : 0),
      want: inZone ? 'in zone' : '≤0.5% off', detail: inZone ? 'Inside the planned zone' : dev <= 0.005 ? (pct(dev) + ' off — clean') : (pct(dev) + ' off plan entry'), conf: 'hard' });
  }
  // 2. LEVERAGE — ≤ plan
  if (isFinite(aLev) && isFinite(pLev)) {
    const s = aLev <= pLev ? 1 : clamp01(1 - (aLev - pLev) / pLev);
    dims.push({ weight: 15, s });
    checks.push({ label: 'Leverage within plan', s, weight: 15, got: aLev + '×', want: '≤ ' + pLev + '×',
      detail: aLev <= pLev ? 'At or under planned leverage' : 'Over plan by ' + (aLev - pLev) + '×', conf: 'hard' });
  }
  // 3. MARGIN — ≤ min(plan margin%, 50%)
  if (isFinite(aMarginPct) && isFinite(pMarginPct)) {
    const cap = Math.min(pMarginPct, 50);
    const s = aMarginPct <= cap ? 1 : clamp01(1 - (aMarginPct - cap) / cap);
    dims.push({ weight: 20, s });
    checks.push({ label: 'Margin within cap', s, weight: 20, got: aMarginPct.toFixed(1) + '%', want: '≤ ' + cap.toFixed(0) + '%',
      detail: aMarginPct <= cap ? 'Size respected the account cap' : 'Over the min(plan, 50%) cap', conf: 'inferred' });
  }
  // 4 + 5. EXIT(TP) / STOP(SL)
  if (win) {
    if (isFinite(pTarget) && isFinite(aEntry) && isFinite(aExit)) {
      const plannedMove = Math.abs(pTarget - aEntry), actualMove = Math.abs(aExit - aEntry);
      const capture = plannedMove > 0 ? clamp01(actualMove / plannedMove) : 0;
      dims.push({ weight: 25, s: capture });
      checks.push({ label: 'Captured the target', s: capture, weight: 25, got: Math.round(capture * 100) + '%', want: 'of TP',
        detail: 'Took ' + Math.round(capture * 100) + '% of the planned target move', conf: 'inferred' });
    }
    dims.push({ weight: 25, s: 1 });
    checks.push({ label: 'Stop respected', s: 1, weight: 25, got: 'win', want: 'kept',
      detail: 'Winner — the stop was never threatened', conf: 'inferred' });
  } else {
    if (isFinite(pStop) && isFinite(aEntry) && isFinite(aExit)) {
      const lossMoveP = Math.abs(aEntry - pStop), lossMoveA = Math.abs(aEntry - aExit);
      let s = lossMoveP > 0 ? (lossMoveA <= lossMoveP ? 1 : clamp01(1 - (lossMoveA - lossMoveP) / lossMoveP)) : 0;
      const drawdown = t.marginN > 0 ? Math.abs(t.pnlN) / t.marginN : 0;
      const blown = drawdown > 0.30;
      if (blown) s = 0;
      dims.push({ weight: 50, s });
      checks.push({ label: 'Stop respected', s, weight: 50, got: blown ? (Math.round(drawdown * 100) + '% draw') : (lossMoveA <= lossMoveP ? 'in plan' : 'widened'),
        want: '≤ plan SL', detail: blown ? 'Loss blew past 30% of margin — stop ignored' : (lossMoveA <= lossMoveP ? 'Loss stayed within the planned stop' : 'Loss exceeded the planned stop distance'), conf: 'inferred' });
    }
  }

  const totW = dims.reduce((a, x) => a + x.weight, 0);
  const rawScore = dims.reduce((a, x) => a + x.weight * x.s, 0);
  const score = !dirMatch ? 0 : (totW > 0 ? Math.round(rawScore / totW * 100) : 0);
  const followed = dirMatch && score >= 75;
  const sugg = !dirMatch ? 'D' : score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  const gradeMeta: Record<string, [string, string]> = { A: ['#1f9d55', 'Textbook'], B: ['#7c9c3a', 'Solid'], C: ['#d98a1f', 'Sloppy'], D: ['#df5338', 'Off-plan'] };
  const gm = gradeMeta[sugg];

  const palette = !dirMatch
    ? { color: '#df5338', bg: '#fdeee9', border: '#f6d8cc' }
    : followed ? { color: '#1f9d55', bg: '#ebf6ef', border: '#cfe9da' } : { color: '#d98a1f', bg: '#fbf2e3', border: '#f1e1bf' };
  return {
    key: !dirMatch ? 'off' : followed ? 'followed' : 'off',
    label: !dirMatch ? 'Wrong direction' : followed ? 'Followed plan' : 'Off-plan',
    checks: checks.length ? checks : null, followed, dirMatch, scored: true,
    score, suggGrade: sugg, suggColor: gm[0], suggLabel: gm[1],
    ...palette,
  };
}

export function journalBuild(
  trades: JTrade[],
  links: Record<string, string>,
  plans: Plan[],
  jr: Record<string, JournalRecord>,
): { entries: JEntry[]; stats: JStats } {
  const entries: JEntry[] = trades.map((t) => {
    const planId = links[t.pid];
    const plan = planId ? plans.find((p) => p.id === planId) || null : null;
    return { t, plan, adh: journalAdherence(t, plan), planned: !!plan, reviewed: !!(jr[t.pid] && jr[t.pid].reviewed), rec: jr[t.pid] || {} };
  });
  const planned = entries.filter((e) => e.planned);
  const unplanned = entries.filter((e) => !e.planned);
  const followed = planned.filter((e) => e.adh.followed);
  const wins = (arr: JEntry[]) => arr.filter((e) => e.t.up).length;
  const sum = (arr: JEntry[]) => arr.reduce((a, e) => a + jPnlNum(e.t.pnl), 0);
  const stats: JStats = {
    total: entries.length, plannedN: planned.length, unplannedN: unplanned.length, offN: planned.length - followed.length,
    followedN: followed.length, adherence: planned.length ? Math.round(followed.length / planned.length * 100) : 0,
    coverage: entries.length ? Math.round(planned.length / entries.length * 100) : 0,
    winPlanned: planned.length ? Math.round(wins(planned) / planned.length * 100) : 0,
    winUnplanned: unplanned.length ? Math.round(wins(unplanned) / unplanned.length * 100) : 0,
    pnlPlanned: sum(planned), pnlUnplanned: sum(unplanned), reviewedN: entries.filter((e) => e.reviewed).length, toReview: entries.filter((e) => !e.reviewed).length,
  };
  return { entries, stats };
}

export type JFilter = 'all' | 'planned' | 'off' | 'unplanned' | 'review';
export function filterEntries(entries: JEntry[], cur: JFilter): JEntry[] {
  return entries.filter((e) => cur === 'all' ? true : cur === 'planned' ? e.planned : cur === 'off' ? (e.planned && !e.adh.followed) : cur === 'unplanned' ? !e.planned : !e.reviewed);
}
