'use client';

import { type Plan, tpCompute, planToDraft } from '@/lib/plan-model';

// Stats band at the top of the Plans board (handoff-24). Aggregates the plans
// into direction / plans-stage donuts, a conviction split bar, avg risk / reward
// / R:R, and leverage + margin histograms. Pure render of `plans`; null if none.

const FONT = "'Plus Jakarta Sans', sans-serif";
const C = { ink: '#1a1813', faint: '#b3b0a6', line: '#eeede9', purp: '#7c5cff', lilac: '#b9a6ff', pale: '#e3dcf7', green: '#1f9d55', red: '#df5338' };
const IDEA = '#ffa31a';

type Seg = { n: number; col: string };
type Bar = { n: number; label: string; col: string };

const Eb = ({ t }: { t: string }) => <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.faint }}>{t}</span>;

function Donut({ segs, S }: { segs: Seg[]; S: number }) {
  const total = segs.reduce((s, x) => s + x.n, 0) || 1;
  let acc = 0; const stops: string[] = [];
  segs.forEach((s) => { if (!s.n) return; const a0 = (acc / total) * 360; acc += s.n; const a1 = (acc / total) * 360; stops.push(`${s.col} ${a0}deg ${a1}deg`); });
  return (
    <div style={{ position: 'relative', width: S, height: S, flex: '0 0 auto', borderRadius: '50%', background: `conic-gradient(${stops.join(',')})` }}>
      <div style={{ position: 'absolute', inset: S * 0.13, background: '#fff', borderRadius: '50%' }} />
    </div>
  );
}

const VLegend = ({ items }: { items: { col: string; n: number; label: string }[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    {items.map((it, i) => (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5, color: '#7a766c', whiteSpace: 'nowrap' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: it.col }} /><b style={{ color: C.ink, fontWeight: 800 }}>{it.n}</b>&nbsp;{it.label}
      </span>
    ))}
  </div>
);
const Legend = ({ items }: { items: { col: string; n: number; label: string }[] }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 11px' }}>
    {items.map((it, i) => (
      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 10.5, color: '#7a766c', whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: it.col }} /><b style={{ color: C.ink, fontWeight: 800 }}>{it.n}</b>&nbsp;{it.label}
      </span>
    ))}
  </div>
);
const SplitBar = ({ segs }: { segs: Seg[] }) => (
  <div style={{ display: 'flex', height: 11, borderRadius: 6, overflow: 'hidden', background: '#f0efeb' }}>
    {segs.map((s, i) => (s.n ? <div key={i} style={{ flex: s.n, background: s.col, minWidth: 4 }} /> : null))}
  </div>
);
function Hist({ bars, H }: { bars: Bar[]; H: number }) {
  const max = Math.max(...bars.map((b) => b.n)) || 1;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 13, height: H }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: '100%' }}>
            <span style={{ fontWeight: 800, fontSize: 10.5, color: b.n ? '#8a8578' : '#cfccc3', lineHeight: 1 }}>{b.n}</span>
            <div style={{ width: '100%', maxWidth: 28, height: Math.max(5, (b.n / max) * (H - 16)), borderRadius: '4px 4px 2px 2px', background: b.col, opacity: b.n ? 1 : 0.3 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 13, marginTop: 6 }}>
        {bars.map((b, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 9.5, color: '#a8a69b' }}>{b.label}</span>)}
      </div>
    </div>
  );
}
const CircleCell = ({ lab, segs, leg }: { lab: string; segs: Seg[]; leg: { col: string; n: number; label: string }[] }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
    <Eb t={lab} /><div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><Donut segs={segs} S={82} /><VLegend items={leg} /></div>
  </div>
);
const ACell = ({ lab, valTxt, frac, col }: { lab: string; valTxt: string; frac: number; col: string }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <Eb t={lab} />
    <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', color: col, lineHeight: 0.9 }}>{valTxt}</span>
    <div style={{ height: 8, borderRadius: 5, background: '#f0efeb', overflow: 'hidden' }}><div style={{ width: Math.min(100, (frac || 0) * 100) + '%', height: '100%', background: col, borderRadius: 5 }} /></div>
  </div>
);
const VDiv = () => <div style={{ width: 1, alignSelf: 'stretch', background: C.line }} />;

// Threshold coloring (risk ramp): ≤5× safe green → amber → red → dark red.
const levCol = (l: number) => (l <= 5 ? '#1f9d55' : l <= 7 ? IDEA : l < 10 ? '#df5338' : '#b5341f');
// Conviction ramp: High green · Med amber (caution) · Low grey.
const convHi = '#1f9d55', convMe = IDEA, convLo = '#c2bfb4';
const fmtPct = (v: number) => (isFinite(v) ? v.toFixed(2) + '%' : '—');

