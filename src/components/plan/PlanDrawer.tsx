'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpCompute, planToDraft, tpPlanName, tpMoney, TP_EQUITY, tpEntryRungs, pctNum, tpNum, type Plan, type Status, type PlanDraft, type Level } from '@/lib/plan-model';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { CoinIcon } from './coins';
import { CalIcon } from './MiniCalendar';
import { PlanInlineDate, planWindowLabel } from './PlanInlineDate';
import { DirLevHeading } from './Editor';
import { useLevelsProgress, levelsProgress } from '@/lib/levels-progress';

const MONO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
const mny = (v: number) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const STATUSES: { k: Status; label: string; c: string; bg: string }[] = [
  { k: 'idea', label: 'Idea', c: '#6a45d8', bg: '#f3f0ff' },
  { k: 'armed', label: 'Armed', c: '#1f8a52', bg: '#eef8f1' },
  { k: 'triggered', label: 'Triggered', c: '#c9821f', bg: '#fbf2e3' },
];
const CONVS = [{ k: 'low', label: 'Low', n: 1 }, { k: 'med', label: 'Medium', n: 2 }, { k: 'high', label: 'High', n: 3 }] as const;

// ── "3a Verdict-last" stat strip (drawer only; the editor keeps tp4aStrip/EquityStrip) ──
const S_PURP = '#7c5cff', S_GREEN = '#1f9d55', S_RED = '#df5338', S_ORANGE = '#ff7a00', S_INK = '#1a1813', S_MUT = '#a8a294', S_DIM = '#c6c1b6';
function Tp3aStrip({ c, d }: { c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const money = (v: number, dec = 0) => (isFinite(v) ? tpMoney(v, dec) : '—');
  const chipSt: React.CSSProperties = { background: '#fff', border: '1px solid #ece9f2', borderRadius: 16, padding: '13px 17px', display: 'flex', flexDirection: 'column', gap: 8 };
  const cap = (t: string) => <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 8.5, letterSpacing: '0.15em', color: S_MUT, whiteSpace: 'nowrap' }}>{t}</span>;
  const pct = (txt: string, col: string, tag: string) => <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: col, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{txt}<span style={{ color: S_DIM, fontWeight: 500 }}>{' ' + tag}</span></span>;

  const slices = (c.levels || []).filter((l) => isFinite(l.rewardUSD));
  const denom = slices.reduce((s, l) => s + (l.rewardUSD > 0 ? l.rewardUSD : 0), 0);
  const segCol = (l: Level) => (l.isRunner ? '#57c98a' : S_GREEN);
  const totalReward = c.planReward, hasReward = c.planRewardHas, planR = c.planR;
  const rrStr = isFinite(planR) ? planR.toFixed(2) : '—';
  const rrColor = !isFinite(planR) ? '#b3b0a6' : planR >= 2.5 ? S_GREEN : planR >= 1.5 ? '#c9821f' : S_RED;
  const rrVerd = !isFinite(planR) ? 'Set levels' : planR >= 2.5 ? 'Strong edge' : planR >= 1.5 ? 'Fair edge' : 'Thin edge';
  let finalMove = NaN; (c.levels || []).forEach((l) => { if (l.hasPrice && isFinite(l.distPct)) { if (!isFinite(finalMove) || l.distPct > finalMove) finalMove = l.distPct; } });
  const rewEqPct = isFinite(totalReward) && isFinite(c.Q) && c.Q > 0 ? (totalReward / c.Q) * 100 : NaN;
  const bignum = (txt: string, col: string, fs = 22) => <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: fs, lineHeight: 1, letterSpacing: fs >= 22 ? '-0.025em' : '-0.02em', color: col, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{txt}</span>;

  const riskChip = (
    <div style={{ ...chipSt, flex: '0 0 auto' }}>{cap('RISK')}
      {bignum(isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : '—', S_RED)}
      <div style={{ display: 'flex', gap: 11 }}>{isFinite(c.distStopPct) ? pct(c.distStopPct.toFixed(2) + '%', '#3a352c', 'pos') : null}{isFinite(c.riskPct) ? pct(c.riskPct.toFixed(2) + '%', S_PURP, 'eq') : null}</div>
    </div>
  );
  const rewChip = (
    <div style={{ ...chipSt, flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>{cap('REWARD · PLAN')}
        {bignum(hasReward ? '+' + money(totalReward) : '—', S_GREEN)}
        <div style={{ display: 'flex', gap: 11 }}>{isFinite(finalMove) ? pct(finalMove.toFixed(2) + '%', '#3a352c', 'pos') : null}{isFinite(rewEqPct) ? pct(rewEqPct.toFixed(2) + '%', S_PURP, 'eq') : null}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', gap: 3, height: 6 }}>{slices.map((l, i) => { const s = denom > 0 ? Math.max(0, l.rewardUSD) / denom : 0; return s > 0 ? <div key={i} style={{ flexGrow: s, flexShrink: 1, flexBasis: 0, minWidth: 2, background: segCol(l), borderRadius: 99 }} /> : null; })}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>{slices.map((l, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: i === 0 ? 'flex-start' : i === slices.length - 1 ? 'flex-end' : 'center' }}>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: S_GREEN, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{isFinite(l.rewardUSD) ? '+' + money(l.rewardUSD) : '—'}</span>
            <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 9, color: '#b3ada0', whiteSpace: 'nowrap' }}>{(l.isRunner ? 'Run' : 'TP' + l.i) + ' · ' + Math.round(l.pct) + '%'}</span>
          </div>
        ))}</div>
      </div>
    </div>
  );

  const price = c.mkt.mark;
  const liqDist = isFinite(c.liq) ? (Math.abs(price - c.liq) / price) * 100 : NaN;
  const stopDist = isFinite(c.S) ? (Math.abs(price - c.S) / price) * 100 : NaN;
  const cushion = isFinite(liqDist) && isFinite(stopDist) && stopDist > 0 ? liqDist / stopDist : NaN;
  const verd = !isFinite(cushion) ? { t: '—', c: '#b3b0a6' } : cushion >= 3 ? { t: 'Clear of liq', c: S_GREEN } : cushion >= 1.5 ? { t: 'Near liq', c: '#c9821f' } : { t: 'Close to liq', c: S_RED };
  const stopPos = isFinite(liqDist) && isFinite(stopDist) && liqDist > 0 ? Math.max(4, Math.min(96, (1 - stopDist / liqDist) * 100)) : 50;
  const tdot = (left: number, col: string) => <span style={{ position: 'absolute', left: left + '%', top: '50%', width: 11, height: 11, borderRadius: '50%', background: '#fff', border: '2.3px solid ' + col, transform: 'translate(-50%,-50%)' }} />;
  const liqChip = (
    <div style={{ ...chipSt, flex: 1, minWidth: 0, order: -1, gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>{cap('STOP VS LIQ')}<span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 10.5, color: verd.c, whiteSpace: 'nowrap' }}>{verd.t}</span></div>
      <div style={{ position: 'relative', height: 13, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 99, background: S_ORANGE, overflow: 'hidden' }}><div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '9%', background: S_RED }} /></div>
        {tdot(1, S_ORANGE)}{tdot(stopPos, S_RED)}{tdot(99, S_PURP)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10, color: '#3a352c', whiteSpace: 'nowrap' }}><span style={{ color: S_ORANGE }}>LIQ </span>{isFinite(c.liq) ? money(c.liq) : '—'}</span>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10, color: '#3a352c', whiteSpace: 'nowrap' }}><span style={{ color: S_RED }}>STOP </span>{isFinite(c.S) ? money(c.S) : '—'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontWeight: 600, fontSize: 10, color: S_PURP, whiteSpace: 'nowrap' }}>{'PRICE ' + money(price)}</span>
      </div>
    </div>
  );
  const posChip = (
    <div style={{ ...chipSt, flex: '0 0 auto', gap: 7 }}>{cap('POSITION')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{bignum(isFinite(c.qty) ? c.qty.toFixed(c.qty < 10 ? 3 : 2) : '—', S_INK, 20)}<CoinIcon sym={d.sym} size={17} /></div>
      <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10.5, color: '#b3ada0', whiteSpace: 'nowrap' }}>{isFinite(c.notional) ? money(c.notional) + ' notional' : '—'}</span>
    </div>
  );
  const marChip = (
    <div style={{ ...chipSt, flex: '0 0 auto', gap: 7 }}>{cap('MARGIN')}
      {bignum(isFinite(c.margin) ? money(c.margin) : '—', S_INK, 20)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 84, flex: '0 0 auto', height: 5, borderRadius: 99, background: '#f0edf9', overflow: 'hidden', display: 'block' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, c.marginPct || 0)) + '%', background: S_PURP, borderRadius: 99 }} /></span>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: S_PURP, flex: '0 0 auto' }}>{isFinite(c.marginPct) ? c.marginPct.toFixed(0) + '%' : '—'}</span>
      </div>
    </div>
  );

  const rLevels = (c.levels || []).filter((l) => isFinite(l.r));
  const rTotal = rLevels.reduce((s, l) => s + (l.r > 0 ? l.r : 0), 0);
  const hero = (
    <div style={{ width: 226, flex: '0 0 auto', background: '#fff', border: '1px solid #ece9f2', borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>{cap('R : R')}
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 48, lineHeight: 1, letterSpacing: '-0.045em', color: rrColor, fontVariantNumeric: 'tabular-nums' }}>{rrStr}</span>
      <span style={{ alignSelf: 'flex-start', fontWeight: 700, fontSize: 11.5, color: '#c9821f', background: '#fdf3e3', borderRadius: 6, padding: '4px 9px' }}>{rrVerd}</span>
      {rLevels.length ? <div style={{ display: 'flex', gap: 3, height: 5, marginTop: 3 }}>{rLevels.map((l, i) => { const s = rTotal > 0 ? Math.max(0, l.r) / rTotal : 0; return s > 0 ? <div key={i} style={{ flexGrow: s, flexShrink: 1, flexBasis: 0, minWidth: 2, background: i % 2 ? '#6cc492' : S_GREEN, borderRadius: 99 }} /> : null; })}</div> : null}
      {rLevels.length ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>{rLevels.map((l, i) => <span key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: '#3a352c', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.r.toFixed(2) + 'R'}</span>)}</div> : null}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', background: 'transparent', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>{riskChip}{rewChip}</div>
        <div style={{ display: 'flex', gap: 10 }}>{posChip}{marChip}{liqChip}</div>
      </div>
      {hero}
    </div>
  );
}

