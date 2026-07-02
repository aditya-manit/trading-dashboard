'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  type PlanDraft, type SizeMode, type Sym, type Dir, type Conv,
  tpCompute, tpFmtNum, tpNum, tpMoney, tpAutoName, TP_MARKETS, TP_EQUITY, type Plan, type Status,
  composeNote, isoToDate,
} from '@/lib/plan-model';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { HeatmapLaunchCard } from '@/components/heatmap/HeatmapLaunchCard';
import type { HeatSymbol } from '@/hooks/useHeatmap';
import { MiniCalendar, CalIcon } from './MiniCalendar';
import { CoinIcon } from './coins';

const PURP = '#7c5cff';
const SIZE_MODES: { v: SizeMode; label: string; unit: string; hint: string }[] = [
  { v: 'qty', label: 'Contracts', unit: 'contracts', hint: 'units of the asset' },
  { v: 'margin', label: 'Margin USD', unit: 'USD margin', hint: 'margin you post' },
  { v: 'marginpct', label: '% balance', unit: '% of balance', hint: '% of equity as margin' },
  { v: 'riskusd', label: 'Risk, USD', unit: 'USD risk', hint: 'USD lost if stopped' },
  { v: 'riskpct', label: 'Risk, %', unit: '% risk', hint: '% of equity risked' },
];