export function StatsBar({ plans }: { plans: Plan[] }) {
  if (!plans.length) return null;

  const dir = { long: 0, short: 0 }, conv = { high: 0, med: 0, low: 0 }, stage = { idea: 0, armed: 0, triggered: 0 };
  const levMap: Record<number, number> = {};
  let riskSum = 0, riskN = 0, rewSum = 0, rewN = 0, rrSum = 0, rrN = 0;
  const marginVals: number[] = [];
  plans.forEach((p) => {
    if (dir[p.dir] !== undefined) dir[p.dir]++;
    if (stage[p.status] !== undefined) stage[p.status]++;
    const cv = p.conv || 'med'; if (conv[cv] !== undefined) conv[cv]++;
    const L = parseInt(String(p.lev), 10); if (L) levMap[L] = (levMap[L] || 0) + 1;
    const rr = parseFloat(String(p.rr)); const risk = parseFloat(String(p.riskPctLabel || '').replace('%', ''));
    if (isFinite(risk)) { riskSum += risk; riskN++; if (isFinite(rr)) { rewSum += risk * rr; rewN++; } }
    if (isFinite(rr)) { rrSum += rr; rrN++; }
    try { const c = tpCompute(planToDraft(p)); if (c && isFinite(c.marginPct)) marginVals.push(c.marginPct); } catch { /* skip */ }
  });
  const levBuckets = Object.keys(levMap).map(Number).sort((a, b) => a - b).map((l) => ({ lev: l, n: levMap[l] }));

  // Margin bucketed into the SAME fixed threshold bands as the color ramp, so
  // each color is its own bar: ≤50 green · 50–65 amber · 65–80 red · >80 dark.
  const marBars = [
    { label: '≤50%', col: '#1f9d55', lo: -Infinity, hi: 50, n: 0 },
    { label: '50–65%', col: IDEA, lo: 50, hi: 65, n: 0 },
    { label: '65–80%', col: '#df5338', lo: 65, hi: 80, n: 0 },
    { label: '>80%', col: '#b5341f', lo: 80, hi: Infinity, n: 0 },
  ];
  marginVals.forEach((v) => { const bk = marBars.find((b) => v > b.lo && v <= b.hi); if (bk) bk.n++; });
  const avgRisk = riskN ? riskSum / riskN : NaN, avgReward = rewN ? rewSum / rewN : NaN, avgRR = rrN ? rrSum / rrN : NaN;
  const MAXR = 2.0, MAXW = 5.0;

  return (
    <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: 20, boxShadow: '0 1px 3px rgba(20,20,12,0.05)', padding: '24px 28px', display: 'flex', alignItems: 'stretch', gap: 28 }}>
      <div style={{ flex: '3.2 1 0', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.74fr', columnGap: 26, rowGap: 26, alignContent: 'space-between' }}>
        <CircleCell lab="Direction" segs={[{ n: dir.long, col: C.green }, { n: dir.short, col: C.red }]} leg={[{ col: C.green, n: dir.long, label: 'Long' }, { col: C.red, n: dir.short, label: 'Short' }]} />
        <CircleCell lab="Plans" segs={[{ n: stage.idea, col: IDEA }, { n: stage.armed, col: C.purp }, { n: stage.triggered, col: C.green }]} leg={[{ col: IDEA, n: stage.idea, label: 'Idea' }, { col: C.purp, n: stage.armed, label: 'Armed' }, { col: C.green, n: stage.triggered, label: 'Live' }]} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Eb t="Conviction" />
          <SplitBar segs={[{ n: conv.high, col: convHi }, { n: conv.med, col: convMe }, { n: conv.low, col: convLo }]} />
          <Legend items={[{ col: convHi, n: conv.high, label: 'High' }, { col: convMe, n: conv.med, label: 'Med' }, { col: convLo, n: conv.low, label: 'Low' }]} />
        </div>
        <ACell lab="Avg risk" valTxt={fmtPct(avgRisk)} frac={avgRisk / MAXR} col={C.red} />
        <ACell lab="Avg reward" valTxt={fmtPct(avgReward)} frac={avgReward / MAXW} col={C.green} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Eb t="Avg R:R" />
          <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em', lineHeight: 0.9 }}>
            <span style={{ color: C.red }}>1</span><span style={{ color: '#c9c6bd' }}> : </span><span style={{ color: C.green }}>{isFinite(avgRR) ? avgRR.toFixed(1) : '—'}</span>
          </span>
          <div style={{ display: 'flex', height: 8, gap: 3 }}>
            <div style={{ flex: 1, background: C.red, borderRadius: 4 }} /><div style={{ flex: isFinite(avgRR) ? avgRR : 1, background: C.green, borderRadius: 4 }} />
          </div>
        </div>
      </div>
      <VDiv />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Eb t="Leverage" />
        <Hist bars={levBuckets.length ? levBuckets.map((b) => ({ n: b.n, label: b.lev + '×', col: levCol(b.lev) })) : [{ n: 0, label: '—', col: C.purp }]} H={152} />
      </div>
      <VDiv />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Eb t="Margin" />
        <Hist bars={marBars.map((b) => ({ n: b.n, label: b.label, col: b.col }))} H={152} />
      </div>
    </div>
  );
}