function ConvDots({ n, sz = 6 }: { n: number; sz?: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: sz, height: sz, borderRadius: '50%', background: i < n ? '#7c5cff' : 'transparent', border: i < n ? 'none' : '1.5px solid #d3cfe6', boxSizing: 'border-box' }} />)}</span>;
}

const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #ece9f2', borderRadius: 20, overflow: 'hidden' };

const CHART_SYM_MAP: Record<string, string> = { BTC: 'BTC_USDT', ETH: 'ETH_USDT', SOL: 'SOL_USDT', XRP: 'XRP_USDT', DOGE: 'DOGE_USDT', BNB: 'BNB_USDT' };
const CHART_HEIGHT = 650;
const expandIcon = <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1={21} y1={3} x2={14} y2={10} /><line x1={3} y1={21} x2={10} y2={14} /></>;

// ── Live chart card — the standalone Volume Candle Chart, driven by this plan's own
// levels + dates (no section header; content self-identifies). The plan is passed to the
// iframe as a #embed=1&plan=<json> hash payload. Expand → full-viewport in-app overlay.
function ChartCard({ p, c, d }: { p: Plan; c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const [full, setFull] = useState(false);
  // Esc closes the expand overlay (matches the dc's _chartEsc)
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const rawFills = tpEntryRungs(d);
  const fp = rawFills.map((r) => pctNum(r.pct));
  const fNonLast = fp.slice(0, -1).reduce((s, x) => s + (isFinite(x) ? x : 0), 0);
  const fRem = Math.max(0, 100 - fNonLast);
  let fills = rawFills
    .map((r, i) => ({ p: tpNum(r.price), pct: i === rawFills.length - 1 ? (isFinite(fp[i]) ? fp[i] : fRem) : (isFinite(fp[i]) ? fp[i] : 0) }))
    .filter((f) => isFinite(f.p));
  // a plan that never split its entry carries no percentages — treat it as one full fill
  const fillSum = fills.reduce((s, f) => s + (isFinite(f.pct) ? f.pct : 0), 0);
  if (fills.length && fillSum <= 0) fills = fills.map((f) => ({ ...f, pct: +(100 / fills.length).toFixed(2) }));
  const targets = (c.levels || []).filter((l) => l.hasPrice).map((l) => ({ p: l.price, pct: isFinite(l.pct) ? l.pct : null }));

  // follow live only while the planned window still runs; a closed window frames the trade
  let end: string = 'live';
  const eRaw = p.tradeDate || d.tradeDate || null;
  if (eRaw) {
    const ed = new Date(eRaw);
    if (!isNaN(ed.getTime())) { const t0 = new Date(); t0.setHours(0, 0, 0, 0); end = ed > t0 ? 'live' : eRaw; }
  }
  const payload = {
    contract: CHART_SYM_MAP[p.sym] || ((p.sym || 'BTC') + '_USDT'),
    interval: '1h',
    dir: p.dir,
    qty: isFinite(c.qty) ? +c.qty.toFixed(4) : null,
    unit: p.sym || 'BTC',
    fills: fills.length ? fills.map((f) => ({ ...f, filled: true })) : (c.hasEntry ? [{ p: c.E, pct: 100, filled: true }] : []),
    targets,
    stop: c.hasStop ? c.S : null,
    liq: isFinite(c.liq) ? c.liq : null,
    start: p.startDate || d.startDate || null,
    end,
    // a start date is enough — an open-ended plan simply follows live (NOT !(start&&end))
    needDates: !(p.startDate || d.startDate),
  };
  const chartSrc = '/candle-chart.html#embed=1&plan=' + encodeURIComponent(JSON.stringify(payload));
  // remount when the window/timeframe changes, so a tweak or a date edit applies immediately
  const chartKey = p.id + '_livechart|' + payload.contract + '|' + payload.interval + '|' + (payload.start || '') + '|' + payload.end;

  return (
    <div style={cardBox}>
      <div style={{ position: 'relative' }}>
        <button type="button" title="Expand chart" aria-label="Expand chart" className="pd-icobtn"
          onClick={(e) => { e.stopPropagation(); setFull(true); }}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.92)' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{expandIcon}</svg>
        </button>
      </div>
      <div style={{ position: 'relative', height: CHART_HEIGHT, background: '#fff' }}>
        <iframe key={chartKey} src={chartSrc} title="Live chart" loading="lazy" style={{ display: 'block', width: '100%', height: '100%', border: 'none' }} />
      </div>
      {full ? createPortal(
        <div onClick={() => setFull(false)} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(26,24,19,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 1680, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 70px rgba(20,20,12,0.4)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid #ebe2fb', background: 'linear-gradient(180deg,#ffffff 0%,#faf8ff 100%)', flex: '0 0 auto' }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: '#7c5cff', flex: '0 0 auto' }} />
              <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7c5cff' }}>Live chart</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: '#b3b0a6' }}>Esc to close</span>
              <button type="button" title="Close" aria-label="Close" className="pd-icobtn" onClick={() => setFull(false)} style={{ marginLeft: 'auto', width: 28, height: 28, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
              </button>
            </div>
            <iframe key={chartKey + '_full'} src={chartSrc} title="Live chart full screen" style={{ display: 'block', width: '100%', flex: '1 1 auto', border: 'none' }} />
          </div>
        </div>, document.body) : null}
    </div>
  );
}

// ── Levels Map — the gamified tickable rail (planLevelsBoard) ──
const GREEN = '#1f9d55', GREEN2 = '#57c98a', PURP = '#7c5cff', PURPD = '#5a3fe0', RED = '#df5338', INK = '#1a1813', MUT = '#a8a294';
const check = <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
type LNode = { kind: 'tp' | 'trail'; t: Level } | { kind: 'fill'; f: { price: number; pct: number; i: number } } | { kind: 'stop' } | { kind: 'liq' };

function LevelsMap({ p, c, d }: { p: Plan; c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const prog = useLevelsProgress();
  const id = p.id, hit = prog.hit[id] || {}, cel = prog.cel;
  const isCel = (k: string) => cel === id + '|' + k;
  const E = c.E, qty = c.qty, L = c.L;
  const targets = (c.levels || []).filter((l) => l.hasPrice).slice().sort((a, b) => b.distPct - a.distPct);
  const rawFills = tpEntryRungs(d);
  const fpct = rawFills.map((r) => pctNum(r.pct));
  const fNonLast = fpct.slice(0, -1).reduce((s, x) => s + (isFinite(x) ? x : 0), 0);
  const fRem = Math.max(0, 100 - fNonLast);
  const fills = rawFills.map((r, i) => ({ price: tpNum(r.price), pct: i === rawFills.length - 1 ? (isFinite(fpct[i]) ? fpct[i] : fRem) : (isFinite(fpct[i]) ? fpct[i] : 0), i })).filter((f) => isFinite(f.price));
  const hasStop = c.hasStop, stop = c.S, liq = c.liq;
  const liqUSD = isFinite(liq) && isFinite(qty) ? Math.abs(E - liq) * qty : NaN;
  const riskUSD = c.riskUSD;
  // no section header (v: the content self-identifies); the card just holds the body
  const shell = (body: React.ReactNode) => <div style={cardBox}>{body}</div>;

  if (!targets.length && !fills.length) {
    return shell(
      <div style={{ padding: '46px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: '#f3f0ff', display: 'grid', placeItems: 'center' }}><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={PURP} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg></div>
        <span style={{ fontWeight: 800, fontSize: 15, color: INK, letterSpacing: '-0.01em' }}>No levels to track yet</span>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: MUT, maxWidth: 320, lineHeight: 1.5 }}>Add entry, stop and targets in the editor and this board will light up as price reaches each one.</span>
        <button onClick={() => planActions.startEdit(p.id, planToDraft(p))} style={{ marginTop: 4, border: 'none', background: PURP, color: '#fff', fontWeight: 800, fontSize: 12.5, padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}>Open editor</button>
      </div>
    );
  }

  const nodes: LNode[] = [];
  targets.forEach((t) => { nodes.push({ kind: 'tp', t }); if (t.trail) nodes.push({ kind: 'trail', t }); });
  fills.forEach((f) => nodes.push({ kind: 'fill', f }));
  if (hasStop) nodes.push({ kind: 'stop' });
  if (isFinite(liq)) nodes.push({ kind: 'liq' });

  const keyFor = (n: LNode) => n.kind === 'tp' ? 'tp' + n.t.i : n.kind === 'trail' ? 'trail' + n.t.i : n.kind === 'fill' ? 'fill' + n.f.i : n.kind;
  const grpOf = (n: LNode): 'targets' | 'entry' | 'risk' => (n.kind === 'tp' || n.kind === 'trail') ? 'targets' : n.kind === 'fill' ? 'entry' : 'risk';
  const grpMeta = {
    targets: { t: 'Targets', sub: 'bank & trail out', c: GREEN, field: 'targetNote' as const, ph: 'how you scale out, and why here', order: 1 },
    entry: { t: 'Entry', sub: 'limit-ladder in', c: PURPD, field: 'trigger' as const, ph: 'what has to happen before you fill', order: 2 },
    risk: { t: 'Risk', sub: 'stop & liquidation', c: RED, field: 'invalidation' as const, ph: 'what would prove this thesis wrong', order: 3 },
  };
  const segBelow = (n: LNode): { bg: string; dashed: boolean } => {
    if (n.kind === 'tp') return hit['tp' + n.t.i] ? { bg: GREEN, dashed: false } : { bg: '#d8d3ca', dashed: true };
    if (n.kind === 'trail') return hit['trail' + n.t.i] ? { bg: GREEN, dashed: false } : { bg: '#cdbef0', dashed: true };
    if (n.kind === 'fill') return hit['fill' + n.f.i] ? { bg: PURPD, dashed: false } : { bg: '#d8d3ca', dashed: true };
    if (n.kind === 'stop') return hit.stop ? { bg: RED, dashed: false } : { bg: '#e6ddd9', dashed: true };
    return { bg: '#d8d3ca', dashed: true };
  };
  const halfLine = (seg: { bg: string; dashed: boolean } | null) => seg
    ? <div style={{ flex: 1, width: seg.dashed ? 0 : 2, borderRadius: 2, background: seg.dashed ? 'transparent' : seg.bg, borderLeft: seg.dashed ? '2px dashed ' + seg.bg : 'none' }} />
    : <div style={{ flex: 1 }} />;

  const rows: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    const isFirst = i === 0, isLast = i === nodes.length - 1;
    const g = grpOf(n);
    const firstInSec = isFirst || grpOf(nodes[i - 1]) !== g;
    const lastInSec = isLast || grpOf(nodes[i + 1]) !== g;
    if (firstInSec) { const m = grpMeta[g]; rows.push(
      <div key={'h' + i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: isFirst ? 0 : 17, marginBottom: 11 }}>
        <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '.09em', textTransform: 'uppercase', color: m.c }}>{m.t}</span>
        <sup style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 10, color: m.c, marginLeft: -4, opacity: 0.75 }}>{m.order}</sup>
        <span style={{ fontWeight: 700, fontSize: 9.5, color: MUT }}>{m.sub}</span>
        <div style={{ flex: 1, height: 1, background: '#efece5' }} />
      </div>); }
    const above = firstInSec ? null : segBelow(nodes[i - 1]);
    const below = lastInSec ? null : segBelow(n);

    if (n.kind === 'trail') {
      const tkey = 'trail' + n.t.i, tdone = !!hit[tkey], tcol = tdone ? GREEN : PURP;
      const tf = (n.t.trail || '').toUpperCase() + (n.t.trailLen ? ' · ' + n.t.trailLen : '');
      rows.push(
        <div key={'n' + i} style={{ display: 'flex', gap: 13, alignItems: 'stretch', minHeight: 32 }}>
          <div style={{ width: 34, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{halfLine(above)}
            <div className={'lmdot' + (isCel(tkey) ? ' lmpop' : '')} onClick={() => levelsProgress.toggle(id, tkey)} style={{ width: 14, height: 14, borderRadius: '50%', background: tdone ? tcol : '#fff', border: '2px solid ' + tcol, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>{tdone ? check : null}</div>
            {halfLine(below)}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div className="lmnode" onClick={() => levelsProgress.toggle(id, tkey)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: tdone ? '#eef7f1' : '#f5f2fe', border: '1px solid ' + (tdone ? '#d3ebde' : '#e7dffa'), borderRadius: 9, padding: '3px 11px 3px 4px' }}>
              <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 9.5, color: '#fff', background: tcol, borderRadius: 6, padding: '2px 6px', letterSpacing: '.02em' }}>{tf || 'TRAIL'}</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: tdone ? GREEN : '#7a6cc0' }}>{tdone ? 'Trail carried · done' : 'Donchian trail up'}</span>
            </div>
          </div>
        </div>);
      return;
    }

    const key = keyFor(n), on = !!hit[key];
    let col = GREEN, name = '', price = '', secondary = '', reward: string | null = null;
    if (n.kind === 'tp') { col = GREEN; name = 'TP' + n.t.i; price = mny(n.t.price); secondary = (on ? 'banked ' : 'bank ') + Math.round(n.t.pct) + '% · ' + n.t.rr + 'R'; reward = isFinite(n.t.rewardUSD) ? '+' + mny(n.t.rewardUSD) : null; }
    else if (n.kind === 'fill') { col = PURPD; name = 'Fill ' + (n.f.i + 1); price = mny(n.f.price); secondary = (on ? 'filled ' : '') + Math.round(n.f.pct) + '% of position'; }
    else if (n.kind === 'stop') { col = RED; name = 'Stop'; price = mny(stop); secondary = (on ? 'stopped · ' : '') + '−' + (isFinite(c.distStopPct) ? c.distStopPct.toFixed(1) : '') + '% · exit all'; reward = isFinite(riskUSD) ? '−' + mny(riskUSD) : null; }
    else { col = RED; name = 'Liquidation'; price = mny(liq); secondary = (on ? 'liquidated · ' : '') + L + '× wipeout'; reward = isFinite(liqUSD) ? '−' + mny(liqUSD) : null; }

    const dot = on
      ? <div className={'lmdot' + (isCel(key) ? ' lmpop lmring' : '')} onClick={() => levelsProgress.toggle(id, key)} style={{ width: 19, height: 19, borderRadius: '50%', background: col, border: '2px solid #fff', boxShadow: '0 0 0 1.5px ' + col + ', 0 1px 3px rgba(20,20,12,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>{check}</div>
      : <div className="lmdot" onClick={() => levelsProgress.toggle(id, key)} style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', border: '2px solid ' + col, boxShadow: '0 1px 2px rgba(20,20,12,.08)', zIndex: 2 }} />;
    rows.push(
      <div key={'n' + i} style={{ display: 'flex', gap: 13, alignItems: 'stretch', minHeight: 46 }}>
        <div style={{ width: 34, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{halfLine(above)}{dot}{halfLine(below)}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div className="lmnode" onClick={() => levelsProgress.toggle(id, key)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '5px 9px', margin: '-5px -9px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-.01em', color: on ? col : INK }}>{name}</span>
              <span style={{ fontWeight: 600, fontSize: 10.5, color: MUT }}>{secondary}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 14, color: INK, letterSpacing: '-.02em' }}>{price}</span>
              {reward ? <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: (n.kind === 'stop' || n.kind === 'liq') ? RED : GREEN }}>{reward}</span> : null}
            </div>
          </div>
        </div>
      </div>);
  });

  // ---- header math ----
  const bankedPct = targets.reduce((s, t) => s + (hit['tp' + t.i] ? t.pct : 0), 0);
  const running = Math.max(0, 100 - bankedPct);
  const nHit = targets.filter((t) => hit['tp' + t.i]).length;
  const entered = fills.some((f) => hit['fill' + f.i]);
  const stopped = !!hit.stop, blown = !!hit.liq;
  const inPlay = entered && !stopped && !blown;
  const complete = entered && !stopped && !blown && targets.length > 0 && targets.every((t) => hit['tp' + t.i]);
  let lockedUSD = 0;
  targets.forEach((t) => { if (hit['tp' + t.i] && isFinite(t.rewardUSD)) lockedUSD += t.rewardUSD; });
  if (stopped && isFinite(riskUSD)) lockedUSD -= riskUSD;
  if (blown && isFinite(liqUSD)) lockedUSD -= liqUSD;
  const plannedUSD = c.planReward;
  const filledPct = fills.reduce((s, f) => s + (hit['fill' + f.i] ? f.pct : 0), 0);
  const lastHitTp = targets.filter((t) => hit['tp' + t.i]).sort((a, b) => a.distPct - b.distPct).slice(-1)[0];
  const stMeta = blown ? { t: 'Liquidated', c: RED, bg: '#fbe7e1' } : stopped ? { t: 'Stopped out', c: RED, bg: '#fbe7e1' } : bankedPct >= 100 ? { t: 'Fully banked', c: GREEN, bg: '#e5f4ec' } : lastHitTp ? { t: 'TP' + lastHitTp.i + ' hit', c: GREEN, bg: '#e5f4ec' } : inPlay ? { t: 'In play', c: PURPD, bg: '#efeafe' } : { t: 'Not entered', c: '#8a8577', bg: '#f1efe9' };
  const streakN = prog.streak, bnk = !!prog.banked[id];

  const stepBtn = (dir: 1 | -1, enabled: boolean) => (
    <button onClick={enabled ? () => levelsProgress.bump(id, dir) : undefined} disabled={!enabled}
      title={dir > 0 ? (bnk ? 'Streak already counted' : complete ? 'Plan followed — streak +1' : 'Bank all fills & targets first') : bnk ? 'Streak already counted' : 'Plan broke — streak −1'}
      style={{ border: 'none', background: 'transparent', padding: '3px 8px', cursor: enabled ? 'pointer' : 'default', color: enabled ? (dir < 0 ? '#d1553a' : GREEN) : '#dcd8cf', display: 'inline-flex', alignItems: 'center', borderLeft: dir < 0 ? 'none' : '1px solid #ece9e2' }}>
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">{dir < 0 ? <path d="M5 12h14" /> : <><path d="M12 5v14" /><path d="M5 12h14" /></>}</svg>
    </button>
  );
  const miniStat = (val: string, label: string, cc: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 13.5, color: cc }}>{val}</span>
      <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '.05em', textTransform: 'uppercase', color: MUT }}>{label}</span>
    </div>
  );
  const segs: React.ReactNode[] = [];
  targets.slice().sort((a, b) => a.distPct - b.distPct).forEach((t, i) => { if (hit['tp' + t.i]) segs.push(<div key={'b' + i} style={{ width: t.pct + '%', background: i % 2 ? GREEN2 : GREEN }} />); });
  if (running > 0) segs.push(<div key="run" style={{ width: running + '%', background: (stopped || blown) ? '#f0d3ca' : '#eceae3' }} />);

  return shell(
    <div>
      <div style={{ padding: '18px 20px 16px', borderBottom: '1px solid #f1efe9' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 15 }}>
          <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '.02em', padding: '4px 11px', borderRadius: 99, color: stMeta.c, background: stMeta.bg }}>{stMeta.t}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill={streakN > 0 ? '#e07b2f' : '#cdc8bd'}><path d="M12 2C8 6 6 9 6 13a6 6 0 0 0 12 0c0-2-1-4-3-6 0 2-1 3-2 3 0-3-1-6-1-8z" /></svg>
                <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: streakN > 0 ? '#c96a1f' : '#b3ad9f' }}>{streakN}</span>
                <span style={{ fontWeight: 700, fontSize: 10, color: MUT }}>streak</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #ece9e2', borderRadius: 8, overflow: 'hidden', opacity: bnk ? 0.55 : 1 }}>{stepBtn(-1, !bnk)}{stepBtn(1, complete && !bnk)}</div>
            </div>
            <button className="lmghost2" onClick={() => levelsProgress.reset(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: '6px 8px', borderRadius: 8, fontWeight: 700, fontSize: 11, color: '#a8a294', cursor: 'pointer' }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>Reset
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 30, lineHeight: 1, letterSpacing: '-.03em', color: lockedUSD > 0 ? GREEN : lockedUSD < 0 ? RED : INK }}>{(lockedUSD > 0 ? '+' : lockedUSD < 0 ? '−' : '') + '$' + Math.round(Math.abs(lockedUSD)).toLocaleString('en-US')}</span>
            <span style={{ fontWeight: 600, fontSize: 10.5, color: MUT }}>{'locked in' + (isFinite(plannedUSD) && plannedUSD > 0 ? ' · of +' + mny(plannedUSD) + ' planned' : '') + (filledPct > 0 && filledPct < 100 ? ' · on ' + Math.round(filledPct) + '% filled' : '')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>{miniStat(nHit + ' / ' + targets.length, 'Targets', INK)}{miniStat(Math.round(bankedPct) + '%', 'Banked', bankedPct > 0 ? GREEN : INK)}</div>
        </div>
        <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', background: '#eceae3' }}>{segs}</div>
      </div>
      <div style={{ padding: '16px 20px 20px' }}>{rows}
        {/* footnotes: the dissolved thesis fields, numbered to their group markers */}
        <div style={{ marginTop: 20, paddingTop: 13, borderTop: '1px solid #efece5', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {(['targets', 'entry', 'risk'] as const).map((g) => { const m = grpMeta[g]; return (
            <div key={'fn' + g} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <sup style={{ fontFamily: "'Newsreader',Georgia,serif", fontWeight: 500, fontSize: 11, lineHeight: 1.7, color: m.c, flex: '0 0 auto', opacity: 0.85 }}>{m.order}</sup>
              <textarea key={p.id + '_' + m.field} defaultValue={(p[m.field] as string) || ''} placeholder={m.ph} rows={1}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== ((p[m.field] as string) || '')) planActions.updateThesis(p.id, m.field, v); }}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: 0, padding: 0, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Newsreader',Georgia,serif", fontWeight: 400, fontSize: 12.5, lineHeight: 1.55, color: '#5f5c52', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', fieldSizing: 'content' } as React.CSSProperties} />
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}

// ── header pills ──
function ConvPill({ p }: { p: Plan }) {
  const [open, setOpen] = useState(false);
  const cur = p.conv === 'high' ? 3 : p.conv === 'low' ? 1 : 2;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} title="Conviction" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0 }}>
        <ConvDots n={cur} /><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#bbb3a8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open ? <PopMenu onClose={() => setOpen(false)} top={8}>{CONVS.map((cv) => <PopRow key={cv.k} active={cv.k === p.conv} onClick={() => { setOpen(false); if (cv.k !== p.conv) planActions.updateThesis(p.id, 'conv', cv.k); }}><ConvDots n={cv.n} />{cv.label}</PopRow>)}</PopMenu> : null}
    </span>
  );
}
function StatusPill({ p }: { p: Plan }) {
  const [open, setOpen] = useState(false);
  const sm = STATUSES.find((s) => s.k === p.status) || STATUSES[0];
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: sm.c, background: sm.bg, padding: '3px 6px 3px 9px', borderRadius: 99, border: 'none' }}>{sm.label}<svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}><polyline points="6 9 12 15 18 9" /></svg></button>
      {open ? <PopMenu onClose={() => setOpen(false)} top={6}>{STATUSES.map((st) => <PopRow key={st.k} active={st.k === p.status} onClick={() => { setOpen(false); if (st.k !== p.status) planActions.movePlan(p.id, st.k); }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: st.c, flex: '0 0 auto' }} />{st.label}</PopRow>)}</PopMenu> : null}
    </span>
  );
}
function PopMenu({ children, onClose, top }: { children: React.ReactNode; onClose: () => void; top: number }) {
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 24 }} />
      <div style={{ position: 'absolute', top: `calc(100% + ${top}px)`, left: 0, zIndex: 25, background: '#fff', borderRadius: 12, border: '1px solid #ececea', boxShadow: '0 14px 34px rgba(20,18,12,0.16)', padding: 5, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 152 }}>{children}</div>
    </>
  );
}
function PopRow({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', background: active || h ? '#faf9f7' : 'transparent', fontFamily: 'inherit', textAlign: 'left', width: '100%' }}>
      {children}<span style={{ flex: 1, fontWeight: 700, fontSize: 12.5, color: '#1a1813' }} />
      {active ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1f9d55" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}
    </button>
  );
}

const KF = `@keyframes pdIn{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes pdFade{from{opacity:0}to{opacity:1}}@keyframes lmpop{0%{transform:scale(1)}45%{transform:scale(1.42)}100%{transform:scale(1)}}@keyframes lmglow{0%{box-shadow:0 0 0 0 rgba(31,157,85,.5)}100%{box-shadow:0 0 0 13px rgba(31,157,85,0)}}.lmdot{cursor:pointer;transition:transform .15s ease}.lmdot:hover{transform:scale(1.13)}.lmnode{cursor:pointer;border-radius:11px;transition:background .14s}.lmnode:hover{background:#faf8f4}.lmpop{animation:lmpop .5s cubic-bezier(.34,1.56,.64,1)}.lmring{animation:lmglow .7s ease-out}.lmghost2:hover{background:#f1efe9 !important;color:#6a6357 !important}.pd-icobtn:hover{background:#1a1813 !important;border-color:#1a1813 !important;color:#fff !important}.pd-icobtn-del:hover{background:#df5338 !important;border-color:#df5338 !important;color:#fff !important}.pd-resize::before{content:"";position:absolute;left:0;top:0;height:100%;width:3px;background:transparent;transition:background .15s}.pd-resize:hover::before{background:#7c5cff}.pd-resize::after{content:"";position:absolute;left:3px;top:50%;transform:translateY(-50%);width:4px;height:34px;border-radius:3px;background:#d8d4ea;opacity:0;transition:opacity .15s}.pd-resize:hover::after{opacity:1}`;

// the plan drawer has its own wide, independently-persisted width (tdplan_pdrawer_w)
const PDW_MIN = 760;
const pdwClamp = (v: number) => Math.max(PDW_MIN, Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.98 : 1760, v));
function usePlanDrawerWidth(): [number, (v: number) => void] {
  const [w, setW] = useState(1296);
  useEffect(() => {
    let init = Math.min(1760, window.innerWidth * 0.9);
    try { const s = localStorage.getItem('tdplan_pdrawer_w'); if (s) init = pdwClamp(parseFloat(s)); } catch { /* ignore */ }
    setW(init);
  }, []);
  const set = (v: number) => { const c = pdwClamp(v); setW(c); try { localStorage.setItem('tdplan_pdrawer_w', String(Math.round(c))); } catch { /* ignore */ } };
  return [w, set];
}

