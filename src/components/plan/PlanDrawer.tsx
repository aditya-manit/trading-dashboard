'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpCompute, planToDraft, tpPlanName, tpMoney, TP_EQUITY, tpEntryRungs, pctNum, tpNum, type Plan, type Status, type PlanDraft, type Level } from '@/lib/plan-model';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { CoinIcon } from './coins';
import { PlanInlineDate } from './PlanInlineDate';
import { useLevelsProgress, levelsProgress } from '@/lib/levels-progress';

const MONO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
const PJS = "'Plus Jakarta Sans', sans-serif";
const mny = (v: number) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const STATUSES: { k: Status; label: string; c: string; bg: string; border: string }[] = [
  { k: 'idea', label: 'Idea', c: '#6a45d8', bg: '#f3f0ff', border: '#e7ddfb' },
  { k: 'armed', label: 'Armed', c: '#1f8a52', bg: '#eef8f1', border: '#cfe9da' },
  { k: 'triggered', label: 'Triggered', c: '#c9821f', bg: '#fbf2e3', border: '#f0dcbb' },
];
const CONVS = [{ k: 'low', label: 'Low', n: 1 }, { k: 'med', label: 'Medium', n: 2 }, { k: 'high', label: 'High', n: 3 }] as const;

// ── tp2bStrip — six figures on one bordered surface, R:R spanning both rows (handoff: 2b) ──
const B_PURP = '#7c5cff', B_GREEN = '#1f9d55', B_RED = '#df5338', B_ORANGE = '#ff7a00', B_INK = '#1a1813', B_LBL = '#b3ada0', B_RULE = '#f1eff5';
function Tp2bStrip({ c, d }: { c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const money = (v: number, dec = 0) => (isFinite(v) ? tpMoney(v, dec) : '—');
  const cap = (t: string) => <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 8.5, letterSpacing: '0.16em', color: B_LBL, whiteSpace: 'nowrap' }}>{t}</span>;
  const big = (txt: string, col: string, size = 22) => <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: '-0.025em', color: col, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{txt}</span>;
  const sub = (txt: string, col: string, tag: string) => <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: col, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{txt}<span style={{ color: B_LBL, fontWeight: 500 }}>{' ' + tag}</span></span>;
  const cellSt = (extra?: React.CSSProperties): React.CSSProperties => ({ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...extra });
  const rule: React.CSSProperties = { borderLeft: '1px solid ' + B_RULE };

  const slices = (c.levels || []).filter((l) => isFinite(l.rewardUSD));
  const denom = slices.reduce((s, l) => s + (l.rewardUSD > 0 ? l.rewardUSD : 0), 0);
  const totalReward = c.planReward, hasReward = c.planRewardHas, planR = c.planR;
  const rrStr = isFinite(planR) ? planR.toFixed(2) : '—';
  const rrColor = !isFinite(planR) ? '#b3b0a6' : planR >= 2.5 ? B_GREEN : planR >= 1.5 ? '#c9821f' : B_RED;
  const rrVerd = !isFinite(planR) ? 'Set levels' : planR >= 2.5 ? 'Strong edge' : planR >= 1.5 ? 'Fair edge' : 'Thin edge';
  let finalMove = NaN; (c.levels || []).forEach((l) => { if (l.hasPrice && isFinite(l.distPct)) { if (!isFinite(finalMove) || l.distPct > finalMove) finalMove = l.distPct; } });
  const rewEqPct = isFinite(totalReward) && isFinite(c.Q) && c.Q > 0 ? (totalReward / c.Q) * 100 : NaN;

  // ── row 1: risk | reward + split bar | R:R (spans both rows)
  const riskCell = (
    <div style={cellSt({ flex: '0 0 auto', paddingLeft: 22, justifyContent: 'center' })}>{cap('RISK')}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        {big(isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : '—', B_RED, 21)}
        {isFinite(c.distStopPct) ? sub(c.distStopPct.toFixed(2) + '%', '#3a352c', 'pos') : null}
        {isFinite(c.riskPct) ? sub(c.riskPct.toFixed(2) + '%', B_PURP, 'eq') : null}
      </div>
    </div>
  );
  const rewCell = (
    <div style={cellSt({ flex: 1, minWidth: 0, justifyContent: 'center' })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>{cap('REWARD · PLAN')}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            {big(hasReward ? '+' + money(totalReward) : '—', B_GREEN, 21)}
            {isFinite(finalMove) ? sub(finalMove.toFixed(2) + '%', '#3a352c', 'pos') : null}
            {isFinite(rewEqPct) ? sub(rewEqPct.toFixed(2) + '%', B_PURP, 'eq') : null}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', gap: 2, height: 4 }}>{slices.map((l, i) => { const s = denom > 0 ? Math.max(0, l.rewardUSD) / denom : 0; return s > 0 ? <div key={i} style={{ flexGrow: s, flexShrink: 1, flexBasis: 0, minWidth: 2, background: i % 2 ? '#6cc492' : B_GREEN }} /> : null; })}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>{slices.map((l, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: i === 0 ? 'flex-start' : i === slices.length - 1 ? 'flex-end' : 'center' }}>
              <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: '#3a352c', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{isFinite(l.rewardUSD) ? '+' + money(l.rewardUSD) : '—'}</span>
              <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 8.5, letterSpacing: '0.14em', color: B_LBL, whiteSpace: 'nowrap' }}>{'TP' + l.i + ' · ' + Math.round(l.pct) + '%'}</span>
            </div>
          ))}</div>
        </div>
      </div>
    </div>
  );

  const rLevels = (c.levels || []).filter((l) => isFinite(l.r));
  const rTotal = rLevels.reduce((s, l) => s + (l.r > 0 ? l.r : 0), 0);
  const rrCell = (
    <div style={cellSt({ width: 186, flex: '0 0 auto', paddingRight: 22, justifyContent: 'center', ...rule })}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>{cap('R : R')}<span style={{ fontFamily: PJS, fontWeight: 700, fontSize: 10.5, color: rrColor, whiteSpace: 'nowrap' }}>{rrVerd}</span></div>
      {big(rrStr, rrColor, 40)}
      {rLevels.length ? <div style={{ display: 'flex', gap: 2, height: 4 }}>{rLevels.map((l, i) => { const s = rTotal > 0 ? Math.max(0, l.r) / rTotal : 0; return s > 0 ? <div key={i} style={{ flexGrow: s, flexShrink: 1, flexBasis: 0, minWidth: 2, background: i % 2 ? '#6cc492' : B_GREEN }} /> : null; })}</div> : null}
      {rLevels.length ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>{rLevels.map((l, i) => <span key={i} style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: '#3a352c', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.r.toFixed(2) + 'R'}</span>)}</div> : null}
    </div>
  );

  // ── row 2: stop vs liq | position | margin
  const price = c.mkt.mark;
  const liqDist = isFinite(c.liq) ? (Math.abs(price - c.liq) / price) * 100 : NaN;
  const stopDist = isFinite(c.S) ? (Math.abs(price - c.S) / price) * 100 : NaN;
  const cushion = isFinite(liqDist) && isFinite(stopDist) && stopDist > 0 ? liqDist / stopDist : NaN;
  const verd = !isFinite(cushion) ? { t: '—', c: '#b3b0a6' } : cushion >= 3 ? { t: 'Clear of liq', c: B_GREEN } : cushion >= 1.5 ? { t: 'Near liq', c: '#c9821f' } : { t: 'Close to liq', c: B_RED };
  const stopPos = isFinite(liqDist) && isFinite(stopDist) && liqDist > 0 ? Math.max(4, Math.min(96, (1 - stopDist / liqDist) * 100)) : 50;
  const tdot = (left: number, col: string) => <span style={{ position: 'absolute', left: left + '%', top: '50%', width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '2.2px solid ' + col, transform: 'translate(-50%,-50%)' }} />;
  const micro = (lab: string) => <span style={{ color: B_LBL, fontWeight: 500, letterSpacing: '0.14em', fontSize: 8.5 }}>{lab}</span>;
  const liqCell = (
    <div style={cellSt({ flex: 1, minWidth: 0, paddingLeft: 24 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>{cap('STOP VS LIQ')}<span style={{ fontFamily: PJS, fontWeight: 700, fontSize: 10.5, color: verd.c, whiteSpace: 'nowrap' }}>{verd.t}</span></div>
      <div style={{ position: 'relative', height: 12, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: B_ORANGE, overflow: 'hidden' }}><div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '9%', background: B_RED }} /></div>
        {tdot(1, B_ORANGE)}{tdot(stopPos, B_RED)}{tdot(99, B_PURP)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: '#3a352c', whiteSpace: 'nowrap' }}>{micro('LIQ ')}{isFinite(c.liq) ? money(c.liq) : '—'}</span>
        <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: '#3a352c', whiteSpace: 'nowrap' }}>{micro('STOP ')}{isFinite(c.S) ? money(c.S) : '—'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontWeight: 600, fontSize: 10.5, color: B_PURP, whiteSpace: 'nowrap' }}>{micro('PRICE ')}{money(price)}</span>
      </div>
    </div>
  );
  const posCell = (
    <div style={cellSt({ flex: '0 0 auto', justifyContent: 'center', ...rule })}>{cap('POSITION')}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{big(isFinite(c.qty) ? c.qty.toFixed(c.qty < 10 ? 3 : 2) : '—', B_INK, 19)}<CoinIcon sym={d.sym} size={16} /></div>
      <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10.5, color: B_LBL, whiteSpace: 'nowrap' }}>{isFinite(c.notional) ? money(c.notional) + ' notional' : '—'}</span>
    </div>
  );
  const marCell = (
    <div style={cellSt({ flex: '0 0 auto', paddingRight: 22, justifyContent: 'center', ...rule })}>{cap('MARGIN')}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>{big(isFinite(c.margin) ? money(c.margin) : '—', B_INK, 19)}{isFinite(c.marginPct) ? <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 11, color: B_PURP }}>{c.marginPct.toFixed(0) + '%'}</span> : null}</div>
      <span style={{ display: 'block', width: 84, height: 4, background: '#f0efeb', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, c.marginPct || 0)) + '%', background: B_PURP }} /></span>
    </div>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #ece9f2', borderRadius: 18, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>{riskCell}<div style={{ display: 'flex', flex: 1, minWidth: 0, ...rule }}>{rewCell}</div></div>
        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '1px solid ' + B_RULE }}>{liqCell}{posCell}{marCell}</div>
      </div>
      {rrCell}
    </div>
  );
}

