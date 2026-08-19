'use client';

import { useState, useEffect } from 'react';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpCompute, planToDraft, tpPlanName, TP_EQUITY, tpEntryRungs, pctNum, tpNum, type Plan, type Status, type PlanDraft, type Level } from '@/lib/plan-model';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { CoinIcon } from './coins';
import { CalIcon } from './MiniCalendar';
import { PlanInlineDate, planWindowLabel } from './PlanInlineDate';
import { EquityStrip, DirLevHeading } from './Editor';
import { useLevelsProgress, levelsProgress } from '@/lib/levels-progress';

const MONO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
const mny = (v: number) => (v < 0 ? '−' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const STATUSES: { k: Status; label: string; c: string; bg: string }[] = [
  { k: 'idea', label: 'Idea', c: '#6a45d8', bg: '#f3f0ff' },
  { k: 'armed', label: 'Armed', c: '#1f8a52', bg: '#eef8f1' },
  { k: 'triggered', label: 'Triggered', c: '#c9821f', bg: '#fbf2e3' },
];
const CONVS = [{ k: 'low', label: 'Low', n: 1 }, { k: 'med', label: 'Medium', n: 2 }, { k: 'high', label: 'High', n: 3 }] as const;
const hexRgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

// downscale a chart screenshot to a data URL, then persist it onto the plan.
function readChart(file: File | undefined | null, id: string) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result || '');
    if (src.length < 1_400_000) { planActions.updateThesis(id, 'chart', src); return; }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1920 / img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
      planActions.updateThesis(id, 'chart', cv.toDataURL('image/jpeg', 0.95));
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

function ConvDots({ n, sz = 6 }: { n: number; sz?: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: sz, height: sz, borderRadius: '50%', background: i < n ? '#7c5cff' : 'transparent', border: i < n ? 'none' : '1.5px solid #d3cfe6', boxSizing: 'border-box' }} />)}</span>;
}

// purple-band card header (label + icon), shared by Thesis / Your chart
function CardHead({ label, icon, chevron, open, onClick }: { label: string; icon: React.ReactNode; chevron?: boolean; open?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: chevron && !open ? 'none' : '1px solid #ebe2fb', background: 'linear-gradient(180deg,#ffffff 0%,#faf8ff 45%,#f0eafc 100%)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: '#7c5cff', flex: '0 0 auto' }} />
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>{icon}</svg>
      <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#7c5cff' }}>{label}</span>
      {chevron ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#b0a8c8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flex: '0 0 auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="m6 9 6 6 6-6" /></svg> : null}
    </div>
  );
}
const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #e9e6e0', borderRadius: 20, overflow: 'hidden' };
const bulbIcon = <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></>;
const imgIcon = <><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.6} /><path d="m21 15-5-5L5 21" /></>;