export function PlanDrawer() {
  const { openPlanId, plans } = usePlanStore();
  const [drawerW, setDrawerW] = usePlanDrawerWidth();
  const { data: account } = useAccount();
  const { data: positions } = usePositions();
  const { data: candles } = useBtcCandles(Math.floor(Date.now() / 1000) - 20 * 86400);
  const equity = parseFloat(account?.total || '') || TP_EQUITY;
  const btcPos = (Array.isArray(positions) ? positions : []).find((x) => x.contract === 'BTC_USDT' && x.size !== 0);
  const btcMark = parseFloat(btcPos?.mark_price || '') || (candles && candles.length ? parseFloat(candles[candles.length - 1].c) : NaN) || undefined;

  const p = openPlanId ? plans.find((x) => x.id === openPlanId) : null;
  if (!p) return null;
  const d = planToDraft(p), c = tpCompute(d, equity, p.sym === 'BTC' ? btcMark : undefined);
  const close = () => planActions.closePlan();
  const dot = <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d4cc' }} />;
  const ico = (title: string, onClick: () => void, kids: React.ReactNode, del?: boolean) => (
    <button onClick={onClick} title={title} className={'pd-icobtn' + (del ? ' pd-icobtn-del' : '')} style={{ cursor: 'pointer', border: '1px solid #ebe9e4', background: '#fff', width: 36, height: 36, borderRadius: 11, color: '#8c897f', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(20,20,12,0.04)', transition: 'color .12s, border-color .12s, background .12s' }}>{kids}</button>
  );

  return (
    <>
      <style>{KF}</style>
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.34)', animation: 'pdFade .2s both' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: drawerW, maxWidth: '98vw', zIndex: 91, background: '#fff', boxShadow: '-30px 0 80px rgba(20,18,12,0.26)', display: 'flex', flexDirection: 'column', animation: 'pdIn .4s cubic-bezier(.22,.9,.28,1) both' }}>
        <div className="pd-resize" onMouseDown={(e) => { e.preventDefault(); const startX = e.clientX, startW = drawerW; const move = (ev: MouseEvent) => setDrawerW(startW + (startX - ev.clientX)); const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); }}
          title="Drag to resize" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 9, cursor: 'ew-resize', zIndex: 93 }} />
        {/* header */}
        <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', padding: '18px 26px', borderBottom: '1px solid #ece9e2', background: 'linear-gradient(180deg,#ffffff,#faf9f7)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
              <div style={{ width: 42, height: 42, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #ece9e2', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,12,0.04)' }}><div style={{ transform: 'scale(2.5)', display: 'flex' }}><CoinIcon sym={p.sym} /></div></div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a99ce4' }}>Trade plan</span>
                <span style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.08, letterSpacing: '-0.025em', color: '#1a1813', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpPlanName(p)}</span>
                {/* rationale — the dissolved thesis's one-line "why", moved beside the title */}
                <textarea key={p.id + '_rationale'} rows={1} defaultValue={p.rationale || ''} placeholder="why this trade — the one-line case" spellCheck={false}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.rationale || '')) planActions.updateThesis(p.id, 'rationale', v); }}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '3px 0 0', padding: 0, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Newsreader',Georgia,serif", fontStyle: 'italic', fontWeight: 400, fontSize: 15, lineHeight: 1.45, color: '#5f5c52', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', fieldSizing: 'content' } as React.CSSProperties} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <ConvPill p={p} />{dot}<StatusPill p={p} />{dot}
              <PlanInlineDate plan={p}>{({ onToggle }) => { const w = planWindowLabel(p); return (
                <button onClick={onToggle} title={w ? 'Change planned window' : 'Set planned window'}
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 10, letterSpacing: '0.03em', color: w ? '#6b46e0' : '#a99ce4', background: w ? '#f3eefe' : 'transparent', border: '1px solid ' + (w ? '#e5dcfa' : '#e3dcf6'), borderRadius: 99, padding: '3px 9px 3px 7px', borderStyle: w ? 'solid' : 'dashed', fontFamily: 'inherit' }}>
                  <CalIcon size={11} stroke="currentColor" />{w ? w.main + (w.sub ? ' · ' + w.sub : '') : 'Set date'}
                </button>
              ); }}</PlanInlineDate>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-end', gap: 13, flex: '0 0 auto' }}>
            <DirLevHeading d={d} />
            <div style={{ display: 'flex', gap: 8 }}>
              {ico('Edit plan', () => planActions.startEdit(p.id, planToDraft(p)), <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>)}
              {ico('Duplicate', () => planActions.duplicatePlan(p.id), <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x={9} y={9} width={13} height={13} rx={2} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>)}
              {ico('Delete', () => { planActions.deletePlan(p.id); close(); }, <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>, true)}
              {ico('Close', close, <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>)}
            </div>
          </div>
        </div>
        {/* body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: '22px 26px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Tp3aStrip c={c} d={d} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,65fr) minmax(0,35fr)', gap: 20, alignItems: 'start', flexShrink: 0 }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><ChartCard p={p} c={c} d={d} /></div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><LevelsMap p={p} c={c} d={d} /></div>
          </div>
        </div>
      </div>
    </>
  );
}