function ConvDots({ n, sz = 6 }: { n: number; sz?: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: sz, height: sz, borderRadius: '50%', background: i < n ? '#7c5cff' : 'transparent', border: i < n ? 'none' : '1.5px solid #d3cfe6', boxSizing: 'border-box' }} />)}</span>;
}

const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #ece9f2', borderRadius: 20, overflow: 'hidden' };

const CHART_SYM_MAP: Record<string, string> = { BTC: 'BTC_USDT', ETH: 'ETH_USDT', SOL: 'SOL_USDT', XRP: 'XRP_USDT', DOGE: 'DOGE_USDT', BNB: 'BNB_USDT' };
const fitIcon = <><line x1={4} y1={4} x2={20} y2={4} /><line x1={4} y1={20} x2={20} y2={20} /><line x1={12} y1={8} x2={12} y2={16} /><polyline points="9 11 12 8 15 11" /><polyline points="9 13 12 16 15 13" /></>;
const expandGlyph = <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1={21} y1={3} x2={14} y2={10} /><line x1={3} y1={21} x2={10} y2={14} /></>;
const collapseGlyph = <><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1={14} y1={10} x2={21} y2={3} /><line x1={3} y1={21} x2={10} y2={14} /></>;

// ── Live chart card — the standalone Volume Candle Chart, driven by this plan's own
// levels + dates. Viewport-flexible height; expanding promotes the SAME box to full-screen
// (no second iframe, so zoom/pan/fit survive). Fit-plan posts a message into the iframe.
function ChartCard({ p, c, d }: { p: Plan; c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const [full, setFull] = useState(false);
  const [fitOn, setFitOn] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
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
  const fillSum = fills.reduce((s, f) => s + (isFinite(f.pct) ? f.pct : 0), 0);
  if (fills.length && fillSum <= 0) fills = fills.map((f) => ({ ...f, pct: +(100 / fills.length).toFixed(2) }));
  const targets = (c.levels || []).filter((l) => l.hasPrice).map((l) => ({ p: l.price, pct: isFinite(l.pct) ? l.pct : null }));

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
    // send the EFFECTIVE stop (c.S = the user stop, or the liquidation when none is set) so the
    // chart's Stop chip matches the strip's STOP figure and the handoff (Stop 79.9k), instead of
    // the phantom "Stop 0" that `null` produced — the chart guards with isFinite(), and
    // isFinite(null) is true (null→0). Omit (undefined → dropped by JSON) only when non-finite.
    stop: isFinite(c.S) ? c.S : undefined,
    liq: isFinite(c.liq) ? c.liq : undefined,
    start: p.startDate || d.startDate || null,
    end,
    needDates: !(p.startDate || d.startDate),
  };
  const chartSrc = '/candle-chart.html#embed=1&plan=' + encodeURIComponent(JSON.stringify(payload));
  const chartKey = p.id + '_livechart|' + payload.contract + '|' + payload.interval + '|' + (payload.start || '') + '|' + payload.end;

  const boxStyle: React.CSSProperties = full
    ? { position: 'fixed', inset: 0, zIndex: 9000, height: 'auto', maxHeight: 'none', background: '#fff' }
    : { position: 'relative', flex: '0 0 auto', height: 'calc(100vh - 362px)', minHeight: 360, background: '#fff' };
  const fit = () => { const f = frameRef.current; if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'tdFitPlan' }, '*'); setFitOn((v) => !v); };

  return (
    <div style={{ ...cardBox, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="pl-chart" style={boxStyle}>
        <iframe key={chartKey} ref={frameRef} src={chartSrc} title={full ? 'Live chart full screen' : 'Live chart'} loading="lazy" style={{ display: 'block', width: '100%', height: '100%', border: 'none' }} />
        <div style={{ position: 'absolute', top: full ? 10 : 6, right: full ? 10 : 6, zIndex: 3, display: 'flex', gap: 3 }}>
          <button type="button" title="Fit plan — scale the axis to show every level" aria-label="Fit plan" onClick={(e) => { e.stopPropagation(); fit(); }} className={'tpheadicon' + (fitOn ? ' tpheadicon-on' : '')} style={{ width: full ? 28 : 24, height: full ? 28 : 24, padding: 0, background: fitOn ? undefined : 'rgba(255,255,255,0.92)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{fitIcon}</svg>
          </button>
          {full
            ? <button type="button" title="Collapse chart (Esc)" aria-label="Collapse chart" onClick={(e) => { e.stopPropagation(); setFull(false); }} className="tpheadicon" style={{ width: 28, height: 28, padding: 0, background: 'rgba(255,255,255,0.92)' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{collapseGlyph}</svg></button>
            : <button type="button" title="Expand chart" aria-label="Expand chart" onClick={(e) => { e.stopPropagation(); setFull(true); }} className="tpheadicon" style={{ width: 24, height: 24, padding: 0, background: 'rgba(255,255,255,0.92)' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">{expandGlyph}</svg></button>}
        </div>
      </div>
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
    targets: { t: 'Targets', sub: 'bank & trail out', c: GREEN },
    entry: { t: 'Entry', sub: 'limit-ladder in', c: PURPD },
    risk: { t: 'Risk', sub: 'stop & liquidation', c: RED },
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
      <div style={{ padding: '16px 20px 20px' }}>{rows}</div>
    </div>
  );
}

// ── header baseline-row menus + thesis column ──
function hexRgba(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

function PopMenu({ children, onClose, top }: { children: React.ReactNode; onClose: () => void; top: number }) {
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 24 }} />
      <div style={{ position: 'absolute', top: `calc(100% + ${top}px)`, left: 0, zIndex: 25, background: '#fff', borderRadius: 12, border: '1px solid #ececea', boxShadow: '0 14px 34px rgba(20,18,12,0.16)', padding: 5, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 152 }}>{children}</div>
    </>
  );
}
function PopRow({ children, label, active, onClick }: { children?: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', background: active || h ? '#faf9f7' : 'transparent', fontFamily: PJS, textAlign: 'left', width: '100%' }}>
      {children}
      <span style={{ flex: 1, fontWeight: 700, fontSize: 12.5, color: '#1a1813' }}>{label}</span>
      {active ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1f9d55" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : null}
    </button>
  );
}

function StatusChip({ p }: { p: Plan }) {
  const [open, setOpen] = useState(false);
  const sm = STATUSES.find((s) => s.k === p.status) || STATUSES[0];
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: PJS, fontWeight: 800, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: sm.c, background: 'transparent', padding: '3px 6px', borderRadius: 4, border: '1px solid ' + sm.border }}>
        {sm.label}
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open ? <PopMenu onClose={() => setOpen(false)} top={6}>{STATUSES.map((st) => <PopRow key={st.k} active={st.k === p.status} label={st.label} onClick={() => { setOpen(false); if (st.k !== p.status) planActions.movePlan(p.id, st.k); }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: st.c, flex: '0 0 auto' }} /></PopRow>)}</PopMenu> : null}
    </span>
  );
}

function ConvChip({ p }: { p: Plan }) {
  const [open, setOpen] = useState(false);
  const cur = p.conv === 'high' ? 3 : p.conv === 'low' ? 1 : 2;
  const word = p.conv === 'high' ? 'High' : p.conv === 'low' ? 'Low' : 'Medium';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} title="Conviction" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0 }}>
          <ConvDots n={cur} />
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#bbb3a8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
        {open ? <PopMenu onClose={() => setOpen(false)} top={8}>{CONVS.map((cv) => <PopRow key={cv.k} active={cv.k === p.conv} label={cv.label} onClick={() => { setOpen(false); if (cv.k !== p.conv) planActions.updateThesis(p.id, 'conv', cv.k); }}><ConvDots n={cv.n} /></PopRow>)}</PopMenu> : null}
      </span>
      <span style={{ fontFamily: PJS, fontWeight: 700, fontSize: 11.5, color: '#3a352c', whiteSpace: 'nowrap' }}>{word}</span>
    </span>
  );
}

const WMONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseISO(s?: string): Date | null { if (!s) return null; const q = String(s).split('-'); return new Date(+q[0], +q[1] - 1, +q[2]); }
function dayN(x: Date | null): number | null { return x ? new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() : null; }
function WindowChip({ p }: { p: Plan }) {
  const start = parseISO(p.startDate), sel = parseISO(p.tradeDate);
  const hasVal = !!(start || sel);
  const fmtD = (x: Date) => WMONS[x.getMonth()] + ' ' + x.getDate();
  const compact = start && sel ? fmtD(start) + ' → ' + (start.getMonth() === sel.getMonth() ? String(sel.getDate()) : fmtD(sel)) : start ? fmtD(start) + ' → ?' : sel ? fmtD(sel) : 'Set window';
  const holdDays = start && sel ? Math.round(((dayN(sel) as number) - (dayN(start) as number)) / 86400000) : null;
  return (
    <PlanInlineDate plan={p}>{({ onToggle }) => (
      <button onClick={onToggle} title={hasVal ? 'Change planned window' : 'Set planned window'} className="tpheadicon" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'baseline', gap: 7, background: 'transparent', border: 'none', borderRadius: 6, padding: '1px 3px', width: 'auto', height: 'auto', color: 'inherit' }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: hasVal ? '#1a1813' : '#b3ada0', whiteSpace: 'nowrap' }}>{compact}</span>
        {holdDays != null ? <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11, color: '#b3ada0', whiteSpace: 'nowrap' }}>{holdDays + 'd'}</span> : null}
      </button>
    )}</PlanInlineDate>
  );
}