// ── Thesis card — collapsible, four inline-editable rows ──
const THESIS: { field: 'rationale' | 'trigger' | 'invalidation' | 'targetNote'; lab: string; dot: string }[] = [
  { field: 'rationale', lab: 'Rationale', dot: '#7c5cff' },
  { field: 'trigger', lab: 'Trigger', dot: '#1f9d55' },
  { field: 'invalidation', lab: 'Invalidation', dot: '#df5338' },
  { field: 'targetNote', lab: 'Target / exit', dot: '#c9821f' },
];
function ThesisCard({ p }: { p: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={cardBox}>
      <CardHead label="Thesis" icon={bulbIcon} chevron open={open} onClick={() => setOpen((v) => !v)} />
      {open ? (
        <div>
          {THESIS.map((t, i) => (
            <div key={t.field} className="pd-thesis-row" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', borderBottom: i < 3 ? '1px solid #f3f2ef' : 'none', ['--tint' as string]: hexRgba(t.dot, 0.05) } as React.CSSProperties}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: hexRgba(t.dot, 0.92) }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot, flex: '0 0 auto' }} />{t.lab}
              </span>
              <textarea key={p.id + '_' + t.field} defaultValue={(p[t.field] as string) || ''} placeholder={'Add ' + t.lab.toLowerCase() + '…'} rows={1}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== ((p[t.field] as string) || '')) planActions.updateThesis(p.id, t.field, v); }}
                style={{ display: 'block', width: '100%', maxWidth: '100%', margin: 0, padding: 0, boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 500, fontSize: 13, lineHeight: 1.55, color: '#3a382f', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word', overflowX: 'hidden', fieldSizing: 'content' } as React.CSSProperties} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Your chart card — screenshot with tools, or a dashed drop zone ──
function ChartCard({ p, onFull }: { p: Plan; onFull: (src: string) => void }) {
  const [drag, setDrag] = useState(false);
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); readChart(e.dataTransfer.files?.[0], p.id); setDrag(false); };
  const onOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (!drag) setDrag(true); };
  const onLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (drag) setDrag(false); };
  const tool: React.CSSProperties = { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 99 };
  return (
    <div style={cardBox}>
      <CardHead label="Your chart" icon={imgIcon} />
      {p.chart ? (
        <div onDrop={onDrop} onDragOver={onOver} onDragLeave={onLeave} style={{ position: 'relative', padding: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img onClick={() => onFull(p.chart!)} src={p.chart} alt="chart" style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 11, border: '1px solid #ececea', cursor: 'zoom-in' }} />
          <div style={{ position: 'absolute', top: 23, right: 23, display: 'flex', gap: 8 }}>
            <label title="Replace" className="pd-chartbtn" style={tool}><input type="file" accept="image/*" style={{ display: 'none' }} onClick={(e) => e.stopPropagation()} onChange={(e) => { readChart(e.target.files?.[0], p.id); e.currentTarget.value = ''; }} /><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1={12} y1={3} x2={12} y2={15} /></svg></label>
            <button title="Remove" className="pd-chartbtn pd-chartbtn-del" onClick={(e) => { e.stopPropagation(); planActions.updateThesis(p.id, 'chart', ''); }} style={tool}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg></button>
          </div>
          {drag ? <div style={{ position: 'absolute', inset: 14, borderRadius: 11, border: '2px dashed #7c5cff', background: 'rgba(124,92,255,0.12)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#6a45d8', pointerEvents: 'none' }}>Drop to replace</div> : null}
        </div>
      ) : (
        <label onDrop={onDrop} onDragOver={onOver} onDragLeave={onLeave} style={{ margin: 14, cursor: 'pointer', border: '1.5px dashed ' + (drag ? '#7c5cff' : '#ded9cf'), borderRadius: 13, padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textAlign: 'center', background: drag ? 'rgba(124,92,255,0.07)' : '#fbfaf8', transition: 'border-color .14s, background .14s' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { readChart(e.target.files?.[0], p.id); e.currentTarget.value = ''; }} />
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f3f0ff', display: 'grid', placeItems: 'center' }}><svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1={12} y1={3} x2={12} y2={15} /></svg></div>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{drag ? 'Drop your screenshot' : 'Drop a chart screenshot'}</span>
          <span style={{ fontWeight: 600, fontSize: 11.5, color: '#a8a294', maxWidth: 260, lineHeight: 1.5 }}>Drag an image here, or click to browse — so you can eyeball the levels.</span>
          <span style={{ fontWeight: 800, fontSize: 11.5, color: '#7c5cff', marginTop: 2 }}>Browse files</span>
        </label>
      )}
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
  const shell = (body: React.ReactNode) => (
    <div style={cardBox}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 20px', background: 'linear-gradient(180deg,#ffffff 0%,#f6fbf8 45%,#e9f6ee 100%)', borderBottom: '1px solid #d3ecdd' }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: GREEN, flex: '0 0 auto' }} />
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d="M3 3v18h18" /><path d="m7 14 4-4 3 3 5-6" /></svg>
        <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.15em', textTransform: 'uppercase', color: GREEN }}>Levels map</span>
      </div>
      {body}
    </div>
  );

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
  const grpMeta = { targets: { t: 'Targets', sub: 'bank & trail out', c: GREEN }, entry: { t: 'Entry', sub: 'limit-ladder in', c: PURPD }, risk: { t: 'Risk', sub: 'stop & liquidation', c: RED } };
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

const KF = `@keyframes pdIn{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes pdFade{from{opacity:0}to{opacity:1}}@keyframes lmpop{0%{transform:scale(1)}45%{transform:scale(1.42)}100%{transform:scale(1)}}@keyframes lmglow{0%{box-shadow:0 0 0 0 rgba(31,157,85,.5)}100%{box-shadow:0 0 0 13px rgba(31,157,85,0)}}.lmdot{cursor:pointer;transition:transform .15s ease}.lmdot:hover{transform:scale(1.13)}.lmnode{cursor:pointer;border-radius:11px;transition:background .14s}.lmnode:hover{background:#faf8f4}.lmpop{animation:lmpop .5s cubic-bezier(.34,1.56,.64,1)}.lmring{animation:lmglow .7s ease-out}.lmghost2:hover{background:#f1efe9 !important;color:#6a6357 !important}.pd-thesis-row{transition:background .12s}.pd-thesis-row:focus-within{background:var(--tint)}.pd-thesis-row textarea::placeholder{color:#c5c3b9;font-style:italic}.pd-icobtn:hover{background:#1a1813 !important;border-color:#1a1813 !important;color:#fff !important}.pd-icobtn-del:hover{background:#df5338 !important;border-color:#df5338 !important;color:#fff !important}.pd-resize::before{content:"";position:absolute;left:0;top:0;height:100%;width:3px;background:transparent;transition:background .15s}.pd-resize:hover::before{background:#7c5cff}.pd-resize::after{content:"";position:absolute;left:3px;top:50%;transform:translateY(-50%);width:4px;height:34px;border-radius:3px;background:#d8d4ea;opacity:0;transition:opacity .15s}.pd-resize:hover::after{opacity:1}.pd-chartbtn{background:rgba(255,255,255,0.82) !important;color:#26221c !important;border:1px solid rgba(255,255,255,0.9) !important;box-shadow:0 2px 10px -2px rgba(20,18,12,0.28),0 0 0 0.5px rgba(20,18,12,0.04);backdrop-filter:blur(10px) saturate(1.3);transition:background .14s,transform .1s}.pd-chartbtn:hover{background:#fff !important;transform:translateY(-1px)}.pd-chartbtn-del{color:#c23d28 !important}.pd-chartbtn-del:hover{background:#fdece8 !important;color:#b8341f !important}`;

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
  const [full, setFull] = useState<string | null>(null);
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
          <EquityStrip c={c} d={d} />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,65fr) minmax(0,35fr)', gap: 20, alignItems: 'start' }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><ThesisCard p={p} /><ChartCard p={p} onFull={setFull} /></div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}><LevelsMap p={p} c={c} d={d} /></div>
          </div>
        </div>
      </div>

      {full ? <div onClick={() => setFull(null)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(14,13,11,0.88)', display: 'grid', placeItems: 'center', padding: 40, cursor: 'zoom-out' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={full} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} /></div> : null}
    </>
  );
}