const card: CSSProperties = { background: '#fff', border: '1px solid #efedf3', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden' };

// ── collapsible-section scaffolding (Theory: thesis/chart · Setup: identity/levels/sizing/leverage) ──
type SecKey = 'thesis' | 'chart' | 'identity' | 'levels' | 'sizing' | 'leverage';
const SEC_DEFAULT: Record<SecKey, boolean> = { thesis: false, chart: false, identity: false, levels: true, sizing: false, leverage: false };
// chevron that rotates when open (dc.html `tpchev`)
const Chev = ({ open, color = '#b3b0a6' }: { open: boolean; color?: string }) => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease', flex: '0 0 auto' }}><path d="m6 9 6 6 6-6" /></svg>
);
// clickable section header: title + (optional) right slot (collapsed summary / control) + chevron
function SecHead({ title, open, onToggle, right, collapsedRight }: { title: string; open: boolean; onToggle: () => void; right?: React.ReactNode; collapsedRight?: React.ReactNode }) {
  return (
    <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 18px', cursor: 'pointer' }}>
      <span style={{ fontWeight: 800, fontSize: 13.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{title}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 9 }} onClick={(e) => e.stopPropagation()}>
        {open ? right : (collapsedRight ? <span style={{ fontWeight: 700, fontSize: 12, color: '#897f70' }}>{collapsedRight}</span> : null)}
        <span onClick={onToggle} style={{ display: 'inline-flex' }}><Chev open={open} /></span>
      </span>
    </div>
  );
}
// gradient group header (Theory purple / Setup green) with expand-all toggle
function GroupHead({ label, color, gradient, border, allOpen, onToggleAll }: { label: string; color: string; gradient: string; border: string; allOpen: boolean; onToggleAll: () => void }) {
  return (
    <div onClick={onToggleAll} title={allOpen ? 'Collapse all' : 'Expand all'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 18px', background: gradient, borderBottom: `1px solid ${border}`, borderRadius: '20px 20px 0 0', cursor: 'pointer' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: color }} /><span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.15em', textTransform: 'uppercase', color }}>{label}</span></span>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ transform: allOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }}><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );
}
// the group wrapper: rounded white sheet with a soft colour glow behind it
function GroupSheet({ glow, children }: { glow: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)', width: '82%', height: 170, borderRadius: '50%', background: glow, filter: 'blur(56px)', opacity: glow === '#7c5cff' ? 0.06 : 0.05, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, background: '#fff', border: '1px solid #efedf3', borderRadius: 20, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ── Identity (instrument / direction / conviction spec-tables) ──────────────
function IdentitySection({ d, btcMark }: { d: PlanDraft; btcMark?: number }) {
  const brand: Record<Sym, string> = { BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff' };
  const tint: Record<Sym, string> = { BTC: 'rgba(247,147,26,0.10)', ETH: 'rgba(98,126,234,0.10)', SOL: 'rgba(153,69,255,0.10)' };
  const gs = (a: boolean): CSSProperties => ({ filter: a ? 'none' : 'grayscale(1)', opacity: a ? 1 : 0.5, flex: '0 0 auto' });
  const lab = (a: boolean, t: string, col?: string) => <span style={{ fontWeight: 800, fontSize: 14, color: a ? col || '#1a1813' : '#b3b0a6' }}>{t}</span>;
  const sub = (a: boolean, t: string, col?: string) => <span style={{ fontWeight: a ? 600 : 600, fontSize: 10, color: a ? col || '#897f70' : '#cfcdc4' }}>{t}</span>;
  const cellBase: CSSProperties = { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' };
  const logo = (sym: Sym, a: boolean) => {
    const st = gs(a);
    if (sym === 'ETH') return <svg width={26} height={26} style={st} viewBox="0 0 32 32"><circle cx={16} cy={16} r={16} fill="#627eea" /><path d="M16 5.5 9 16.2 16 20.3 23 16.2z" fill="#fff" /><path d="M16 21.6 9 17.5 16 26.5 23 17.5z" fill="#fff" fillOpacity={0.8} /></svg>;
    if (sym === 'SOL') return <svg width={26} height={26} style={st} viewBox="0 0 32 32"><defs><linearGradient id="tpsolg" x1={4} y1={24} x2={28} y2={8} gradientUnits="userSpaceOnUse"><stop offset={0} stopColor="#9945ff" /><stop offset={1} stopColor="#14f195" /></linearGradient></defs><circle cx={16} cy={16} r={16} fill="#1a1813" /><g fill="url(#tpsolg)"><path d="M10.4 19.6c.1-.1.3-.2.5-.2h12.2c.3 0 .5.4.3.6l-2.4 2.4c-.1.1-.3.2-.5.2H8.3c-.3 0-.5-.4-.3-.6z" /><path d="M10.4 9.4c.1-.1.3-.2.5-.2h12.2c.3 0 .5.4.3.6l-2.4 2.4c-.1.1-.3.2-.5.2H8.3c-.3 0-.5-.4-.3-.6z" /><path d="M21.6 14.5c-.1-.1-.3-.2-.5-.2H8.9c-.3 0-.5.4-.3.6l2.4 2.4c.1.1.3.2.5.2h12.2c.3 0 .5-.4.3-.6z" /></g></svg>;
    return <svg width={26} height={26} style={st} viewBox="0 0 32 32"><circle cx={16} cy={16} r={16} fill="#f7931a" /><path d="M21.6 14.1c.2-1.6-1-2.5-2.7-3.1l.6-2.2-1.4-.3-.5 2.1c-.4-.1-.8-.2-1.1-.3l.5-2.1-1.3-.3-.6 2.2c-.3-.1-.6-.1-.9-.2l-1.8-.5-.4 1.4s1 .2 1 .3c.5.1.6.5.6.7l-.6 2.5.1 0-.1 0-.9 3.6c-.1.2-.2.4-.6.3 0 0-1-.2-1-.2l-.7 1.6 1.7.4c.3.1.6.2 1 .3l-.6 2.2 1.3.3.6-2.2c.4.1.7.2 1.1.3l-.5 2.2 1.4.3.6-2.2c2.3.4 4 .3 4.8-1.8.6-1.7 0-2.6-1.2-3.2.9-.2 1.6-.8 1.8-2zm-3.2 4.3c-.4 1.7-3.3.8-4.2.6l.7-2.9c.9.2 3.9.7 3.5 2.3zm.5-4.3c-.4 1.6-2.8.8-3.6.6l.7-2.7c.8.2 3.3.6 2.9 2.1z" fill="#fff" /></svg>;
  };
  const arrow = (up: boolean, a: boolean) => (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a ? (up ? '#1f9d55' : '#df5338') : '#c2c0b6'} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>
      {up ? <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></> : <><path d="M17 7 7 17" /><path d="M17 17H7V7" /></>}
    </svg>
  );
  const dots = (a: boolean, lit: number) => (
    <span style={{ display: 'inline-flex', gap: 3, flex: '0 0 auto' }}>
      {[1, 2, 3].map((n) => <span key={n} style={n <= lit ? { width: 7, height: 7, borderRadius: '50%', background: a ? PURP : '#c2c0b6' } : { width: 7, height: 7, borderRadius: '50%', border: '1.5px solid ' + (a ? '#d2c6fb' : '#e2e0d9'), boxSizing: 'border-box' }} />)}
    </span>
  );
  const syms: Sym[] = ['BTC', 'ETH', 'SOL'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #f1f0ed' }}>
        {syms.map((k, i) => { const a = d.sym === k, base = TP_MARKETS[k]; const mark = k === 'BTC' && btcMark ? btcMark : base.mark;
          return (
            <div key={k} onClick={() => planActions.setDraft({ sym: k })} style={{ ...cellBase, borderRight: i < 2 ? '1px solid #f1f0ed' : 'none', background: a ? tint[k] : 'transparent' }}>
              {logo(k, a)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{lab(a, k)}{a ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: brand[k] }} /> : null}</span>
                {sub(a, '$' + mark.toLocaleString('en-US', { maximumFractionDigits: mark < 1000 ? 2 : 0 }))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #f1f0ed' }}>
        {([['long', 'Long', 'price rises', '#1f9d55', '#f1faf4', '#9ec7ad'], ['short', 'Short', 'price falls', '#df5338', '#fdf3f0', '#e0a99c']] as const).map((o, i) => { const a = d.dir === o[0];
          return (
            <div key={o[0]} onClick={() => planActions.setDraft({ dir: o[0] as Dir })} style={{ ...cellBase, borderRight: i === 0 ? '1px solid #f1f0ed' : 'none', background: a ? o[4] : 'transparent' }}>
              {arrow(o[0] === 'long', a)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{lab(a, o[1], o[3])}{sub(a, o[2], o[5])}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
        {([['low', 1, 'Low', 'a punt'], ['med', 2, 'Medium', 'solid setup'], ['high', 3, 'High', 'best idea']] as const).map((o, i) => { const a = d.conv === o[0];
          return (
            <div key={o[0]} onClick={() => planActions.setDraft({ conv: o[0] as Conv })} style={{ ...cellBase, borderRight: i < 2 ? '1px solid #f1f0ed' : 'none', background: a ? '#faf8ff' : 'transparent' }}>
              {dots(a, o[1] as number)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{lab(a, o[2], PURP)}{sub(a, o[3], '#b9a8f0')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── price input ─────────────────────────────────────────────────────────────
function PriceInput({ value, onChange, placeholder, accent = '#7c5cff', tint = '#ededea', bg = '#fff' }: { value: string; onChange: (v: string) => void; placeholder: string; accent?: string; tint?: string; bg?: string }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: 15, color: '#cbc9c0' }}>$</span>
      <input value={tpFmtNum(value)} onChange={(e) => onChange(e.target.value.replace(/,/g, ''))} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} inputMode="decimal" placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 28px', border: `1.5px solid ${foc ? accent : tint}`, borderRadius: 11, fontFamily: 'inherit', fontWeight: 700, fontSize: 16, color: '#1a1813', background: bg, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
    </div>
  );
}

type ThesisFieldDef = { k: keyof PlanDraft; n: string; dot: string; nc: string; lab: string; cap: string; ph: string; tint: string };
const THESIS_FIELDS: ThesisFieldDef[] = [
  { k: 'rationale', n: '01', dot: '#7c5cff', nc: '#a99cf2', lab: 'Rationale', cap: 'why the trade exists', ph: 'Reclaim of the range low, momentum turning up.', tint: '#f5f2ff' },
  { k: 'trigger', n: '02', dot: '#1f9d55', nc: '#92caa7', lab: 'Trigger', cap: 'the exact entry condition', ph: '15m close back above 64,000 and holds.', tint: '#eef8f1' },
  { k: 'invalidation', n: '03', dot: '#df5338', nc: '#eaa493', lab: 'Invalidation', cap: 'what proves it wrong', ph: 'Loses 61,900 on the 1h — idea is dead.', tint: '#fdf3f0' },
  { k: 'targetNote', n: '04', dot: '#c9821f', nc: '#e2bd86', lab: 'Target / exit', cap: 'how you take profit', ph: 'Scale out into 70k, trail the rest.', tint: '#fbf5ea' },
];
function ThesisField({ f, i, d }: { f: ThesisFieldDef; i: number; d: PlanDraft }) {
  const [foc, setFoc] = useState(false);
  // Tab on an empty field accepts the placeholder suggestion.
  const onTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value && e.currentTarget.placeholder) {
      e.preventDefault();
      planActions.setDraft({ [f.k]: e.currentTarget.placeholder } as Partial<PlanDraft>);
    }
  };
  return (
    <div style={{ padding: '13px 18px', borderBottom: i < 3 ? '1px solid #f3f1f7' : 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1a1813' }}>
          <span style={{ fontWeight: 800, fontSize: 9, color: f.nc, fontVariantNumeric: 'tabular-nums' }}>{f.n}</span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: f.dot }} />{f.lab}
        </span>
        <span style={{ fontWeight: 500, fontSize: 10.5, color: '#bdbbb1', letterSpacing: '0.01em' }}>{f.cap}</span>
      </div>
      {f.k === 'targetNote' ? <TargetRule d={d} /> : (
        <textarea value={String(d[f.k] ?? '')} onChange={(e) => planActions.setDraft({ [f.k]: e.target.value } as Partial<PlanDraft>)} onKeyDown={onTab} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} placeholder={f.ph}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 54, resize: 'vertical', padding: '8px 11px', border: 'none', borderRadius: 10, background: foc ? f.tint : 'transparent', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, color: '#26221c', outline: 'none', lineHeight: 1.62, transition: 'background .15s' }} />
      )}
    </div>
  );
}
function Thesis({ d }: { d: PlanDraft }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{THESIS_FIELDS.map((f, i) => <ThesisField key={f.k} f={f} i={i} d={d} />)}</div>;
}

// ── Management rule strip (Target / exit) — tappable colored slots ──────────
const MONO = "'JetBrains Mono', monospace";
function MgmtChip({ val, presets, set, fmt, empty, ph, w, col, bg, bd }: {
  val: string; presets: string[]; set: (v: string) => void; fmt?: (x: string) => string; empty: string; ph: string; w: number; col: string; bg: string; bd: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}>
        <input autoFocus value={val} placeholder={ph} onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }} onBlur={() => setEditing(false)}
          style={{ width: w, border: '1px solid ' + bd, background: '#fff', borderRadius: 7, padding: '3px 8px', fontFamily: MONO, fontWeight: 800, fontSize: 12.5, color: col, outline: 'none' }} />
        {presets.map((p) => (
          <button key={p} onMouseDown={(e) => { e.preventDefault(); set(p); setEditing(false); }}
            style={{ cursor: 'pointer', border: '1px solid ' + bd, background: bg, color: col, borderRadius: 6, padding: '3px 7px', fontFamily: MONO, fontWeight: 800, fontSize: 10.5, lineHeight: 1 }}>{fmt ? fmt(p) : p}</button>
        ))}
      </span>
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      style={{ cursor: 'pointer', verticalAlign: 'middle', display: 'inline-flex', alignItems: 'center', gap: 4, border: (val ? '1px solid ' : '1px dashed ') + bd, background: bg, color: col, borderRadius: 7, padding: '2px 10px', fontFamily: MONO, fontWeight: 800, fontSize: 12.5, lineHeight: 1.45 }}>
      {val ? (fmt ? fmt(val) : val) : empty}
    </button>
  );
}
function TargetRule({ d }: { d: PlanDraft }) {
  const period = d.trailPeriod || '';
  const pct = d.bankPct == null ? '70' : d.bankPct;
  const target = d.bankTarget == null ? '100k' : d.bankTarget;
  const setPeriod = (v: string) => planActions.setDraft({ trailPeriod: v, targetNote: composeNote(pct, v, target) });
  const setPct = (v: string) => { const n = String(v).replace(/[^0-9]/g, ''); planActions.setDraft({ bankPct: n, targetNote: composeNote(n, period, target) }); };
  const setTarget = (v: string) => { const t = String(v).trim(); planActions.setDraft({ bankTarget: t, targetNote: composeNote(pct, period, t) }); };
  return (
    <div style={{ minHeight: 82, boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, background: '#fbf8f3', border: '1px solid #f0e7d9', fontWeight: 600, fontSize: 13, lineHeight: 1.95, color: '#1a1813' }}>
      Trail with <b style={{ color: '#7c5cff', fontFamily: MONO, fontWeight: 800 }}>Donchian(</b>
      <MgmtChip val={period} presets={['15m', '1h', '4h']} set={setPeriod} empty="set period" ph="e.g. 1h" w={58} col="#7c5cff" bg="#f3eefe" bd="#ddd0f7" />
      <b style={{ color: '#7c5cff', fontFamily: MONO, fontWeight: 800 }}>, 3)</b>
      {' on impulse candles (HA). Bank '}
      <MgmtChip val={pct} presets={['50', '70', '100']} set={setPct} fmt={(x) => x + '%'} empty="set %" ph="e.g. 70" w={54} col="#e07b2f" bg="#fdf2e8" bd="#f0d4b6" />
      {' when reward hits '}
      <MgmtChip val={target} presets={['100k', '150k', '200k']} set={setTarget} fmt={(x) => '$' + x} empty="set target" ph="e.g. 100k" w={66} col="#1f9d55" bg="#edf7f0" bd="#bce0cb" />
      {', then trail the rest as before.'}
    </div>
  );
}

// ── Expected-date dropdown (in the name row) ─────────────────────────────────
function ExpectedDate({ d }: { d: PlanDraft }) {
  const [open, setOpen] = useState(false);
  const sel = isoToDate(d.tradeDate);
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = sel ? `${MONS[sel.getMonth()]} ${sel.getDate()}, ${sel.getFullYear()}` : 'dd / mm / yyyy';
  const pick = (iso: string) => { planActions.setDraft({ tradeDate: iso }); setOpen(false); };
  return (
    <div style={{ position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 9, borderLeft: '1px solid #f0efec', paddingLeft: 16 }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: '#f3eefe', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><CalIcon /></span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
        <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89cd6' }}>Expected</span>
        <button onClick={() => setOpen((v) => !v)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, color: sel ? '#1a1813' : '#b0aea3', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {label}
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 9px)', right: 0, zIndex: 71, width: 288, boxSizing: 'border-box', background: '#fff', border: '1px solid #ecebe6', borderRadius: 14, boxShadow: '0 14px 40px -12px rgba(20,20,12,0.28)', padding: 16, animation: 'pkUp .16s ease both' }}>
            <style>{`@keyframes pkUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <MiniCalendar value={d.tradeDate} onPick={pick} onClear={() => pick('')} cellH={32} />
          </div>
        </>
      ) : null}
    </div>
  );
}

// read an image file → (downscaled) data URL on the draft
function readChart(file: File | undefined | null) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = String(reader.result || '');
    if (src.length < 1_400_000) { planActions.setDraft({ chart: src }); return; }
    const img = new Image();
    img.onload = () => {
      const max = 1920, scale = Math.min(1, max / img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
      planActions.setDraft({ chart: cv.toDataURL('image/jpeg', 0.95) });
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}

function ChartUpload({ d, onFull }: { d: PlanDraft; onFull: (src: string) => void }) {
  const [drag, setDrag] = useState(false);
  if (d.chart) {
    return (
      <div style={{ padding: 14, height: '100%', boxSizing: 'border-box' }}>
        <div onClick={() => onFull(d.chart)} style={{ position: 'relative', cursor: 'zoom-in', borderRadius: 12, overflow: 'hidden', border: '1px solid #ececea' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.chart} alt="chart" style={{ display: 'block', width: '100%', height: 'auto', background: '#fff' }} />
          <div style={{ position: 'absolute', top: 9, left: 9, right: 9, display: 'flex', gap: 7 }}>
            <label onClick={(e) => e.stopPropagation()} style={tool}>
              Replace<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { readChart(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
            <button onClick={(e) => { e.stopPropagation(); planActions.setDraft({ chart: '' }); }} style={tool}>Remove</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: 14, height: '100%', boxSizing: 'border-box' }}>
      <label onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); readChart(e.dataTransfer.files?.[0]); }}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, height: '100%', minHeight: 150, padding: '24px 18px', borderRadius: 13, border: '1.5px dashed ' + (drag ? '#7c5cff' : '#e0ddd6'), background: drag ? '#f7f4ff' : '#fcfbfa', transition: 'all .14s', textAlign: 'center', boxSizing: 'border-box' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 11, background: drag ? '#ece6ff' : '#f2f0ec' }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={drag ? '#7c5cff' : '#a8a69b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.6} /><path d="m21 15-5-5L5 21" /></svg>
        </span>
        <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1a1813' }}>Drop a chart screenshot</span>
        <span style={{ fontWeight: 600, fontSize: 10.5, color: '#a8a69b', lineHeight: 1.45 }}>or click to upload · the setup you saw</span>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { readChart(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </label>
    </div>
  );
}
const tool: CSSProperties = { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit', fontWeight: 800, fontSize: 10.5, padding: '6px 9px', borderRadius: 8, border: 'none', background: 'rgba(20,18,12,0.6)', color: '#fff', backdropFilter: 'blur(5px)' };

// ── inline TP widgets (TP1 · Bank% · preset menu · TP2 · Donchian-trail period · preset menu), ported from dc.html ──
const MONOF = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
const BANK_PRESETS = ['50', '60', '70', '75', '80', '100'];
const PER_PRESETS = ['12h', '1d', '2d', '3d', '1w'];
function PresetMenu({ title, opts, cur, fmt, onPick, accent, accentBg, onClose }: { title: string; opts: string[]; cur: string; fmt: (v: string) => string; onPick: (v: string) => void; accent: string; accentBg: string; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 7px)', right: 0, zIndex: 61, background: '#fff', border: '1px solid #ece9e3', borderRadius: 11, boxShadow: '0 14px 34px -10px rgba(30,20,10,.26)', padding: 5, minWidth: 138, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#b3aea2', padding: '4px 9px 5px' }}>{title}</div>
        {opts.map((o) => { const active = String(cur) === String(o); return (
          <button key={o} onClick={() => onPick(o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 'none', background: active ? accentBg : 'transparent', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
            <span style={{ fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: active ? accent : '#3a352c' }}>{fmt(o)}</span>
            {active ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg> : null}
          </button>
        ); })}
      </div>
    </>
  );
}
function TargetInputs({ d }: { d: PlanDraft }) {
  const [bankMenu, setBankMenu] = useState(false);
  const [perMenu, setPerMenu] = useState(false);
  const period = d.trailPeriod || '', pct = d.bankPct == null ? '70' : d.bankPct, target = d.bankTarget == null ? '100k' : d.bankTarget;
  const setPct = (v: string) => { const n = String(v).replace(/[^0-9]/g, '').slice(0, 3); planActions.setDraft({ bankPct: n, targetNote: composeNote(n, period, target) }); };
  const setPer = (v: string) => planActions.setDraft({ trailPeriod: v, targetNote: composeNote(pct, v, target) });
  const priceInput = (k: 't1' | 't2', border: string, bg: string) => (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: 14, color: '#cbc9c0' }}>$</span>
      <input value={d[k]} onChange={(e) => planActions.setDraft({ [k]: e.target.value.replace(/,/g, '') } as Partial<PlanDraft>)} inputMode="decimal" placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 26px', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', color: '#1a1813', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
    </div>
  );
  const chevBtn = (onClick: () => void, col: string) => <button onClick={onClick} aria-label="presets" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: '2px 0 2px 2px', margin: 0, cursor: 'pointer', color: col }}><svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></button>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1f9d55' }}>Targets</span>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        {/* TP1 · Bank */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', minHeight: 17, fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', color: '#5aa97a', paddingLeft: 2 }}>TP1 · Bank</span>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e3f0e9', borderRadius: 12, background: '#fbfdfb', overflow: 'hidden' }}>
              {priceInput('t1', '#e3f0e9', '#fbfdfb')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderLeft: '1px solid #e3f0e9', background: '#fdf2e8', padding: '0 6px 0 9px' }}>
                <svg width={11} height={11} viewBox="0 0 24 24" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={9} fill="none" stroke="#e07b2f" strokeWidth={2.2} /><path d="M12 12 L12 3 A9 9 0 0 1 18.9 17.8 Z" fill="#e07b2f" /></svg>
                <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="numeric" placeholder="70" style={{ width: 20, textAlign: 'right', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 13, color: '#e07b2f', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: '#e07b2f' }}>%</span>
                {chevBtn(() => { setBankMenu((v) => !v); setPerMenu(false); }, '#e07b2f')}
              </div>
            </div>
            {bankMenu ? <PresetMenu title="Bank %" opts={BANK_PRESETS} cur={pct} fmt={(v) => v + '%'} onPick={(v) => { setPct(v); setBankMenu(false); }} accent="#e07b2f" accentBg="#fdf2e8" onClose={() => setBankMenu(false)} /> : null}
          </div>
        </div>
        {/* TP2 · Donchian trail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', minHeight: 17, fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', color: '#5aa97a', paddingLeft: 2 }}>TP2 · Donchian trail</span>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #eeece8', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
              {priceInput('t2', '#eeece8', '#fff')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, borderLeft: '1px solid #eeece8', background: '#f4f1fb', padding: '0 6px 0 9px' }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={9} /><path d="M12 7v5l3 2" /></svg>
                <input value={period} onChange={(e) => setPer(e.target.value)} placeholder="1d" style={{ width: 24, textAlign: 'center', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: '#7c5cff', outline: 'none' }} />
                {chevBtn(() => { setPerMenu((v) => !v); setBankMenu(false); }, '#7c5cff')}
              </div>
            </div>
            {perMenu ? <PresetMenu title="Trail timeframe" opts={PER_PRESETS} cur={period} fmt={(v) => v} onPick={(v) => { setPer(v); setPerMenu(false); }} accent="#7c5cff" accentBg="#f4f1fb" onClose={() => setPerMenu(false)} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── collapsed-section summaries (match dc.html tp*SummaryEl exactly) ──
const CONV_META: Record<string, { n: number; c: string }> = { low: { n: 1, c: '#9a958a' }, med: { n: 2, c: '#c9821f' }, high: { n: 3, c: '#7c5cff' } };
const COIN_C: Record<string, string> = { BTC: '#f7931a', ETH: '#627eea', SOL: '#14b88a' };
const COIN_G: Record<string, string> = { BTC: '₿', ETH: 'Ξ', SOL: '◎' };
function IdentitySummary({ d }: { d: PlanDraft }) {
  const cv = CONV_META[d.conv] || CONV_META.med, dc = d.dir === 'short' ? '#df5338' : '#1f9d55';
  const sep = <span style={{ color: '#cbc7bd' }}>·</span>;
  const arrow = <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={dc} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>{d.dir === 'short' ? <><path d="M22 17 13.5 8.5l-5 5L2 7" /><path d="M16 17h6v-6" /></> : <><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></>}</svg>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
      <span style={{ width: 15, height: 15, borderRadius: '50%', background: COIN_C[d.sym] || '#7c5cff', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 9, flex: '0 0 auto' }}>{COIN_G[d.sym] || (d.sym || 'B')[0]}</span>
      <span style={{ color: '#6f6a60' }}>{d.sym}</span>{sep}{arrow}<span style={{ color: dc }}>{d.dir === 'short' ? 'Short' : 'Long'}</span>{sep}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < cv.n ? cv.c : '#e2ded4' }} />)}</span>
    </span>
  );
}
function SizeSummary({ d }: { d: PlanDraft }) {
  const u = ({ qty: d.sym, margin: 'USD', marginpct: '% of equity', riskusd: 'USD risk', riskpct: '% risk' } as Record<string, string>)[d.sizeMode] || '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.2} style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={9} /><path d="M12 3a9 9 0 0 1 9 9h-9z" fill="#7c5cff" stroke="none" /></svg>
      <span style={{ color: '#7c5cff' }}>{d.sizeVal || '—'}</span><span style={{ color: '#9a958a' }}>{' ' + u}</span>
    </span>
  );
}
function LevSummary({ d }: { d: PlanDraft }) {
  const L = tpNum(String(d.lev)) || 5, col = L > 10 ? '#df5338' : L > 5 ? '#c9821f' : '#1f9d55';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: col }}><svg width={12} height={12} viewBox="0 0 24 24" fill={col} stroke="none" style={{ flex: '0 0 auto' }}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg><span>{L + '×'}</span></span>;
}
function LevelsSummary({ d, c }: { d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  const arw = <span style={{ color: '#cbc7bd' }}>{' → '}</span>;
  const entry = d.entryMode === 'zone' ? (d.ez1 || '?') + '–' + (d.ez2 || '?') : d.entry || '—';
  const fmtP = (p: number) => '$' + p.toLocaleString('en-US', { maximumFractionDigits: p < 10 ? 4 : p < 1000 ? 2 : 0 });
  const stopEl = d.stop ? <span style={{ color: '#df5338' }}>{d.stop}</span> : isFinite(c.liq) ? <span style={{ color: '#c9821f', display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>{fmtP(c.liq)}<span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.04em', color: '#d9a94f' }}>LIQ</span></span> : <span style={{ color: '#cbc7bd' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.2} strokeLinecap="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={8} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
      <span style={{ color: '#7c5cff' }}>{entry}</span>{arw}{stopEl}
      {d.t1 ? <>{arw}<span style={{ color: '#1f9d55' }}>{d.t1}</span></> : null}
      {d.t2 ? <>{arw}<span style={{ color: '#1f9d55' }}>{d.t2}</span></> : null}
    </span>
  );
}

// Thesis collapsed chips — per-field dot+label, coloured when filled, grey when empty (dc.html tpThesisChips)
function ThesisChips({ d }: { d: PlanDraft }) {
  const fields: [keyof PlanDraft, string, string][] = [['rationale', 'Rationale', '#7c5cff'], ['trigger', 'Trigger', '#1f9d55'], ['invalidation', 'Invalidation', '#df5338'], ['targetNote', 'Target', '#c9821f']];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {fields.map(([k, label, color]) => { const filled = String(d[k] ?? '').trim().length > 0; return (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 11, letterSpacing: '-0.005em', color: filled ? color : '#c4c1b8' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: filled ? color : '#dcd9d0', flex: '0 0 auto' }} />{label}
        </span>
      ); })}
    </span>
  );
}
// Chart collapsed chip — a 30×20 thumbnail when attached, else a camera icon + "None" (dc.html tpChartChip)
function ChartChip({ d }: { d: PlanDraft }) {
  const src = String(d.chart ?? '');
  if (src.length > 0) return <span style={{ display: 'inline-flex', alignItems: 'center' }}><span style={{ width: 30, height: 20, borderRadius: 4, overflow: 'hidden', border: '1px solid #e7e4ee', background: '#f3f1f7', backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /></span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 11, color: '#c4c1b8' }}><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#c4c1b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx={12} cy={13} r={3} /></svg>None</span>;
}

// ── top equity strip (ported from dc.html `tp4aStrip`): Risk · Reward·plan · R:R · Position · Margin · Stop-vs-liq ──
function EquityStrip({ c, d }: { c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const GREEN = '#1f9d55', RED = '#df5338', ORANGE = '#ff7a00', INK = '#1a1813';
  const MO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
  const money = (v: number, dec = 0) => (isFinite(v) ? tpMoney(v, dec) : '—');
  const tgt = c.rrList[0], rewardUSD = tgt ? tgt.rewardUSD : NaN, pr = c.primaryR;
  const bpRaw = parseFloat(String(d.bankPct ?? '').replace(/[^0-9.]/g, ''));
  const bankPct = isFinite(bpRaw) && bpRaw > 0 ? Math.min(100, bpRaw) : 100;
  const partial = bankPct < 100;
  const bankedReward = isFinite(rewardUSD) ? (rewardUSD * bankPct) / 100 : NaN;
  const tgt2 = c.rrList[1], reward2Full = tgt2 ? tgt2.rewardUSD : NaN, runnerPct = 100 - bankPct;
  const tp1Reward = partial ? bankedReward : rewardUSD;
  const tp2Reward = partial && isFinite(reward2Full) ? (reward2Full * runnerPct) / 100 : NaN;
  const hasReward = isFinite(tp1Reward) || isFinite(tp2Reward);
  const totalReward = (isFinite(tp1Reward) ? tp1Reward : 0) + (isFinite(tp2Reward) ? tp2Reward : 0);
  const planRewardBase = partial ? totalReward : rewardUSD;
  const planR = isFinite(planRewardBase) && isFinite(c.riskUSD) && c.riskUSD > 0 ? planRewardBase / c.riskUSD : pr;
  const tp1R = isFinite(tp1Reward) && isFinite(c.riskUSD) && c.riskUSD > 0 ? tp1Reward / c.riskUSD : NaN;
  const rrStr = isFinite(planR) ? planR.toFixed(2) : '—';
  const rrColor = !isFinite(planR) ? '#b3b0a6' : planR >= 2.5 ? GREEN : planR >= 1.5 ? '#c9821f' : RED;
  const rrVerd = !isFinite(planR) ? 'Set levels' : planR >= 2.5 ? 'Strong edge' : planR >= 1.5 ? 'Fair edge' : 'Thin edge';

  const lbl = (t: string, col?: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#a29b8c' }}>{col ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flex: '0 0 auto' }} /> : null}{t}</span>;
  const sub = (txt: string, col = '#b6a99e') => <span style={{ fontFamily: MO, fontWeight: 700, fontSize: 11, color: col, marginTop: 4 }}>{txt}</span>;
  const cellS = (flex: number, last?: boolean): CSSProperties => ({ flex, minWidth: 0, padding: '11px 20px', borderRight: last ? 'none' : '1px solid #f1eff5', display: 'flex', flexDirection: 'column' });
  const moveIcon = (col: string, upDir: boolean) => <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d={upDir ? 'M2 11L6 7.5L9 9L14 4' : 'M2 5L6 8.5L9 7L14 12'} /><path d={upDir ? 'M10 4H14V8' : 'M10 12H14V8'} /></svg>;
  const eqIcon = (col: string) => <svg width={12} height={12} viewBox="0 0 16 16" fill={col} style={{ flex: '0 0 auto' }}><rect x={1} y={3.5} width={14} height={9} rx={1.6} /><circle cx={8} cy={8} r={1.9} fill="#fff" /><circle cx={3.4} cy={8} r={0.7} fill="#fff" /><circle cx={12.6} cy={8} r={0.7} fill="#fff" /></svg>;
  const bignum = (txt: string, col: string) => <span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: col, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1 }}>{txt}</span>;
  const rightStack = (rows: React.ReactNode[]) => <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>{rows.map((r, i) => (r ? <span key={i} style={{ display: 'contents' }}>{r}</span> : null))}</div>;
  const pctChip = (icon: React.ReactNode, txt: string, col: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{icon}<span style={{ fontFamily: MO, fontWeight: 700, fontSize: 12, color: col, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{txt}</span></span>;

  const finalMove = tgt2 && isFinite(tgt2.distPct) ? tgt2.distPct : tgt && isFinite(tgt.distPct) ? tgt.distPct : NaN;
  const rewEqPct = isFinite(totalReward) && isFinite(c.Q) && c.Q > 0 ? (totalReward / c.Q) * 100 : NaN;
  const tp1v = isFinite(tp1Reward) ? tp1Reward : 0, tp2v = isFinite(tp2Reward) ? tp2Reward : 0, denom = tp1v + tp2v;
  const tp1Share = denom > 0 ? tp1v / denom : 1, tp2Share = denom > 0 ? tp2v / denom : 0, tp1Pct = Math.round(tp1Share * 100);
  const splitLegend = (l: string, amt: string, r: string, amt2: string) => (
    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', minWidth: 0 }}><span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#a8a294', whiteSpace: 'nowrap' }}>{l}</span><span style={{ fontFamily: MO, fontWeight: 700, fontSize: 12.5, color: '#3f7355', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amt}</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 0 }}><span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#a8a294', whiteSpace: 'nowrap' }}>{r}</span><span style={{ fontFamily: MO, fontWeight: 700, fontSize: 12.5, color: '#3f7355', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amt2}</span></div>
    </div>
  );
  const splitBar = (s1: number, s2: number) => <div style={{ display: 'flex', gap: 3, height: 8, marginTop: 7 }}><div style={{ flexBasis: (s1 * 100).toFixed(2) + '%', background: GREEN, borderRadius: 99 }} />{s2 > 0 ? <div style={{ flexBasis: (s2 * 100).toFixed(2) + '%', background: '#57c98a', borderRadius: 99 }} /> : null}</div>;

  // stop-vs-liq geometry
  const price = c.mkt.mark;
  const liqDist = isFinite(c.liq) ? (Math.abs(price - c.liq) / price) * 100 : NaN;
  const stopDist = isFinite(c.S) ? (Math.abs(price - c.S) / price) * 100 : NaN;
  const cushion = isFinite(liqDist) && isFinite(stopDist) && stopDist > 0 ? liqDist / stopDist : NaN;
  const verd = !isFinite(cushion) ? { t: '—', c: '#b3b0a6' } : cushion >= 3 ? { t: 'Clear of liq', c: GREEN } : cushion >= 1.5 ? { t: 'Near liq', c: '#c9821f' } : { t: 'Close to liq', c: RED };
  const stopPos = isFinite(liqDist) && isFinite(stopDist) && liqDist > 0 ? Math.max(6, Math.min(94, (1 - stopDist / liqDist) * 100)) : 50;
  const tdot = (left: number, col: string) => <span style={{ position: 'absolute', left: left + '%', top: '50%', width: 12, height: 12, borderRadius: '50%', background: '#fff', border: '3px solid ' + col, transform: 'translate(-50%,-50%)', boxShadow: '0 1px 3px rgba(20,20,12,0.25)' }} />;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', background: '#fff', border: '1px solid #efedf3', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden', position: 'relative', zIndex: 6 }}>
      {/* Risk */}
      <div style={cellS(1.15)}>{lbl('Risk', RED)}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>{bignum(isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : '—', RED)}{rightStack([
          isFinite(c.distStopPct) ? pctChip(moveIcon('#c56a5a', !c.isLong), c.distStopPct.toFixed(2) + '%', '#c56a5a') : null,
          isFinite(c.riskPct) ? pctChip(eqIcon('#7c5cff'), c.riskPct.toFixed(2) + '%', '#7c5cff') : null,
        ])}</div>
      </div>
      {/* Reward · plan */}
      <div style={cellS(partial ? 1.8 : 1.7)}>{lbl(partial ? 'Reward · plan' : 'Reward · TP1', GREEN)}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>{bignum(hasReward ? '+' + money(partial ? totalReward : rewardUSD) : '—', GREEN)}{rightStack([
          isFinite(finalMove) ? pctChip(moveIcon('#4f9e6f', c.isLong), finalMove.toFixed(2) + '%', '#4f9e6f') : null,
          isFinite(rewEqPct) ? pctChip(eqIcon('#7c5cff'), rewEqPct.toFixed(2) + '%', '#7c5cff') : null,
        ])}</div>
        {partial ? <>{splitBar(tp1Share, tp2Share)}{splitLegend('TP1 · banked · ' + tp1Pct + '%', isFinite(tp1Reward) ? '+' + money(tp1Reward) : '—', 'TP2 · runner · ' + (100 - tp1Pct) + '%', isFinite(tp2Reward) ? '+' + money(tp2Reward) : '—')}</> : null}
      </div>
      {/* R:R */}
      <div style={cellS(1)}>{lbl('R : R')}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 6 }}><span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: rrColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rrStr}</span><span style={{ fontFamily: MO, fontWeight: 700, fontSize: 11, color: rrColor, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{rrVerd}</span></div>
        {partial && isFinite(tp1R) ? (() => { const tp2R = isFinite(tp2Reward) && isFinite(c.riskUSD) && c.riskUSD > 0 ? tp2Reward / c.riskUSD : NaN; const r1 = isFinite(tp1R) ? tp1R : 0, r2 = isFinite(tp2R) ? tp2R : 0, rDen = r1 + r2, rS1 = rDen > 0 ? r1 / rDen : 1, rS2 = rDen > 0 ? r2 / rDen : 0; return <>{splitBar(rS1, rS2)}{splitLegend('TP1', isFinite(tp1R) ? tp1R.toFixed(2) : '—', 'TP2', isFinite(tp2R) ? tp2R.toFixed(2) : '—')}</>; })() : null}
      </div>
      {/* Position */}
      <div style={cellS(0.8)}>{lbl('Position', '#7c5cff')}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}><span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: INK, fontVariantNumeric: 'tabular-nums' }}>{isFinite(c.qty) ? c.qty.toFixed(c.qty < 10 ? 3 : 2) : '—'}</span><CoinIcon sym={d.sym} /></span>
        {sub(isFinite(c.notional) ? 'Notional · ' + money(c.notional) : '—')}
      </div>
      {/* Margin */}
      <div style={cellS(1.4)}>{lbl('Margin', '#7c5cff')}
        <span style={{ fontFamily: MO, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: INK, marginTop: 7, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isFinite(c.margin) ? money(c.margin) : '—'}<span style={{ color: '#7c5cff' }}>{isFinite(c.marginPct) ? ' · ' + c.marginPct.toFixed(0) + '%' : ''}</span></span>
        <span style={{ height: 8, borderRadius: 99, background: '#f0efeb', overflow: 'hidden', display: 'block', marginTop: 8 }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, c.marginPct || 0)) + '%', background: '#7c5cff', borderRadius: 99 }} /></span>
      </div>
      {/* Stop vs liq */}
      <div style={cellS(1.6, true)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{lbl('Stop vs liq', ORANGE)}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: verd.c, fontWeight: 800, fontSize: 10 }}>{verd.t}</span></div>
        <div style={{ position: 'relative', height: 9, borderRadius: 99, background: ORANGE, marginTop: 11 }}><div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '9%', background: RED, borderRadius: '0 99px 99px 0' }} />{tdot(2, ORANGE)}{tdot(stopPos, RED)}{tdot(99, '#7c5cff')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontFamily: MO, fontWeight: 700, fontSize: 10.5 }}><span style={{ color: ORANGE }}>LIQ {isFinite(c.liq) ? money(c.liq) : '—'}</span><span style={{ color: RED }}>STOP {isFinite(c.S) ? money(c.S) : '—'}</span><span style={{ color: '#7c5cff' }}>{money(price)}</span></div>
      </div>
    </div>
  );
}

export function Editor() {
  const store = usePlanStore();
  const d = store.draft;
  const editing = store.editingId ? store.plans.find((p) => p.id === store.editingId) : null;

  // real account + market values (graceful fallback to the static refs while loading)
  const { data: account } = useAccount();
  const { data: positions } = usePositions();
  const { data: candles } = useBtcCandles(Math.floor(Date.now() / 1000) - 20 * 86400);
  const equity = parseFloat(account?.total || '') || TP_EQUITY;
  const btcPos = (positions || []).find((p) => p.contract === 'BTC_USDT' && p.size !== 0);
  const btcMark = parseFloat(btcPos?.mark_price || '') || (candles && candles.length ? parseFloat(candles[candles.length - 1].c) : NaN) || undefined;

  const c = tpCompute(d, equity, d.sym === 'BTC' ? btcMark : undefined);
  const [full, setFull] = useState<string | null>(null);
  // Dramatic risk backdrops: fire when crossing ABOVE 5× leverage / 50% size,
  // re-arm once back in the safe zone (matches the dc.html behaviour).
  const [levAlert, setLevAlert] = useState(false);
  const [sizeAlert, setSizeAlert] = useState(false);
  const prevLev = useRef(d.lev);
  const prevSizePct = useRef(0);
  useEffect(() => {
    if (d.lev > 5 && prevLev.current <= 5) setLevAlert(true);
    if (d.lev <= 5) setLevAlert(false);
    prevLev.current = d.lev;
  }, [d.lev]);
  useEffect(() => {
    const isPct = d.sizeMode === 'marginpct' || d.sizeMode === 'riskpct';
    const v = tpNum(d.sizeVal) || 0;
    if (isPct && v > 50 && !(prevSizePct.current > 50)) setSizeAlert(true);
    if (!isPct || v <= 50) setSizeAlert(false);
    prevSizePct.current = isPct ? v : 0;
  }, [d.sizeVal, d.sizeMode]);

  const curMode = SIZE_MODES.find((s) => s.v === d.sizeMode)!;
  const isPctMode = d.sizeMode === 'marginpct' || d.sizeMode === 'riskpct';
  const levVal = Math.min(20, Math.max(1, tpNum(d.lev) || 5));
  const levFillPct = ((levVal - 1) / 19) * 100;
  const sizePctVal = Math.min(100, Math.max(0, tpNum(d.sizeVal) || 0));

  // collapsible sections + expand-all per group (persisted)
  const [secOpen, setSecOpen] = useState<Record<SecKey, boolean>>(() => {
    try { const s = localStorage.getItem('tdplan_ed_open'); if (s) return { ...SEC_DEFAULT, ...JSON.parse(s) }; } catch { /* ignore */ }
    return SEC_DEFAULT;
  });
  useEffect(() => { try { localStorage.setItem('tdplan_ed_open', JSON.stringify(secOpen)); } catch { /* ignore */ } }, [secOpen]);
  const toggleSec = (k: SecKey) => setSecOpen((o) => ({ ...o, [k]: !o[k] }));
  const setGroup = (keys: SecKey[], v: boolean) => setSecOpen((o) => { const n = { ...o }; keys.forEach((k) => (n[k] = v)); return n; });
  const theoryAllOpen = secOpen.thesis && secOpen.chart;
  const setupAllOpen = secOpen.identity && secOpen.levels && secOpen.sizing && secOpen.leverage;

  const save = () => {
    if (!c.valid) return;
    const name = d.name.trim();
    const plan: Plan = editing
      ? { ...editing, ...d, name, draft: { ...d }, status: editing.status }
      : { id: 'tp_' + Date.now().toString(36), sym: d.sym, dir: d.dir, conv: d.conv, status: 'idea' as Status, createdAt: Date.now(), name, lev: d.lev, rationale: d.rationale, trigger: d.trigger, invalidation: d.invalidation, targetNote: d.targetNote, tradeDate: d.tradeDate, entry: d.entry, stop: d.stop, rr: c.rrList[0]?.rr, draft: { ...d } };
    planActions.savePlan(plan);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      <style>{`.tp-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;outline:none;cursor:pointer}.tp-range::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:#fff;border:1px solid #d7d4cc;box-shadow:0 1px 3px rgba(20,20,12,.18);cursor:pointer}.tp-range::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:#fff;border:1px solid #d7d4cc;cursor:pointer}`}</style>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', padding: '6px 2px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span onClick={() => (editing ? planActions.cancelEdit() : planActions.setView('workbook'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11.5, color: '#b0aea3', width: 'max-content' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>{editing ? 'Cancel edit' : 'Back to workbook'}
          </span>
          <span style={{ fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', color: '#1a1813', lineHeight: 1.08 }}>{editing ? 'Edit plan.' : 'Plan this trade.'}</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70', lineHeight: 1.5, maxWidth: 560 }}>{editing ? `Updating ${TP_MARKETS[d.sym].label} ${d.dir} — change levels, size, leverage or thesis.` : 'Lock the specifics — levels, size, leverage, thesis. You’ll still execute manually on TradingView.'}</span>
        </div>
      </div>

      {/* top equity strip — live math condensed into Risk/Reward/R:R/Position/Margin/Stop-vs-liq */}
      <EquityStrip c={c} d={d} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        {/* THEORY group — name/date + thesis + chart, collapsible under a purple gradient header */}
        <GroupSheet glow="#7c5cff">
          <GroupHead label="Theory" color="#7c5cff" gradient="linear-gradient(180deg,#ffffff 0%,#faf8ff 45%,#ece5fb 100%)" border="#e6ddfb" allOpen={theoryAllOpen} onToggleAll={() => setGroup(['thesis', 'chart'], !theoryAllOpen)} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '9px 18px', borderBottom: '1px solid #f3f1f7' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 5 }}>
              <input value={d.name} onChange={(e) => planActions.setDraft({ name: e.target.value })} placeholder={tpAutoName(d)} style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#1a1813', padding: 0 }} />
              <span style={{ height: 2, width: '100%', background: 'linear-gradient(90deg,#c9bcff,rgba(201,188,255,0))', borderRadius: 2 }} />
            </div>
            <ExpectedDate d={d} />
          </div>
          <SecHead title="Thesis" open={secOpen.thesis} onToggle={() => toggleSec('thesis')} collapsedRight={<ThesisChips d={d} />} />
          {secOpen.thesis && <Thesis d={d} />}
          <div style={{ borderTop: '1px solid #f0efec' }}>
            <SecHead title="Chart" open={secOpen.chart} onToggle={() => toggleSec('chart')} collapsedRight={<ChartChip d={d} />} />
            {secOpen.chart && <div style={{ flex: 1 }}><ChartUpload d={d} onFull={setFull} /></div>}
          </div>
        </GroupSheet>

        {/* SETUP group — identity / levels / sizing / leverage, collapsible under a green gradient header */}
        <GroupSheet glow="#1f9d55">
          <GroupHead label="Setup" color="#1f9d55" gradient="linear-gradient(180deg,#ffffff 0%,#f6fbf8 45%,#e2f3ea 100%)" border="#cfeadb" allOpen={setupAllOpen} onToggleAll={() => setGroup(['identity', 'levels', 'sizing', 'leverage'], !setupAllOpen)} />

          <div style={{ borderBottom: '1px solid #f3f1f7' }}>
            <SecHead title="Identity" open={secOpen.identity} onToggle={() => toggleSec('identity')} collapsedRight={<IdentitySummary d={d} />} />
            {secOpen.identity && <IdentitySection d={d} btcMark={btcMark} />}
          </div>

          <div style={{ borderBottom: '1px solid #f3f1f7' }}>
            <SecHead title="Levels" open={secOpen.levels} onToggle={() => toggleSec('levels')}
              right={<Seg opts={[{ v: 'price', label: 'Single price' }, { v: 'zone', label: 'Zone' }]} cur={d.entryMode} onPick={(v) => planActions.setDraft({ entryMode: v as 'price' | 'zone' })} accent="#23211b" />}
              collapsedRight={<LevelsSummary d={d} c={c} />} />
            {secOpen.levels && (
            <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.entryMode === 'zone' ? (
                <Field label="Entry zone" labelColor="#7c5cff"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ flex: 1 }}><PriceInput value={d.ez1} onChange={(v) => planActions.setDraft({ ez1: v })} placeholder="from" /></div><span style={{ fontWeight: 800, fontSize: 14, color: '#cbc9c0' }}>–</span><div style={{ flex: 1 }}><PriceInput value={d.ez2} onChange={(v) => planActions.setDraft({ ez2: v })} placeholder="to" /></div></div></Field>
              ) : (
                <Field label="Entry price"><PriceInput value={d.entry} onChange={(v) => planActions.setDraft({ entry: v })} placeholder="0.00" /></Field>
              )}
              <Field label="Stop loss" labelColor="#df5338" hint="blank = ride to liq"><PriceInput value={d.stop} onChange={(v) => planActions.setDraft({ stop: v })} placeholder="0.00" accent="#df5338" tint="#f2ddd6" bg="#fffcfb" /></Field>
              <TargetInputs d={d} />
              <HeatmapLaunchCard variant="row" symbol={d.sym as HeatSymbol} title="Check your stop against the real clusters" sub="Is it beyond the sweep, not inside it?" />
            </div>
            )}
          </div>

          {/* sizing */}
          <div style={{ borderBottom: '1px solid #f3f1f7' }}>
            <SecHead title="Sizing" open={secOpen.sizing} onToggle={() => toggleSec('sizing')} collapsedRight={<SizeSummary d={d} />} />
            {secOpen.sizing && (
            <>
            <div style={{ borderTop: '1px solid #f1f0ed', borderBottom: '1px solid #f1f0ed', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
              {SIZE_MODES.map((m, i) => { const a = m.v === d.sizeMode;
                const val = m.v === 'qty' ? (c.hasQty ? c.qty.toLocaleString('en-US', { maximumFractionDigits: c.qty < 1 ? 4 : 2 }) : '—')
                  : m.v === 'margin' ? (c.hasQty ? tpMoney(c.margin, 0) : '—')
                  : m.v === 'marginpct' ? (c.hasQty ? c.marginPct.toFixed(1) + '%' : '—')
                  : m.v === 'riskusd' ? (c.hasQty ? tpMoney(c.riskUSD, 0) : '—')
                  : (isFinite(c.riskPct) ? c.riskPct.toFixed(2) + '%' : '—');
                return (
                  <div key={m.v} onClick={() => planActions.setDraft({ sizeMode: m.v })} style={{ padding: '12px 14px', cursor: 'pointer', borderRight: i < 4 ? '1px solid #f1f0ed' : 'none', background: a ? '#faf8ff' : 'transparent', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: a ? 800 : 700, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: a ? '#7c5cff' : '#a8a69b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{a ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c5cff' }} /> : null}{m.label}</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1813', fontVariantNumeric: 'tabular-nums' }}>{val}{m.v === 'qty' ? <span style={{ fontWeight: 600, fontSize: 9.5, color: '#b3b0a6' }}>{' ' + d.sym}</span> : null}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a69b' }}>{'Amount · ' + curMode.hint}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ flex: '0 0 auto', maxWidth: '60%', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <input value={tpFmtNum(d.sizeVal)} onChange={(e) => planActions.setDraft({ sizeVal: e.target.value.replace(/,/g, '') })} inputMode="decimal" placeholder={isPctMode ? '1.0' : d.sizeMode === 'qty' ? String(c.mkt.step) : '500'} style={{ width: 'auto', minWidth: '1ch', fieldSizing: 'content', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit', fontWeight: 800, fontSize: 26, letterSpacing: '-0.03em', color: '#1a1813', background: 'transparent', fontVariantNumeric: 'tabular-nums' } as CSSProperties} />
                  <span style={{ flex: '0 0 auto', fontWeight: 800, fontSize: 15, color: '#a8a69b' }}>{curMode.unit}</span>
                </div>
                {isPctMode ? (
                  <div style={{ flex: 1, minWidth: 90, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="tp-range" type="range" min={0} max={100} step={1} value={sizePctVal} onChange={(e) => planActions.setDraft({ sizeVal: e.target.value })} style={{ background: `linear-gradient(90deg,${sizePctVal > 50 ? '#df5338' : '#7c5cff'} 0 ${sizePctVal}%,#ece9e3 ${sizePctVal}% 100%)` }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 9.5, color: '#c4c2b8' }}><span>0%</span><span style={{ color: c.sizeWarn ? '#df5338' : '#c4c2b8' }}>{c.sizeBlocked ? 'over 70% — too big' : c.sizeWarn ? 'over half your account' : ''}</span><span>100%</span></div>
                  </div>
                ) : null}
              </div>
            </div>
            </>
            )}
          </div>

          {/* leverage */}
          <div>
            <SecHead title="Leverage" open={secOpen.leverage} onToggle={() => toggleSec('leverage')} collapsedRight={<LevSummary d={d} />} />
            {secOpen.leverage && (
            <div style={{ padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => planActions.setDraft({ lev: Math.max(1, levVal - 1) })} style={stepBtn}>−</button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid #ededea', borderRadius: 11, background: '#fff' }}>
                  <input value={String(d.lev)} onChange={(e) => planActions.setDraft({ lev: Math.max(1, Math.min(125, tpNum(e.target.value) || 1)) })} inputMode="numeric" style={{ width: '2.4ch', textAlign: 'right', padding: 0, border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 800, fontSize: 18, color: '#1a1813', background: 'transparent' }} />
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#b3b0a6' }}>×</span>
                </div>
                <button onClick={() => planActions.setDraft({ lev: Math.min(20, levVal + 1) })} style={stepBtn}>+</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '2px 2px 0' }}>
                <input className="tp-range" type="range" min={1} max={20} step={1} value={levVal} onChange={(e) => planActions.setDraft({ lev: +e.target.value })} style={{ background: `linear-gradient(90deg,${levVal > 5 ? '#df5338' : '#7c5cff'} 0 ${levFillPct}%,#ece9e3 ${levFillPct}% 100%)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em', color: '#c4c2b8' }}><span>1×</span><span>20×</span></div>
              </div>
            </div>
            )}
          </div>
        </GroupSheet>
      </div>

      {/* footer — execute-manually note + save + clear (z-index above the group glows) */}
      <div style={{ padding: '2px 4px 0', position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', rowGap: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 11.5, color: '#b3aea2' }}>You&rsquo;ll execute manually on<svg width={17} height={17} viewBox="0 0 24 24" fill="#131722" style={{ flex: '0 0 auto' }}><path d="M3 7.3h7.1v9.3H6.85V11.5H3z" /><circle cx={13.3} cy={9.1} r={2} /><path d="M16.6 7.3h4.5l-4 9.3h-4.2z" /></svg>TradingView.</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {c.valid ? (
            <span onClick={save}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(124,92,255,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(124,92,255,0.08)'; }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 11, cursor: 'pointer', background: 'linear-gradient(180deg,#f7f3ff,#efe7ff)', border: '1px solid #e3d8fb', borderRadius: 12, padding: '11px 12px 11px 18px', boxShadow: '0 1px 2px rgba(124,92,255,0.08)', transition: 'box-shadow .2s ease' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span style={{ fontWeight: 800, fontSize: 14.5, color: '#5a3ff0', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{editing ? 'Update plan' : 'Save to Plans'}</span><span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#5a3ff0', background: '#fff', border: '1px solid #e3d8fb', padding: '3px 8px', borderRadius: 99 }}>{editing ? editing.status : 'Ideas'}</span></span>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 27, height: 27, borderRadius: 99, background: 'linear-gradient(150deg,#9d82ff,#7c5cff)', boxShadow: '0 3px 9px -2px rgba(124,92,255,0.6)', flex: '0 0 auto' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f4f3f0', borderRadius: 12, padding: '12px 16px' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={10} /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#b3b0a6' }}>{c.levBlocked ? 'Leverage above 10× — bring it down' : c.sizeBlocked ? 'Size above 70% — bring it down' : 'Set entry, stop, a target & size to save'}</span>
            </span>
          )}
          <button onClick={() => planActions.clearDraft()}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#df5338'; e.currentTarget.style.borderColor = '#f2ddd6'; e.currentTarget.style.background = '#fdfbfa'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#9b988d'; e.currentTarget.style.borderColor = '#ededea'; e.currentTarget.style.background = '#fff'; }}
            style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 18px 13px 15px', borderRadius: 12, border: '1px solid #ededea', background: '#fff', color: '#9b988d', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s, border-color .15s, background .15s' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>Clear
          </button>
        </span>
      </div>

      {full ? <div onClick={() => setFull(null)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(14,13,11,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, boxSizing: 'border-box', cursor: 'zoom-out' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={full} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} /></div> : null}

      <style>{RISK_KF}</style>
      {levAlert && <RiskAlert kind="lev" onAdjust={() => { planActions.setDraft({ lev: 5 }); setLevAlert(false); }} onDismiss={() => setLevAlert(false)} />}
      {sizeAlert && <RiskAlert kind="size" onAdjust={() => { planActions.setDraft({ sizeVal: '50' }); setSizeAlert(false); }} onDismiss={() => setSizeAlert(false)} />}
    </div>
  );
}

const RISK_KF = `
@keyframes edFade{from{opacity:0}to{opacity:1}}
@keyframes edAlertIn{0%{transform:scale(.7) translateY(30px) rotate(-1deg);opacity:0}55%{transform:scale(1.05) translateY(0) rotate(.5deg)}72%{transform:scale(.98) rotate(-.4deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes edShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-9px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(5px)}75%{transform:translateX(-3px)}}
@keyframes edStripes{from{background-position:0 0}to{background-position:64px 0}}
@keyframes edThrob{0%,100%{transform:scale(1)}50%{transform:scale(1.13)}}
@keyframes edRing{0%{transform:scale(.7);opacity:.65}100%{transform:scale(2.1);opacity:0}}
`;

// Full-screen risk backdrop shown when leverage > 5× or position size > 50%
// (handoff: red radial wash + Munger quote + striped pulsing alert card).
function RiskAlert({ kind, onAdjust, onDismiss }: { kind: 'lev' | 'size'; onAdjust: () => void; onDismiss: () => void }) {
  const lev = kind === 'lev';
  const quote = lev
    ? 'There are three ways a smart person can go broke: liquor, ladies, and leverage.'
    : 'The first rule of compounding: never interrupt it unnecessarily.';
  const icon = lev
    ? <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>
    : <><path d="M12 2v6" /><path d="m4.93 10.93 1.41 1.41" /><path d="M2 18h2" /><path d="M20 18h2" /><path d="m19.07 10.93-1.41 1.41" /><path d="M22 22H2" /><path d="m8 6 4-4 4 4" /><path d="M16 18a4 4 0 0 0-8 0" /></>;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(120% 105% at 50% 16%,rgba(178,30,12,0.60) 0%,rgba(92,12,6,0.80) 38%,rgba(34,7,5,0.92) 70%,rgba(10,4,3,0.96) 100%)', backdropFilter: 'blur(7px) saturate(1.15)', WebkitBackdropFilter: 'blur(7px) saturate(1.15)', animation: 'edFade .25s ease', fontFamily: 'inherit' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '40px 24px', pointerEvents: 'none' }}>
        <div style={{ maxWidth: 640, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, fontSize: 72, lineHeight: 0.5, color: 'rgba(255,255,255,0.5)' }}>“</span>
          <span style={{ fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 600, fontSize: 27, lineHeight: 1.38, letterSpacing: '-0.005em', color: 'rgba(255,255,255,0.72)' }}>{quote}”</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 11.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}><span style={{ width: 26, height: 1.5, background: 'rgba(255,255,255,0.45)' }} />Charlie Munger</span>
        </div>
      </div>
      <div style={{ position: 'relative', width: 'min(424px,92vw)', background: '#fff', borderRadius: 26, overflow: 'hidden', boxShadow: '0 40px 100px rgba(60,8,4,0.55)', animation: 'edAlertIn .55s cubic-bezier(.2,1.2,.3,1) both' }}>
        <div style={{ position: 'relative', overflow: 'hidden', background: '#df5338', padding: '24px 32px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, textAlign: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(0,0,0,0.10) 0 16px,transparent 16px 32px)', backgroundSize: '64px 64px', animation: 'edStripes 1.1s linear infinite' }} />
          <div style={{ position: 'relative', width: 80, height: 80, display: 'grid', placeItems: 'center', animation: 'edShake .6s ease both .1s' }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'edRing 1.6s ease-out infinite' }} />
            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'edRing 1.6s ease-out infinite .8s' }} />
            <span style={{ position: 'relative', width: 70, height: 70, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 8px 22px rgba(60,8,4,0.35)', animation: 'edThrob 1s ease-in-out infinite' }}>
              <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="#df5338" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
            </span>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>{lev ? 'Leverage check' : 'Position size check'}</span>
            <span style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.025em', color: '#fff', lineHeight: 1.02 }}>{lev ? 'Whoa. Past 5×.' : 'Over half your account.'}</span>
          </div>
        </div>
        <div style={{ padding: '16px 26px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.45, color: '#1a1813', letterSpacing: '-0.01em' }}>
            {lev ? <>Last time you pushed past this, you <span style={{ color: '#df5338' }}>nearly blew the account.</span></> : <>One trade shouldn’t be able to <span style={{ color: '#df5338' }}>decide your whole month.</span></>}
          </span>
          <span style={{ fontWeight: 500, fontSize: 13.5, lineHeight: 1.5, color: '#897f70' }}>{lev ? 'Slow down. Is this size really worth it — or is this the same impulse as before? Above 10× you won’t even be able to save the plan.' : 'A single idea this size leaves no room to be wrong. Above 70% you won’t even be able to save the plan.'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #f0efec' }}>
          <button onClick={onAdjust} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', background: '#eef8f1', border: 'none', borderRight: '1px solid #ebe9e3', padding: '17px 14px' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#1f8a4a" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <span style={{ fontWeight: 800, fontSize: 13.5, color: '#1f8a4a', letterSpacing: '-0.01em' }}>{lev ? 'Adjust to 5×' : 'Trim to 50%'}</span>
          </button>
          <button onClick={onDismiss} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontFamily: 'inherit', background: '#fff', border: 'none', padding: '17px 14px' }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#d6a59b', letterSpacing: '-0.01em' }}>{lev ? 'Fuck you, I am god' : 'I know what I’m doing'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const stepBtn: CSSProperties = { width: 42, height: 42, flex: '0 0 auto', borderRadius: 11, border: '1.5px solid #ededea', background: '#faf9f7', color: '#56544b', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };

function Field({ label, labelColor = '#897f70', hint, children }: { label: string; labelColor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor }}>{label}{hint ? <span style={{ color: '#d3beb7' }}>{' · ' + hint}</span> : null}</span>
      {children}
    </div>
  );
}

function Seg({ opts, cur, onPick, accent = '#23211b' }: { opts: { v: string; label: string }[]; cur: string; onPick: (v: string) => void; accent?: string }) {
  return (
    <div style={{ display: 'inline-flex', background: '#f4f3f0', borderRadius: 10, padding: 2, gap: 2 }}>
      {opts.map((o) => { const a = o.v === cur;
        return <button key={o.v} onClick={() => onPick(o.v)} style={{ fontFamily: 'inherit', cursor: 'pointer', border: 'none', borderRadius: 8, padding: '7px 10px', fontWeight: a ? 800 : 700, fontSize: 12, whiteSpace: 'nowrap', color: a ? '#fff' : '#8c8a81', background: a ? accent : 'transparent', boxShadow: a ? '0 1px 2px rgba(20,20,12,0.12)' : 'none', transition: 'all .14s' }}>{o.label}</button>;
      })}
    </div>
  );
}
