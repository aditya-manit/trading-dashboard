'use client';

import type { ReactNode } from 'react';
import { type Compute, type PlanDraft, tpMoney } from '@/lib/plan-model';

const PURP = '#7c5cff', GREEN = '#1f9d55', RED = '#df5338', AMBER = '#c9821f', FONT = 'Plus Jakarta Sans, sans-serif';

// Port of tpDiagram — TV-style risk(red)/reward(green) ladder with trend
// guideline, ideal-entry path (sweep → retest/reject → run to TP), and a
// clamped liquidation strip. Scales to entry/stop/targets (liq excluded).
export function RrDiagram({ c, d, compact = false }: { c: Compute; d: PlanDraft; compact?: boolean }) {
  const W = compact ? 496 : 540, axisX = compact ? 80 : 126, lineEnd = W - (compact ? 108 : 118);

  if (!c.hasEntry || (!c.hasStop && !c.usingLiqStop)) {
    return (
      <div style={{ height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', color: '#b3b0a6' }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#cfcdc4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#a8a69b' }}>Set an entry and a stop</span>
        <span style={{ fontWeight: 500, fontSize: 11.5, color: '#bdbbb1' }}>The risk / reward map draws itself as you type.</span>
      </div>
    );
  }

  const fmtP = (p: number) => '$' + p.toLocaleString('en-US', { maximumFractionDigits: p < 10 ? 4 : p < 1000 ? 2 : 0 });
  const mainPrices = [c.E, c.S].concat(c.rrList.map((r) => r.price));
  let lo = Math.min(...mainPrices), hi = Math.max(...mainPrices);
  if (hi === lo) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.18; hi += padv; lo -= padv;
  const distStop = Math.abs(c.E - c.S);
  const distLiq = isFinite(c.liq) ? Math.abs(c.E - c.liq) : Infinity;
  const liqOk = isFinite(c.liq) && c.hasEntry;
  const liqInside = liqOk && c.liq >= lo && c.liq <= hi;
  const liqBelow = liqOk && c.liq < lo;
  const liqAbove = liqOk && c.liq > hi;
  const liqBeforeStop = liqOk && distLiq < distStop * 0.985;
  const liqAtStop = liqOk && Math.abs(distLiq - distStop) <= distStop * 0.03;
  const strip = 58;
  const padTop = 28 + (liqAbove ? strip : 0);
  const mainH = 320;
  const padBot = 28 + (liqBelow ? strip : 0);
  const H = padTop + mainH + padBot;
  const y = (p: number) => padTop + ((hi - p) / (hi - lo)) * mainH;
  const els: ReactNode[] = [];
  const yE = y(c.E), yS = y(c.S);
  const tgtYs = c.rrList.map((r) => y(r.price));
  const farTgtY = c.rrList.length ? (c.isLong ? Math.min(...tgtYs) : Math.max(...tgtYs)) : yE;

  els.push(<rect key="rew" x={axisX} y={Math.min(yE, farTgtY)} width={lineEnd - axisX} height={Math.max(0, Math.abs(farTgtY - yE))} fill="rgba(31,157,85,0.10)" />);
  els.push(<rect key="rsk" x={axisX} y={Math.min(yE, yS)} width={lineEnd - axisX} height={Math.max(0, Math.abs(yS - yE))} fill="rgba(223,83,56,0.10)" />);

  const tCol = c.isLong ? GREEN : RED;
  const tA = c.isLong ? padTop + mainH - 12 : padTop + 12;
  const tB = c.isLong ? padTop + 12 : padTop + mainH - 12;
  els.push(<line key="trend" x1={axisX} y1={tA} x2={lineEnd} y2={tB} stroke={tCol} strokeWidth={1.5} strokeDasharray="7 7" opacity={0.24} />);
  els.push(
    <g key="trbadge" opacity={0.92}>
      <rect x={axisX + 2} y={padTop - 4} rx={5} width={c.isLong ? 82 : 98} height={17} fill={c.isLong ? 'rgba(31,157,85,0.12)' : 'rgba(223,83,56,0.12)'} />
      <text x={axisX + 10} y={padTop + 8} fontFamily={FONT} fontWeight={800} fontSize={8.5} letterSpacing="0.08em" fill={tCol}>{c.isLong ? '↗ UPTREND' : '↘ DOWNTREND'}</text>
    </g>,
  );

  const bx = lineEnd + 14;
  const bracket = (y1: number, y2: number, col: string, top: string, bot: string) => {
    const ym = (y1 + y2) / 2;
    return (
      <g key={'b' + top}>
        <path d={`M${bx},${y1 + 2} L${bx + 7},${y1 + 2} L${bx + 7},${y2 - 2} L${bx},${y2 - 2}`} fill="none" stroke={col} strokeWidth={1.5} opacity={0.5} />
        <text x={bx + 13} y={ym - 2} fontFamily={FONT} fontWeight={800} fontSize={10.5} letterSpacing="0.05em" fill={col}>{top}</text>
        <text x={bx + 13} y={ym + 12} fontFamily={FONT} fontWeight={700} fontSize={11} fill="#a8a69b">{bot}</text>
      </g>
    );
  };
  if (c.rrList.length && Math.abs(yE - farTgtY) > 12) els.push(bracket(Math.min(yE, farTgtY), Math.max(yE, farTgtY), GREEN, 'REWARD', isFinite(c.rrList[c.rrList.length - 1].rewardUSD) ? '+' + tpMoney(c.rrList[c.rrList.length - 1].rewardUSD, 0) : ''));
  if (Math.abs(yE - yS) > 12) els.push(bracket(Math.min(yE, yS), Math.max(yE, yS), RED, 'RISK', isFinite(c.riskUSD) ? '−' + tpMoney(c.riskUSD, 0) : ''));

  const level = (key: string, p: number, yy: number, col: string, label: string, dash: string | undefined, strong: boolean, below?: boolean) => {
    const ny = below ? yy + 14 : yy - 6, vy = below ? yy + 28 : yy + 11;
    return (
      <g key={key}>
        <line x1={axisX} y1={yy} x2={lineEnd} y2={yy} stroke={col} strokeWidth={strong ? 2.4 : 1.8} strokeDasharray={dash || 'none'} strokeLinecap="round" />
        <circle cx={axisX} cy={yy} r={3.5} fill={col} />
        <text x={axisX - 13} y={ny} textAnchor="end" fontFamily={FONT} fontWeight={800} fontSize={10} letterSpacing="0.04em" fill={col}>{label}</text>
        <text x={axisX - 13} y={vy} textAnchor="end" fontFamily={FONT} fontWeight={700} fontSize={12} fill="#1a1813">{fmtP(p)}</text>
      </g>
    );
  };
  c.rrList.forEach((r, i) => els.push(level('t' + i, r.price, y(r.price), GREEN, 'TP' + r.i + (isFinite(r.r) ? '  ' + r.r.toFixed(1) + 'R' : ''), '1 5', false)));
  const stopClose = Math.abs(yE - yS) < 30;
  els.push(level('entry', c.E, yE, PURP, d.entryMode === 'zone' ? 'ENTRY · ZONE' : 'ENTRY', undefined, true));
  if (liqAtStop && liqInside) {
    els.push(level('stop', c.S, yS, RED, 'STOP = LIQ ⚠', undefined, true, stopClose));
  } else {
    els.push(level('stop', c.S, yS, RED, 'STOP', undefined, true, stopClose));
    if (liqOk && liqInside) {
      const close = Math.abs(y(c.liq) - yS) < 28;
      els.push(level('liq', c.liq, y(c.liq), AMBER, liqBeforeStop ? 'LIQ — HIT FIRST ⚠' : 'LIQ ≈', '2 4', false, close));
    } else if (liqOk) {
      const yLiq = liqBelow ? padTop + mainH + strip * 0.55 : padTop - strip * 0.55;
      const sepY = liqBelow ? padTop + mainH + 13 : padTop - 13;
      els.push(<line key="liqsep" x1={axisX} y1={sepY} x2={lineEnd} y2={sepY} stroke="#e7e5de" strokeWidth={1} strokeDasharray="2 5" />);
      els.push(level('liq', c.liq, yLiq, AMBER, compact ? (liqBelow ? 'LIQ · below' : 'LIQ · above') : liqBelow ? 'LIQ ≈ · far below' : 'LIQ ≈ · far above', '2 4', false, false));
    }
  }

  // ideal-entry path
  const yT1 = c.rrList.length ? tgtYs[0] : yE - Math.abs(yS - yE) * 1.1;
  const x0p = axisX + 4, xEp = lineEnd - 6, Wd = xEp - x0p;
  const dStop = yS - yE, dTgt = yT1 - yE;
  const px = (f: number) => x0p + f * Wd;
  let pp: string, dotX: number, dotY: number, dotLabel: string, swX = 0, swY = 0, hasSweepLabel = false;
  if (c.isLong) {
    const ySw = yE + 0.82 * dStop;
    swX = px(0.30); swY = yE + 0.46 * dStop; hasSweepLabel = true;
    dotX = px(0.52); dotY = yE; dotLabel = 'RETEST · HOLD';
    pp = `M${px(0)},${yE} C${px(0.10)},${yE + 0.18 * dTgt} ${px(0.20)},${ySw} ${px(0.30)},${ySw} C${px(0.38)},${ySw} ${px(0.46)},${yE} ${px(0.52)},${yE} C${px(0.64)},${yE} ${px(0.74)},${yT1} ${px(1)},${yT1}`;
  } else {
    const ySw = yE + 0.85 * dStop, yDip = yE + 0.34 * dTgt;
    dotX = px(0.50); dotY = ySw; dotLabel = 'REJECTED';
    pp = `M${px(0)},${yE} C${px(0.08)},${yE + 0.14 * dTgt} ${px(0.15)},${yDip} ${px(0.23)},${yDip} C${px(0.33)},${yDip} ${px(0.42)},${ySw} ${px(0.50)},${ySw} C${px(0.60)},${ySw} ${px(0.74)},${yT1} ${px(1)},${yT1}`;
  }
  els.push(<path key="ppath" d={pp} fill="none" stroke={PURP} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />);
  if (hasSweepLabel) els.push(<text key="ppsw" x={swX} y={swY} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={8.5} letterSpacing="0.07em" fill="#bcaaf0">SWEEP</text>);
  els.push(<circle key="ppdot" cx={dotX} cy={dotY} r={4} fill="#fff" stroke={PURP} strokeWidth={2} />);
  els.push(<text key="pprt" x={dotX} y={dotY + (c.isLong ? -11 : 17)} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={8.5} letterSpacing="0.07em" fill={PURP}>{dotLabel}</text>);
  const aAng = Math.atan2(yT1 - dotY, px(1) - dotX), ah = 5.5;
  els.push(<polygon key="pparr" points={`${px(1)},${yT1} ${px(1) - ah * Math.cos(aAng - 0.5)},${yT1 - ah * Math.sin(aAng - 0.5)} ${px(1) - ah * Math.cos(aAng + 0.5)},${yT1 - ah * Math.sin(aAng + 0.5)}`} fill={PURP} opacity={0.9} />);

  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>{els}</svg>;
}
