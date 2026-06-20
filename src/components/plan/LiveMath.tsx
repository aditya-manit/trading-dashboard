'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { type Compute, type PlanDraft, tpMoney } from '@/lib/plan-model';
import { CoinIcon } from './coins';

const PURP = '#7c5cff', GREEN = '#1f9d55', RED = '#df5338', ORANGE = '#ff7a00', INK = '#1a1813', MUT = '#a8a69b', SUB = '#897f70', DASH = '—';
const money = (v: number) => (isFinite(v) ? tpMoney(v, v < 1000 ? 2 : 0) : DASH);

function Lbl({ children, dot }: { children: ReactNode; dot: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUT }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot }} />
      {children}
    </span>
  );
}

// Port of tpLiveA: levels → risk/reward → position/margin(/liq) → stop&liq plot.
export function LiveMath({ c, d, dense = false, idSuffix }: { c: Compute; d: PlanDraft; dense?: boolean; idSuffix?: string }) {
  const [hover, setHover] = useState(false);
  const padCell = dense ? '8px 10px' : '12px 12px', padRR = dense ? '11px 14px' : '16px 18px', padR3 = dense ? 10 : 14;
  const fLvl = dense ? 15 : 18, fBig = dense ? 16.5 : 21, fSub = dense ? 9.5 : 10.5, fPos = dense ? 13 : 15, fMar = dense ? 15 : 17, fVerdict = dense ? 9.5 : 10, fLval = dense ? 11 : 12;
  const gapRR = dense ? 8 : 11, gap4 = dense ? 9 : 13, barH = dense ? 9 : 12, meterH = dense ? 6 : 7, liqBarH = dense ? 8 : 9, labH = dense ? 30 : 34, dotSz = dense ? 9 : 11;
  const dn = c.isLong ? '−' : '+', up = c.isLong ? '+' : '−';
  const tgt = c.rrList[0];

  const lv = [
    { dot: PURP, lab: 'Entry', val: c.hasEntry ? money(c.E) : DASH, col: INK, sub: '' },
    { dot: RED, lab: 'Stop', val: isFinite(c.S) && (c.hasStop || c.usingLiqStop) ? money(c.S) : DASH, col: INK, sub: isFinite(c.distStopPct) ? dn + c.distStopPct.toFixed(2) + '%' : '' },
    { dot: GREEN, lab: 'Target', val: tgt ? money(tgt.price) : DASH, col: INK, sub: tgt ? up + tgt.distPct.toFixed(1) + '%' : '' },
    { dot: PURP, lab: 'R : R', val: tgt ? tgt.rr + 'R' : DASH, col: PURP, sub: isFinite(c.blendedR) ? c.blendedR.toFixed(2) + ' blended' : '' },
  ];
  const row1 = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #f1f0ed' }}>
      {lv.map((x, i) => (
        <div key={i} style={{ padding: padCell, borderRight: i < 3 ? '1px solid #f1f0ed' : 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Lbl dot={x.dot}>{x.lab}</Lbl>
          <span style={{ fontWeight: 800, fontSize: fLvl, letterSpacing: '-0.01em', color: x.col, fontVariantNumeric: 'tabular-nums' }}>{x.val}</span>
          {x.sub && !dense ? <span style={{ fontWeight: 700, fontSize: 9.5, color: MUT }}>{x.sub}</span> : null}
        </div>
      ))}
    </div>
  );

  const rewardUSD = tgt ? tgt.rewardUSD : NaN, rewardPct = isFinite(rewardUSD) ? (rewardUSD / c.Q) * 100 : NaN;
  const pr = c.primaryR, riskW = isFinite(pr) && pr > 0 ? Math.max(8, Math.min(60, 100 / (1 + pr))) : 25;
  const row2 = (
    <div style={{ padding: padRR, borderBottom: '1px solid #f1f0ed', display: 'flex', flexDirection: 'column', gap: gapRR }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Lbl dot={RED}>{c.usingLiqStop ? 'Risk to liq' : 'Risk if stopped'}</Lbl>
          <span style={{ fontWeight: 800, fontSize: fBig, letterSpacing: '-0.02em', color: RED, fontVariantNumeric: 'tabular-nums' }}>{isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : DASH}</span>
          <span style={{ fontWeight: 700, fontSize: fSub, color: SUB }}>
            {isFinite(c.distStopPct) ? <span style={{ color: RED }}>{dn + c.distStopPct.toFixed(2) + '% to stop'}</span> : null}
            {isFinite(c.riskPct) ? (isFinite(c.distStopPct) ? ' → ' : '') + c.riskPct.toFixed(2) + '% of equity' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUT }}>
            Reward · TP1<span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: fBig, letterSpacing: '-0.02em', color: GREEN, fontVariantNumeric: 'tabular-nums' }}>{isFinite(rewardUSD) ? '+' + money(rewardUSD) : DASH}</span>
          <span style={{ fontWeight: 700, fontSize: fSub, color: SUB }}>
            {tgt ? <span style={{ color: GREEN }}>{up + tgt.distPct.toFixed(1) + '% to TP1'}</span> : null}
            {isFinite(rewardPct) ? (tgt ? ' → ' : '') + rewardPct.toFixed(1) + '% of equity' : ''}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', height: barH, borderRadius: 7, overflow: 'hidden', background: '#f0efeb' }}>
        <div style={{ width: riskW + '%', background: RED }} />
        <div style={{ flex: 1, background: GREEN }} />
      </div>
    </div>
  );

  const liqDistR3 = c.hasEntry && isFinite(c.liq) ? (Math.abs(c.E - c.liq) / c.E) * 100 : NaN;
  const row3 = (
    <div style={{ display: 'grid', gridTemplateColumns: dense ? 'max-content 1fr max-content' : 'max-content 1fr', alignItems: 'start', borderBottom: dense ? 'none' : '1px solid #f1f0ed' }}>
      <div style={{ padding: padR3, borderRight: '1px solid #f1f0ed', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Lbl dot={PURP}>Position</Lbl>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: fPos, letterSpacing: '-0.01em', color: INK, fontVariantNumeric: 'tabular-nums' }}>
          {c.hasQty ? <>{c.qty.toLocaleString('en-US', { maximumFractionDigits: c.qty < 1 ? 4 : 2 })}<CoinIcon sym={d.sym} /></> : DASH}
        </span>
        {isFinite(c.notional) ? <span style={{ fontWeight: 700, fontSize: 10, color: MUT, whiteSpace: 'nowrap' }}>{'Notional · ' + money(c.notional)}</span> : null}
      </div>
      <div style={{ padding: padR3, borderRight: dense ? '1px solid #f1f0ed' : 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Lbl dot={PURP}>Margin of equity</Lbl>
        <span style={{ alignSelf: 'flex-end', fontWeight: 800, fontSize: fMar, letterSpacing: '-0.01em', color: INK, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {isFinite(c.margin) ? money(c.margin) : DASH}<span style={{ color: PURP }}>{isFinite(c.marginPct) ? ' · ' + c.marginPct.toFixed(0) + '%' : ''}</span>
        </span>
        <span style={{ height: meterH, borderRadius: 99, background: '#f0efeb', overflow: 'hidden', display: 'block', marginTop: 1 }}>
          <span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, c.marginPct || 0)) + '%', background: PURP, borderRadius: 99 }} />
        </span>
      </div>
      {dense ? (
        <div style={{ padding: padR3, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Lbl dot={ORANGE}>Liquidation</Lbl>
          <span style={{ fontWeight: 800, fontSize: fPos, letterSpacing: '-0.01em', color: INK, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{c.hasEntry && isFinite(c.liq) ? money(c.liq) : DASH}</span>
          <span style={{ fontWeight: 700, fontSize: 10, color: ORANGE, whiteSpace: 'nowrap' }}>{isFinite(liqDistR3) ? (c.isLong ? '−' : '+') + liqDistR3.toFixed(1) + '%' : ''}</span>
        </div>
      ) : null}
    </div>
  );

  // ROW 4 — stop & liquidation vs price
  const stopDist = c.distStopPct, liqDist = c.hasEntry && isFinite(c.liq) ? (Math.abs(c.E - c.liq) / c.E) * 100 : NaN;
  const ready = c.hasEntry && isFinite(c.liq) && isFinite(c.S) && isFinite(stopDist) && isFinite(liqDist) && liqDist > 0;
  const stopPos = ready ? Math.max(10, Math.min(90, ((liqDist - stopDist) / liqDist) * 100)) : 84;
  const ratio = ready && stopDist > 0 ? liqDist / stopDist : NaN;
  let vCol = GREEN, vWord = 'Stop clear of liq';
  if (!ready) { vCol = '#b3b0a6'; vWord = 'Set entry & stop'; }
  else if (ratio < 1.5) { vCol = RED; vWord = 'Stop close to liq'; }
  else if (ratio < 3) { vCol = '#c9821f'; vWord = 'Stop near liq'; }
  const tipTxt = ready
    ? `Stop sits at ${dn}${stopDist.toFixed(2)}%, liquidation at ${dn}${liqDist.toFixed(1)}% — about ${isFinite(ratio) ? (ratio < 10 ? ratio.toFixed(1) : ratio.toFixed(0)) : DASH}× further from price.`
    : 'Set entry, stop & leverage to see how far liquidation sits from your stop.';
  const dot = (col: string, extra: CSSProperties) => <div style={{ position: 'absolute', top: '50%', width: dotSz, height: dotSz, borderRadius: '50%', background: col, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(20,20,12,0.06)', ...extra }} />;
  const labCol = (al: CSSProperties, a: ReactNode, b: ReactNode, cc: ReactNode) => <div style={{ position: 'absolute', top: 0, display: 'flex', flexDirection: 'column', gap: 1, ...al }}>{a}{b}{cc}</div>;
  const lTiny = (t: string, col: string) => <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: col }}>{t}</span>;
  const lVal = (t: string) => <span style={{ fontWeight: 800, fontSize: fLval, letterSpacing: '-0.01em', color: INK, fontVariantNumeric: 'tabular-nums' }}>{t}</span>;
  const lPct = (t: string, col: string) => <span style={{ fontWeight: 700, fontSize: 10, color: col }}>{t}</span>;
  const row4 = (
    <div style={{ padding: padRR, display: 'flex', flexDirection: 'column', gap: gap4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl dot={ORANGE}>Stop &amp; liquidation vs price</Lbl>
        <span onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: fVerdict, color: vCol, cursor: 'help' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={vCol} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
          <span style={{ borderBottom: '1px dashed ' + (hover ? vCol : 'rgba(120,116,104,0.4)'), paddingBottom: 1, transition: 'border-color .15s' }}>{vWord}</span>
          {hover ? <span style={{ position: 'absolute', bottom: 'calc(100% + 9px)', right: 0, width: 210, background: '#1a1813', color: '#fbfbf9', fontSize: 11.5, fontWeight: 500, lineHeight: 1.45, textTransform: 'none', padding: '9px 12px', borderRadius: 10, boxShadow: '0 10px 26px rgba(20,18,12,0.22)', zIndex: 30, textAlign: 'left', whiteSpace: 'normal', pointerEvents: 'none' }}>{tipTxt}</span> : null}
        </span>
      </div>
      <div style={{ position: 'relative', padding: '3px 0' }}>
        <div style={{ position: 'relative', display: 'flex', height: liqBarH, borderRadius: 99, overflow: 'hidden', background: '#f0efeb' }}>
          <div style={{ width: stopPos + '%', background: ready ? ORANGE : '#dedcd5' }} />
          <div style={{ flex: 1, background: ready ? RED : '#ece9e3' }} />
        </div>
        {dot(ready ? ORANGE : '#c2c0b6', { left: 0, transform: 'translateY(-50%)' })}
        {dot(ready ? RED : '#c2c0b6', { left: stopPos + '%', transform: 'translate(-50%,-50%)' })}
        {dot(PURP, { right: 0, transform: 'translateY(-50%)' })}
      </div>
      <div style={{ position: 'relative', height: labH }}>
        {labCol({ left: 0, alignItems: 'flex-start' }, lTiny('Liq', ORANGE), lVal(ready ? money(c.liq) : DASH), lPct(ready ? dn + liqDist.toFixed(1) + '%' : '', ORANGE))}
        {labCol({ right: (100 - stopPos) + '%', alignItems: 'flex-end' }, lTiny('Stop', RED), lVal(ready ? money(c.S) : DASH), lPct(ready ? dn + stopDist.toFixed(2) + '%' : '', RED))}
        {labCol({ right: 0, alignItems: 'flex-end' }, lTiny('Price', PURP), lVal(c.hasEntry ? money(c.E) : DASH), lPct('now', MUT))}
      </div>
    </div>
  );

  return <div>{row1}{row2}{row3}{dense ? null : row4}</div>;
}
