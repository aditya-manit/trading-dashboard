import type { GateFuturesPositionClose, GateAccountBookEntry } from '@/types/gate';

export interface TradeStats {
  totalPnl: number;
  winRate: number;
  wins: number;
  losses: number;
  total: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  bestTrade: { pnl: number; date: string };
  worstTrade: { pnl: number; date: string };
  bestMonth: { label: string; pnl: number } | null;
  winStreak: { count: number; startDate: string; endDate: string } | null;
  avgDailyPnl90: number;
  avgHoldTimeDays: number;
  expectancy: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  maxDrawdownDate: string;
  volatilityAnn: number;
  avgRR: number;
  cagr: number;
  totalReturn: number;
  calmar: number;
  riskOfRuin: number;
  profitSparkline: number[];
  lossSparkline: number[];
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function computeTradeStats(
  positions: GateFuturesPositionClose[],
  entries: GateAccountBookEntry[]
): TradeStats {
  const empty: TradeStats = {
    totalPnl: 0, winRate: 0, wins: 0, losses: 0, total: 0,
    grossProfit: 0, grossLoss: 0, profitFactor: 0,
    bestTrade: { pnl: 0, date: '—' }, worstTrade: { pnl: 0, date: '—' },
    bestMonth: null, winStreak: null,
    avgDailyPnl90: 0, avgHoldTimeDays: 0, expectancy: 0,
    sharpe: 0, sortino: 0, maxDrawdownPct: 0, maxDrawdownDate: '', volatilityAnn: 0, avgRR: 0,
    cagr: 0, totalReturn: 0, calmar: 0, riskOfRuin: 0,
    profitSparkline: Array(13).fill(0), lossSparkline: Array(13).fill(0),
  };

  if (!positions.length) return empty;

  const sorted = [...positions].sort((a, b) => a.time - b.time);
  const pnls = sorted.map(p => parseFloat(p.pnl));
  const totalPnl = pnls.reduce((s, v) => s + v, 0);
  const wins = pnls.filter(v => v > 0).length;
  const losses = pnls.filter(v => v < 0).length;
  const total = sorted.length;
  const winRate = total > 0 ? wins / total : 0;
  const grossProfit = pnls.filter(v => v > 0).reduce((s, v) => s + v, 0);
  const grossLoss = Math.abs(pnls.filter(v => v < 0).reduce((s, v) => s + v, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  const bestPnl = Math.max(...pnls);
  const worstPnl = Math.min(...pnls);
  const bestIdx = pnls.indexOf(bestPnl);
  const worstIdx = pnls.indexOf(worstPnl);

  const byMonth: Record<string, number> = {};
  for (const p of sorted) {
    const key = new Date(p.time * 1000).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    byMonth[key] = (byMonth[key] ?? 0) + parseFloat(p.pnl);
  }
  const monthEntries = Object.entries(byMonth);
  const bestMonthEntry = monthEntries.length > 0
    ? monthEntries.reduce((a, b) => b[1] > a[1] ? b : a)
    : null;

  let streak = 0, maxStreak = 0, streakStart = 0, streakEnd = 0, curStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (pnls[i] > 0) {
      if (streak === 0) curStart = sorted[i].time;
      streak++;
      if (streak > maxStreak) {
        maxStreak = streak;
        streakStart = curStart;
        streakEnd = sorted[i].time;
      }
    } else {
      streak = 0;
    }
  }

  const now = Date.now() / 1000;
  const p90 = sorted.filter(p => p.time > now - 90 * 86400);
  const avgDailyPnl90 = p90.reduce((s, p) => s + parseFloat(p.pnl), 0) / 90;

  const holdTimes = sorted.map(p => (p.time - p.first_open_time) / 86400);
  const avgHoldTimeDays = holdTimes.reduce((s, v) => s + v, 0) / holdTimes.length;

  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const expectancy = avgWin * winRate - avgLoss * (1 - winRate);
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

  let sharpe = 0, sortino = 0, maxDrawdownPct = 0, maxDrawdownDate = '', volatilityAnn = 0, cagr = 0, totalReturn = 0;
  if (entries.length > 1) {
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      const day = new Date(e.time * 1000).toISOString().slice(0, 10);
      byDay[day] = parseFloat(e.balance);
    }

    const sortedDays = Object.keys(byDay).sort();
    const filledBalances: number[] = [];
    const filledDates: string[] = [];
    if (sortedDays.length > 0) {
      const start = new Date(sortedDays[0]);
      const end = new Date(sortedDays[sortedDays.length - 1]);
      let lastBal = byDay[sortedDays[0]];
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        if (byDay[key] !== undefined) lastBal = byDay[key];
        if (lastBal > 0) { filledBalances.push(lastBal); filledDates.push(key); }
      }
    }

    const dailyReturns: number[] = [];
    for (let i = 1; i < filledBalances.length; i++) {
      dailyReturns.push((filledBalances[i] - filledBalances[i - 1]) / filledBalances[i - 1]);
    }
    if (dailyReturns.length > 0) {
      const mean = dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyReturns.length;
      const std = Math.sqrt(variance);
      volatilityAnn = std * Math.sqrt(365) * 100;
      sharpe = std > 0 ? (mean / std) * Math.sqrt(365) : 0;
      const downsideVariance = dailyReturns.reduce((s, v) => s + (v < 0 ? v * v : 0), 0) / dailyReturns.length;
      const downsideStd = Math.sqrt(downsideVariance);
      sortino = downsideStd > 0 ? (mean / downsideStd) * Math.sqrt(365) : 0;
    }
    let peak = filledBalances[0];
    for (let bi = 0; bi < filledBalances.length; bi++) {
      const b = filledBalances[bi];
      if (b > peak) peak = b;
      else if (peak > 0) {
        const dd = Math.abs((b - peak) / peak) * 100;
        if (dd > maxDrawdownPct) {
          maxDrawdownPct = dd;
          maxDrawdownDate = new Date(filledDates[bi]).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
      }
    }

    if (filledBalances.length > 1) {
      const startBal = filledBalances[0];
      const endBal = filledBalances[filledBalances.length - 1];
      const days = filledBalances.length - 1;
      if (startBal > 0 && endBal > 0 && days > 0) {
        cagr = (Math.pow(endBal / startBal, 365 / days) - 1) * 100;
        totalReturn = ((endBal - startBal) / startBal) * 100;
      }
    }
  }

  const calmar = cagr !== 0 && maxDrawdownPct !== 0 ? cagr / maxDrawdownPct : 0;

  const rr = avgLoss > 0 ? avgWin / avgLoss : 0;
  const edge = rr > 0 ? (rr * winRate - (1 - winRate)) / (rr + 1) : -1;
  const N = 50;
  const riskOfRuin = edge > 0 ? Math.max(0, Math.min(100, Math.exp(-2 * edge * N) * 100)) : 100;

  const profitSparkline: number[] = [];
  const lossSparkline: number[] = [];
  for (let w = 12; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86400;
    const end = now - w * 7 * 86400;
    const week = sorted.filter(p => p.time >= start && p.time < end);
    profitSparkline.push(week.filter(p => parseFloat(p.pnl) > 0).reduce((s, p) => s + parseFloat(p.pnl), 0));
    lossSparkline.push(Math.abs(week.filter(p => parseFloat(p.pnl) < 0).reduce((s, p) => s + parseFloat(p.pnl), 0)));
  }

  return {
    totalPnl, winRate, wins, losses, total,
    grossProfit, grossLoss, profitFactor,
    bestTrade: { pnl: bestPnl, date: fmtDate(sorted[bestIdx].time) },
    worstTrade: { pnl: worstPnl, date: fmtDate(sorted[worstIdx].time) },
    bestMonth: bestMonthEntry ? { label: bestMonthEntry[0], pnl: bestMonthEntry[1] } : null,
    winStreak: maxStreak > 0 ? { count: maxStreak, startDate: fmtDate(streakStart), endDate: fmtDate(streakEnd) } : null,
    avgDailyPnl90, avgHoldTimeDays, expectancy, avgRR,
    sharpe, sortino, maxDrawdownPct, maxDrawdownDate, volatilityAnn,
    cagr, totalReturn, calmar, riskOfRuin,
    profitSparkline, lossSparkline,
  };
}

export function buildEquityData(
  entries: GateAccountBookEntry[],
  rangeKey: '1M' | '3M' | '6M' | '1Y' | 'ALL'
): { time: number; balance: number }[] {
  if (!entries.length) return [];
  const now = Date.now() / 1000;
  const rangeDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 99999 };
  const cutoff = now - rangeDays[rangeKey] * 86400;
  const filtered = entries.filter(e => e.time >= cutoff);
  if (!filtered.length) return [];

  const target = 40;
  const step = Math.max(1, Math.floor(filtered.length / target));
  const sampled: { time: number; balance: number }[] = [];
  for (let i = 0; i < filtered.length; i += step) {
    sampled.push({ time: filtered[i].time, balance: parseFloat(filtered[i].balance) });
  }
  const last = filtered[filtered.length - 1];
  if (sampled[sampled.length - 1]?.time !== last.time) {
    sampled.push({ time: last.time, balance: parseFloat(last.balance) });
  }
  return sampled;
}