function RationaleField({ p }: { p: Plan }) {
  return (
    <textarea key={'th_rationale_' + (p.rationale || '')} rows={1} defaultValue={p.rationale || ''} placeholder="why this trade — the one-line case" spellCheck={false} className="tp-thline"
      onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.rationale || '')) planActions.updateThesis(p.id, 'rationale', v); }}
      style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: 0, padding: 0, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Newsreader',Georgia,serif", fontStyle: 'italic', fontWeight: 400, fontSize: 15, lineHeight: 1.5, color: '#5f5c52', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', fieldSizing: 'content' } as React.CSSProperties} />
  );
}

const THESIS_FIELDS: [keyof PlanDraft, string, string][] = [['rationale', 'Rationale', '#7c5cff'], ['trigger', 'Trigger', '#1f9d55'], ['invalidation', 'Invalidation', '#df5338'], ['targetNote', 'Target / exit', '#c9821f']];
function thFilled(p: Plan) { return THESIS_FIELDS.filter((f) => String((p as unknown as Record<string, unknown>)[f[0]] || '').trim()).length; }

function ThesisStub({ p }: { p: Plan }) {
  const filled = thFilled(p);
  return (
    <button type="button" onClick={() => planActions.toggleThesisCol()} title={'Open thesis · ' + filled + ' of 4 written'} aria-label="Open thesis"
      style={{ width: 26, alignSelf: 'stretch', minHeight: 190, cursor: 'pointer', background: '#faf8ff', border: '1px solid #ece9f2', borderRadius: 12, padding: '9px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      <span style={{ writingMode: 'vertical-rl', fontFamily: PJS, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8c7ad6' }}>Thesis</span>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 9.5, color: filled === 4 ? '#7c5cff' : '#c2410c' }}>{filled}</span>
    </button>
  );
}

function ThesisCol({ p }: { p: Plan }) {
  const filled = thFilled(p);
  const rec = p as unknown as Record<string, string>;
  const tRow = (field: keyof PlanDraft, lab: string, dot: string, last: boolean) => (
    <div key={field as string} className="tp-thesis-cell" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid #f3f2ef', ['--tint' as string]: hexRgba(dot, 0.05), ['--tintHover' as string]: hexRgba(dot, 0.028) } as React.CSSProperties}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: PJS, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: hexRgba(dot, 0.92) }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flex: '0 0 auto' }} />{lab}
      </span>
      <textarea key={p.id + '_' + (field as string) + '_' + (rec[field as string] || '')} className="tp-thesis-edit" rows={1} defaultValue={rec[field as string] || ''} placeholder={'Add ' + lab.toLowerCase() + '…'}
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== (rec[field as string] || '')) planActions.updateThesis(p.id, field, v); }}
        style={{ display: 'block', width: '100%', maxWidth: '100%', margin: 0, padding: 0, boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: PJS, fontWeight: 500, fontSize: 13, lineHeight: 1.55, color: '#3a382f', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', overflowX: 'hidden', fieldSizing: 'content' } as React.CSSProperties} />
    </div>
  );
  return (
    <div style={cardBox}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderBottom: '1px solid #f4f1ea', background: 'linear-gradient(180deg,#ffffff,#faf8ff)' }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: '#7c5cff', flex: '0 0 auto' }} />
        <span style={{ fontFamily: PJS, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c5cff' }}>Thesis</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, color: '#c0bbb0', marginLeft: 'auto' }}>{filled + '/4'}</span>
        <button type="button" onClick={() => planActions.toggleThesisCol()} title="Close thesis" aria-label="Close thesis" className="tpheadicon">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
        </button>
      </div>
      <div>{THESIS_FIELDS.map((f, i) => tRow(f[0], f[1], f[2], i === THESIS_FIELDS.length - 1))}</div>
    </div>
  );
}

function computeHold(d: PlanDraft): string | null {
  if (!d.tradeDate) return null;
  const pp = String(d.tradeDate).split('-'); const sel = new Date(+pp[0], +pp[1] - 1, +pp[2]);
  let st: Date;
  if (d.startDate) { const sp = String(d.startDate).split('-'); st = new Date(+sp[0], +sp[1] - 1, +sp[2]); }
  else { const n = new Date(); st = new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  const days = Math.round((sel.getTime() - st.getTime()) / 86400000);
  if (isNaN(days) || days < 0) return null;
  return days === 0 ? 'today' : days >= 14 ? '~' + Math.round(days / 7) + 'w' : '~' + days + 'd';
}

const KF = `@keyframes pdFadeIn{from{opacity:0}to{opacity:1}}@keyframes lmpop{0%{transform:scale(1)}45%{transform:scale(1.42)}100%{transform:scale(1)}}@keyframes lmglow{0%{box-shadow:0 0 0 0 rgba(31,157,85,.5)}100%{box-shadow:0 0 0 13px rgba(31,157,85,0)}}.lmdot{cursor:pointer;transition:transform .15s ease}.lmdot:hover{transform:scale(1.13)}.lmnode{cursor:pointer;border-radius:11px;transition:background .14s}.lmnode:hover{background:#faf8f4}.lmpop{animation:lmpop .5s cubic-bezier(.34,1.56,.64,1)}.lmring{animation:lmglow .7s ease-out}.lmghost2:hover{background:#f1efe9 !important;color:#6a6357 !important}.tpheadicon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;color:#7c5cff;background:transparent;border:1px solid transparent;cursor:pointer;transition:background .14s,border-color .14s,color .14s}.tpheadicon:hover{background:rgba(124,92,255,0.11);border-color:rgba(124,92,255,0.22);color:#5b3fd6}.tpheadicon:active{background:rgba(124,92,255,0.18)}.tpheadicon-on{background:rgba(124,92,255,0.14);border-color:rgba(124,92,255,0.28);color:#5b3fd6}.tpheadicon-on:hover{background:rgba(124,92,255,0.2)}.tpdrawericon{transition:background .14s,border-color .14s,color .14s}.tpdrawericon:hover{background:#1a1813 !important;border-color:#1a1813 !important;color:#fff !important}.tpdrawericon-del:hover{background:#df5338 !important;border-color:#df5338 !important;color:#fff !important}.tp-thesis-edit{cursor:text}.tp-thesis-edit::placeholder{color:#c5c3b9;font-style:italic}.tp-thesis-cell{transition:background .12s}.tp-thesis-cell:focus-within{background:var(--tint)}.tp-thline::placeholder{color:#c5c3b9;font-style:italic}@media(max-width:1160px){.pl-grid{grid-template-columns:1fr !important}.pl-chart{height:520px !important;flex:0 0 auto !important;max-height:none !important}}@media(max-height:720px){.pl-chart{height:440px !important;flex:0 0 auto !important;max-height:none !important}}`;

export function PlanDrawer() {
  const { openPlanId, plans, thesisCol } = usePlanStore();
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
  const isShort = d.dir === 'short';
  const levTxt = (tpNum(d.lev) || 5) + '×';
  const holdTxt = computeHold(d);

  const iconBtn = (title: string, onClick: () => void, kids: React.ReactNode, del?: boolean) => (
    <button onClick={onClick} title={title} className={'tpdrawericon' + (del ? ' tpdrawericon-del' : '')} style={{ cursor: 'pointer', border: '1px solid #ece9f2', background: '#fff', width: 30, height: 30, borderRadius: 9, color: '#9b978d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{kids}</button>
  );
  const cLbl = (t: string) => <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 8.5, letterSpacing: '0.16em', color: '#b3ada0', whiteSpace: 'nowrap' }}>{t}</span>;
  const hCell = (lbl: string, kids: React.ReactNode, extra?: React.CSSProperties) => <div style={{ padding: '10px 20px 11px', display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid #f1eff5', ...extra }}>{cLbl(lbl)}{kids}</div>;

  return (
    <>
      <style>{KF}</style>
      <div style={{ position: 'fixed', inset: 0, zIndex: 91, background: '#fff', display: 'flex', flexDirection: 'column', animation: 'pdFadeIn .22s ease', fontFamily: PJS }}>
        {/* header — 2b Swiss spine */}
        <div style={{ flex: '0 0 auto', display: 'flex', borderBottom: '1px solid #ece9e2', background: '#fff' }}>
          <div style={{ flex: '0 0 auto', width: 46, borderRight: '1px solid #f1eff5', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fcfcfb' }}>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: MONO, fontWeight: 600, fontSize: 9, letterSpacing: '0.3em', color: '#a99ce4', whiteSpace: 'nowrap' }}>TRADE PLAN</span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, padding: '22px 24px 16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 320 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div style={{ flex: '0 0 auto', display: 'flex' }}><CoinIcon sym={p.sym} size={30} /></div>
                  <span style={{ fontFamily: PJS, fontWeight: 800, fontSize: 31, lineHeight: 1, letterSpacing: '-0.038em', color: '#1a1813', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpPlanName(p)}</span>
                </div>
                <RationaleField p={p} />
              </div>
              <div style={{ display: 'flex', gap: 5, flex: '0 0 auto' }}>
                {iconBtn('Edit plan', () => planActions.startEdit(p.id, planToDraft(p)), <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>)}
                {iconBtn('Duplicate', () => planActions.duplicatePlan(p.id), <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x={9} y={9} width={13} height={13} rx={2} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>)}
                {iconBtn('Delete', () => { planActions.deletePlan(p.id); close(); }, <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>, true)}
                {iconBtn('Close', close, <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', borderTop: '1px solid #f1eff5', flexWrap: 'wrap' }}>
              {hCell('STATUS', <StatusChip p={p} />, { paddingLeft: 24, borderLeft: 'none' })}
              {hCell('WINDOW', <WindowChip p={p} />)}
              {hCell('CONV', <ConvChip p={p} />)}
              <div style={{ flex: 1, minWidth: 16 }} />
              {hCell('DIR', <span style={{ fontFamily: PJS, fontWeight: 800, fontSize: 13, color: isShort ? '#df5338' : '#1f9d55' }}>{isShort ? 'Short' : 'Long'}</span>)}
              {hCell('LEV', <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: '#1a1813' }}>{levTxt}</span>)}
              {holdTxt ? hCell('HOLD', <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: '#6b46e0' }}>{holdTxt}</span>, { paddingRight: 24 }) : null}
            </div>
          </div>
        </div>
        {/* body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: '22px 26px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}><Tp2bStrip c={c} d={d} /></div>
          <div className="pl-grid" style={{ display: 'grid', flex: '1 0 auto', minHeight: 'min-content', gridTemplateColumns: 'minmax(0,71fr) minmax(0,29fr) ' + (thesisCol ? '266px' : '26px'), gap: thesisCol ? 20 : 12, alignItems: 'start' }}>
            <div style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><ChartCard p={p} c={c} d={d} /></div>
            <div style={{ position: 'relative', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><LevelsMap p={p} c={c} d={d} /></div>
            {thesisCol ? <div style={{ minWidth: 0 }}><ThesisCol p={p} /></div> : <ThesisStub p={p} />}
          </div>
        </div>
      </div>
    </>
  );
}
