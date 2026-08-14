'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  type PlanDraft, type SizeMode, type Sym, type Dir, type Conv,
  tpCompute, tpFmtNum, tpNum, tpMoney, tpAutoName, TP_MARKETS, TP_EQUITY, type Plan, type Status,
  tpEntryRungs, pctNum, tpLevels, type Level,
} from '@/lib/plan-model';
import { HoverTip } from './HoverTip';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { HeatmapLaunchCard } from '@/components/heatmap/HeatmapLaunchCard';
import type { HeatSymbol } from '@/hooks/useHeatmap';
import { CoinIcon } from './coins';

const PURP = '#7c5cff';
const SIZE_MODES: { v: SizeMode; label: string; unit: string; hint: string }[] = [
  { v: 'qty', label: 'Contracts', unit: 'contracts', hint: 'units of the asset' },
  { v: 'margin', label: 'Margin USD', unit: 'USD margin', hint: 'margin you post' },
  { v: 'marginpct', label: '% balance', unit: '% of balance', hint: '% of equity as margin' },
  { v: 'riskusd', label: 'Risk, USD', unit: 'USD risk', hint: 'USD lost if stopped' },
  { v: 'riskpct', label: 'Risk, %', unit: '% risk', hint: '% of equity risked' },
];

// ── collapsible-section scaffolding (Theory: thesis/chart · Setup: identity/levels/sizing/leverage) ──
type SecKey = 'thesis' | 'chart' | 'identity' | 'levels' | 'sizing' | 'leverage';
const SEC_DEFAULT: Record<SecKey, boolean> = { thesis: false, chart: false, identity: false, levels: true, sizing: false, leverage: false };
// chevron that rotates when open (dc.html `tpchev`)
const Chev = ({ open, color = '#b3b0a6' }: { open: boolean; color?: string }) => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease', flex: '0 0 auto' }}><path d="m6 9 6 6 6-6" /></svg>
);
// clickable section header: title + (optional) right slot (collapsed summary / control) + chevron
function SecHead({ title, open, onToggle, right, collapsedRight, fixedH }: { title: string; open: boolean; onToggle: () => void; right?: React.ReactNode; collapsedRight?: React.ReactNode; fixedH?: boolean }) {
  return (
    <div onClick={onToggle} className="tpsec-hd" style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', ...(fixedH ? { height: 41, boxSizing: 'border-box', padding: '0 18px' } : { padding: '12px 18px' }) }}>
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

const MONO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
type ThesisFieldDef = { k: keyof PlanDraft; dot: string; lab: string; ph: string; tint: string };
const THESIS_FIELDS: ThesisFieldDef[] = [
  { k: 'rationale', dot: '#7c5cff', lab: 'Rationale', ph: 'Reclaim of the range low, momentum turning up.', tint: '#f5f2ff' },
  { k: 'trigger', dot: '#1f9d55', lab: 'Trigger', ph: '15m close back above 64,000 and holds.', tint: '#eef8f1' },
  { k: 'invalidation', dot: '#df5338', lab: 'Invalidation', ph: 'Loses 61,900 on the 1h — idea is dead.', tint: '#fdf3f0' },
  { k: 'targetNote', dot: '#c9821f', lab: 'Target / exit', ph: '', tint: '#fbf5ea' },
];
// Plain text of the auto-composed Target/exit sentence (Tab commits this into the field).
function targetPlainText(c: ReturnType<typeof tpCompute>): string {
  const lv = (c.levels || []).filter((l) => l.hasPrice);
  if (!lv.length) return 'Scale out into 70k, trail the rest.';
  const money = (v: number) => tpMoney(v, v < 1000 ? 2 : 0);
  let s = '';
  lv.forEach((l, j) => {
    const pct = Math.round(l.pct || 0), tf = l.trail, tl = l.trailLen;
    const bank = 'bank ' + pct + '% at ' + money(l.price);
    const trailTxt = tf ? 'trail on ' + tf + ' TF' + (tl ? ' · ' + tl + '-bar Donchian' : '') + ' and ' : '';
    const leg = trailTxt + bank;
    s += j === 0 ? leg.charAt(0).toUpperCase() + leg.slice(1) : ', then ' + leg;
  });
  return s + '.';
}
// Color-coded placeholder overlay for the empty Target/exit field (bank% green, trail purple, prices ink).
function TargetPlaceholder({ c }: { c: ReturnType<typeof tpCompute> }) {
  const GREY = '#8a8577', GREEN = '#1f9d55', PURP = '#7c5cff', INK = '#1a1813';
  const money = (v: number) => tpMoney(v, v < 1000 ? 2 : 0);
  const lv = (c.levels || []).filter((l) => l.hasPrice);
  const seg: { s: string; col: string; mono?: boolean }[] = [];
  const add = (s: string, col: string, mono?: boolean) => seg.push({ s, col, mono });
  if (!lv.length) { add('Scale out into ', GREY); add('70k', GREEN, true); add(', trail the rest.', GREY); }
  else {
    lv.forEach((l, j) => {
      const pct = Math.round(l.pct || 0), tf = l.trail, tl = l.trailLen;
      const trailAdd = (cap: boolean) => { if (!tf) { add(cap ? 'Bank ' : 'bank ', GREY); return; } add(cap ? 'Trail on ' : 'trail on ', GREY); add(tf, PURP, true); add(' TF', GREY); if (tl) { add(' · ', GREY); add(tl + '-bar', PURP, true); add(' Donchian', GREY); } add(' and ', GREY); add('bank ', GREY); };
      if (j === 0) trailAdd(true); else { add(', then ', GREY); trailAdd(false); }
      add(pct + '%', GREEN, true); add(' at ', GREY); add(money(l.price), INK, true);
    });
    add('.', GREY);
  }
  return <span style={{ display: 'inline', lineHeight: 1.62 }}>{seg.map((x, i) => <span key={i} style={{ color: x.col, fontWeight: x.mono ? 700 : 600, fontFamily: x.mono ? MONO : 'inherit', fontVariantNumeric: x.mono ? 'tabular-nums' : 'normal' }}>{x.s}</span>)}</span>;
}
function ThesisField({ f, i, d, c }: { f: ThesisFieldDef; i: number; d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  const [foc, setFoc] = useState(false);
  const isTarget = f.k === 'targetNote';
  // Tab on an empty field accepts the placeholder suggestion (the composed sentence for Target/exit).
  const onTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value) {
      const sug = isTarget ? targetPlainText(c) : e.currentTarget.placeholder;
      if (sug) { e.preventDefault(); planActions.setDraft({ [f.k]: sug } as Partial<PlanDraft>); }
    }
  };
  const empty = !String(d[f.k] ?? '');
  return (
    <div style={{ padding: '11px 16px', borderBottom: i < 3 ? '1px solid #f3f1f7' : 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#1a1813' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: f.dot }} />{f.lab}
      </span>
      <div style={{ position: 'relative' }}>
        <textarea value={String(d[f.k] ?? '')} onChange={(e) => planActions.setDraft({ [f.k]: e.target.value } as Partial<PlanDraft>)} onKeyDown={onTab} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} placeholder={isTarget ? '' : f.ph}
          style={{ position: 'relative', zIndex: 1, width: '100%', boxSizing: 'border-box', minHeight: 54, fieldSizing: 'content', resize: 'vertical', padding: '8px 11px', border: 'none', borderRadius: 10, background: foc ? f.tint : 'transparent', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, color: '#26221c', outline: 'none', lineHeight: 1.62, transition: 'background .15s' } as CSSProperties} />
        {isTarget && empty ? <div style={{ position: 'absolute', left: 0, top: 0, padding: '8px 11px', fontSize: 13.5, lineHeight: 1.62, pointerEvents: 'none', zIndex: 0 }}><TargetPlaceholder c={c} /></div> : null}
      </div>
    </div>
  );
}
function Thesis({ d, c }: { d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{THESIS_FIELDS.map((f, i) => <ThesisField key={f.k} f={f} i={i} d={d} c={c} />)}</div>;
}

// ── Planned-window date RANGE picker (Notion-style start→end) ─────────────────
// Trigger chip in the Theory name row; portaled calendar with hover preview.
function ExpectedDate({ d }: { d: PlanDraft }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => setMounted(true), []);

  const toISO = (dt: Date) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const parse = (s?: string): Date | null => { if (!s) return null; const p = String(s).split('-'); return new Date(+p[0], (+p[1]) - 1, +p[2]); };
  const dayN = (x: Date | null): number | null => (x ? new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() : null);
  const sameDay = (a: Date | null, b: Date | null) => !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
  const today = new Date();
  const start = parse(d.startDate);
  const sel = parse(d.tradeDate);
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const vw = view || (sel ? { y: sel.getFullYear(), m: sel.getMonth() } : { y: today.getFullYear(), m: today.getMonth() });

  const pick = (dt: Date) => {
    const iso = toISO(dt);
    if (!start || (start && sel)) { planActions.setDraft({ startDate: iso, tradeDate: '' }); setHover(null); }
    else if ((dayN(dt) as number) < (dayN(start) as number)) { planActions.setDraft({ startDate: iso }); }
    else { planActions.setDraft({ tradeDate: iso }); setOpen(false); setHover(null); }
  };

  const hasVal = !!(start || sel);
  const holdDays = (start && sel) ? Math.round(((dayN(sel) as number) - (dayN(start) as number)) / 86400000) : null;
  const holdTxt = holdDays != null ? (holdDays === 0 ? 'same day' : holdDays === 1 ? '1 day hold' : holdDays + ' days hold') : null;
  const fmtD = (x: Date) => MONS[x.getMonth()] + ' ' + x.getDate();
  const bigLabel = (start && sel) ? (fmtD(start) + '  →  ' + (start.getMonth() === sel.getMonth() ? String(sel.getDate()) : fmtD(sel))) : (start ? (fmtD(start) + '  →  ?') : (sel ? fmtD(sel) : 'Set dates'));

  // Portal the calendar to <body> — the Theory group has overflow:hidden which would
  // otherwise clip it. Position below-right of the chip from its live rect.
  const toggle = () => {
    if (!open && btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 9, right: Math.max(8, window.innerWidth - r.right) }); setView(vw); }
    setOpen((v) => !v);
  };

  // grid
  const first = new Date(vw.y, vw.m, 1);
  const gridStart = new Date(vw.y, vw.m, 1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { const dt = new Date(gridStart); dt.setDate(gridStart.getDate() + i); cells.push(dt); }
  const hov = (start && !sel && hover) ? parse(hover) : null;
  const pEnd = sel || ((hov && (dayN(hov) as number) > (dayN(start) as number)) ? hov : null);

  return (
    <div style={{ position: 'relative', flex: '0 0 auto' }}>
      <button ref={btnRef} onClick={toggle} className={'tpdatechip' + (hasVal ? ' on' : '')} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 2px 2px 12px', borderRadius: 12, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1, transition: 'background .14s' }}>
        <span style={{ fontWeight: 800, fontSize: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b3aea2', marginBottom: 5 }}>{hasVal ? 'Planned window' : 'Expected'}</span>
        <span style={{ fontFamily: 'var(--font-news), Newsreader, serif', fontWeight: 500, fontSize: hasVal ? 21 : 16, color: hasVal ? '#7c5cff' : '#b6b1a7', lineHeight: 0.95, letterSpacing: 0, whiteSpace: 'nowrap' }}>{bigLabel}</span>
        {holdTxt ? <span style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace', fontWeight: 600, fontSize: 11, color: '#7c5cff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{holdTxt}</span> : null}
      </button>
      {open && mounted && pos ? createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 201, width: 288, boxSizing: 'border-box', background: '#fff', border: '1px solid #ecebe6', borderRadius: 14, boxShadow: '0 14px 40px -12px rgba(20,20,12,0.28)', padding: 16, animation: 'pkUp .16s ease both' }}>
            <style>{`@keyframes pkUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{MON[vw.m] + ' ' + vw.y}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['p', 'n'] as const).map((dir) => (
                  <button key={dir} onClick={() => setView({ y: vw.y, m: vw.m + (dir === 'n' ? 1 : -1) })} style={{ width: 27, height: 27, borderRadius: 8, border: '1px solid #efedea', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#56524b' }}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d={dir === 'n' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i} style={{ textAlign: 'center', fontWeight: 700, fontSize: 10.5, color: '#b3b0a6', padding: '4px 0' }}>{w}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px 0' }}>
              {cells.map((dt, i) => {
                const inM = dt.getMonth() === vw.m, isS = sameDay(dt, start), isE = sameDay(dt, pEnd), isEnd = isS || isE, isHovEnd = !sel && isE, isT = sameDay(dt, today);
                const rng = !!(start && pEnd) && (dayN(dt) as number) > (dayN(start) as number) && (dayN(dt) as number) < (dayN(pEnd) as number);
                const rad = isS ? (pEnd ? '8px 0 0 8px' : '8px') : (isE ? (start ? '0 8px 8px 0' : '8px') : (rng ? '0' : '8px'));
                return (
                  <button key={i} onClick={() => pick(dt)} onMouseEnter={() => { if (start && !sel) setHover(toISO(dt)); }}
                    style={{ height: 32, borderRadius: rad, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: (isEnd || isT) ? 800 : 600, fontSize: 12.5,
                      background: isEnd ? (isHovEnd ? '#9a83f5' : '#7c5cff') : (rng ? '#efe9ff' : 'transparent'), color: isEnd ? '#fff' : (inM ? '#1a1813' : '#cfcdc4'),
                      boxShadow: (isT && !isEnd) ? 'inset 0 0 0 1.5px #ddd0f7' : 'none', display: 'grid', placeItems: 'center' }}>
                    {dt.getDate()}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f2f1ed' }}>
              <button onClick={() => { planActions.setDraft({ startDate: '', tradeDate: '' }); setOpen(false); setHover(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, color: '#897f70', padding: 0 }}>Clear</button>
              {(start && pEnd)
                ? <span style={{ fontWeight: 800, fontSize: 12, color: '#7c5cff' }}>{(() => { const dd = Math.round(((dayN(pEnd) as number) - (dayN(start) as number)) / 86400000); return dd === 0 ? 'same day' : dd === 1 ? '1 day hold' : dd + ' days hold'; })()}</span>
                : <span style={{ fontWeight: 600, fontSize: 11, color: '#b3aea2' }}>{start ? 'Pick the exit date' : 'Pick the entry date'}</span>}
            </div>
          </div>
        </>, document.body) : null}
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

const MONOF = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
// ── Multi-fill entry ladder + section labels (handoff: full Levels port) ─────
function Pie({ pct, color, size = 11 }: { pct: number; color: string; size?: number }) {
  const r = 9, cx = 12, cy = 12, p = Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
  let wedge: React.ReactNode = null;
  if (p >= 99.99) wedge = <circle cx={cx} cy={cy} r={r} fill={color} />;
  else if (p > 0.01) { const ang = (p / 100) * 2 * Math.PI, ex = cx + r * Math.sin(ang), ey = cy - r * Math.cos(ang), large = p > 50 ? 1 : 0; wedge = <path d={`M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`} fill={color} />; }
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: '0 0 auto' }}><circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2.2} opacity={0.3} />{wedge}</svg>;
}

const setEntryField = (d: PlanDraft, idx: number, field: 'price' | 'pct', val: string) => {
  const ex = tpEntryRungs(d).map((r) => ({ price: r.price, pct: r.pct }));
  ex[idx] = { ...ex[idx], [field]: val };
  planActions.setDraft({ entries: ex, entryMode: 'ladder' });
};
const addEntry = (d: PlanDraft) => { const ex = tpEntryRungs(d).map((r) => ({ price: r.price, pct: r.pct })); if (ex.length >= 6) return; ex.push({ price: '', pct: '' }); planActions.setDraft({ entries: ex, entryMode: 'ladder' }); };
const removeEntry = (d: PlanDraft, idx: number) => { const ex = tpEntryRungs(d).map((r) => ({ price: r.price, pct: r.pct })); if (ex.length <= 2) return; ex.splice(idx, 1); planActions.setDraft({ entries: ex, entryMode: 'ladder' }); };

// ── scale-out level editing (writes the legacy t1/bankPct + t2/t2pct/trailPeriod + tExtra[] fields) ──
type LvlField = 'price' | 'pct' | 'trail' | 'trailLen';
const setLevelField = (d: PlanDraft, idx: number, field: LvlField, val: string) => {
  if (idx === 0) return planActions.setDraft(({ price: { t1: val }, pct: { bankPct: val }, trail: { t1trail: val }, trailLen: { t1trailLen: val } } as Record<LvlField, Partial<PlanDraft>>)[field]);
  if (idx === 1) return planActions.setDraft(({ price: { t2: val }, pct: { t2pct: val }, trail: { trailPeriod: val }, trailLen: { trailPeriodLen: val } } as Record<LvlField, Partial<PlanDraft>>)[field]);
  const ex = (Array.isArray(d.tExtra) ? d.tExtra : []).slice();
  const j = idx - 2;
  const cur = ex[j] || { price: '', pct: '', trail: '1d', trailLen: '' };
  ex[j] = { ...cur, [field]: val };
  planActions.setDraft({ tExtra: ex });
};
const bankSumNonLast = (d: PlanDraft): number => { const lv = tpLevels(d); let s = 0; lv.forEach((l, i) => { if (i < lv.length - 1) { const p = pctNum(l.pct); if (isFinite(p)) s += p; } }); return Math.min(100, s); };
const addLevel = (d: PlanDraft) => {
  const lv = tpLevels(d);
  if (lv.length >= 6) return;
  // the current last level's effective % (its own, or the remainder if blank) is split ~half with the new one
  const nonLastSum = bankSumNonLast(d);
  const lastParsed = pctNum(lv[lv.length - 1].pct);
  const lastEff = isFinite(lastParsed) ? lastParsed : Math.max(0, 100 - nonLastSum);
  const demotedPct = String(Math.max(0, Math.round(lastEff / 2)));
  const demotedIdx = lv.length - 1;
  const ex = (Array.isArray(d.tExtra) ? d.tExtra : []).slice();
  const patch: Partial<PlanDraft> = {};
  if (demotedIdx === 1) patch.t2pct = demotedPct;
  else if (demotedIdx >= 2) { const j = demotedIdx - 2; const cur = ex[j] || { price: '', pct: '', trail: '1d', trailLen: '' }; ex[j] = { ...cur, pct: demotedPct }; }
  ex.push({ price: '', pct: '', trail: '1d', trailLen: '' }); // new last level: blank pct → defaults to the remainder
  patch.tExtra = ex;
  planActions.setDraft(patch);
};
const removeLevel = (d: PlanDraft, idx: number) => { if (idx < 2) return; const ex = (Array.isArray(d.tExtra) ? d.tExtra : []).slice(); ex.splice(idx - 2, 1); planActions.setDraft({ tExtra: ex }); };

function EntryLadder({ d }: { d: PlanDraft }) {
  const PURP = '#7c5cff', INK = '#1a1813';
  const rungs = tpEntryRungs(d);
  const parsed = rungs.map((r) => pctNum(r.pct));
  const nonLast = parsed.slice(0, -1).reduce((s, p) => s + (isFinite(p) ? p : 0), 0);
  const rem = Math.max(0, 100 - nonLast);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 12px' }}>
      {rungs.map((r, idx) => {
        const pctPh = r.isLast ? String(Math.round(rem)) : '50';
        return (
          <div key={'en' + idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.05em', color: PURP, paddingLeft: 3 }}>{'Fill ' + (idx + 1)}</span>
              {idx >= 2 ? <button onClick={() => removeEntry(d, idx)} title="Remove fill" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 0, margin: 0, cursor: 'pointer', color: '#c4c1b8', flex: '0 0 auto' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={9} /><path d="M8 12h8" /></svg></button> : null}
            </div>
            <div className="tpsplit" style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e7e3dc', borderRadius: 12, background: '#fdfdff', overflow: 'hidden' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: 13, color: '#cbc9c0' }}>$</span>
                <input value={tpFmtNum(r.price)} onChange={(e) => setEntryField(d, idx, 'price', e.target.value.replace(/,/g, ''))} inputMode="decimal" placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 3px 8px 22px', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.02em', color: INK, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderLeft: '1px solid #e6def8', background: '#f4f1fd', padding: '0 8px', flex: '0 0 auto' }}>
                <Pie pct={isFinite(parsed[idx]) ? parsed[idx] : (r.isLast ? rem : 0)} color={PURP} />
                <input value={r.pct || ''} onChange={(e) => setEntryField(d, idx, 'pct', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value && e.currentTarget.placeholder) { e.preventDefault(); setEntryField(d, idx, 'pct', e.currentTarget.placeholder); } }} inputMode="numeric" placeholder={pctPh} style={{ width: 25, textAlign: 'right', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: PURP, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                <span style={{ fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: PURP }}>%</span>
              </div>
            </div>
          </div>
        );
      })}
      {rungs.length < 6 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 10.5, paddingLeft: 3, visibility: 'hidden' }}>+</span>
          <button onClick={() => addEntry(d)} aria-label="Add fill" title="Add another fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 39, border: '1px dashed #d8cff2', background: '#f7f5fe', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 11, letterSpacing: '0.01em', color: PURP }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>Add fill
          </button>
        </div>
      ) : null}
    </div>
  );
}

function EntryTotals({ d, c }: { d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  const PURP = '#7c5cff';
  const rungs = tpEntryRungs(d);
  const parsed = rungs.map((r) => pctNum(r.pct));
  const nonLast = parsed.slice(0, -1).reduce((s, p) => s + (isFinite(p) ? p : 0), 0);
  const rem = Math.max(0, 100 - nonLast);
  const total = Math.round(rungs.reduce((s, r, i) => s + (r.isLast ? (isFinite(parsed[i]) ? parsed[i] : rem) : (isFinite(parsed[i]) ? parsed[i] : 0)), 0));
  const bad = total !== 100;
  const avg = isFinite(c.E) ? tpMoney(c.E, c.E < 1000 ? 2 : 0) : '—';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 10.5, color: '#8f8a7f' }}>Avg <b style={{ color: PURP, fontWeight: 800, fontFamily: MONOF }}>{avg}</b></span>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d1c6' }} />
      <span style={{ fontWeight: 600, fontSize: 10.5, color: bad ? '#c0492f' : '#8f8a7f' }}>Fills <b style={{ color: bad ? '#df5338' : PURP, fontWeight: 800, fontFamily: MONOF }}>{total + '%'}</b></span>
    </span>
  );
}

function BanksTotal({ c }: { c: ReturnType<typeof tpCompute> }) {
  const pctTotal = Math.round(c.pctTotal || 0);
  const bad = pctTotal !== 100;
  return <span style={{ fontWeight: 600, fontSize: 10.5, color: bad ? '#c0492f' : '#8f8a7f' }}>Banks <b style={{ color: bad ? '#df5338' : '#1f9d55', fontWeight: 800, fontFamily: MONOF }}>{pctTotal + '%'}</b>{bad ? ' · aim 100%' : ''}</span>;
}

const secTipTitle = (t: string) => <span style={{ display: 'block', fontWeight: 800, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8577', marginBottom: 3 }}>{t}</span>;
const ENTRY_TIP = <span>{secTipTitle('Limit-ladder in · where to place your rungs')}{['Broken resistance now flipped to support — the top of the band', 'The 0.5 / 0.618 fib retracement', 'A prior swing low', 'The 20 / 50 MA if price is riding it', 'A round number (60k, 62.5k)'].map((l, i) => <span key={i} style={{ display: 'block', marginTop: 3 }}>{l}</span>)}<span style={{ display: 'block', marginTop: 3 }}>A liquidation magnet or wall — your heatmap’s <b>Nearest magnet ↓</b> and <b>Strongest wall</b> are natural lower rungs</span></span>;
const RISK_TIP = <span>{secTipTitle('Stop & liquidation')}<span style={{ display: 'block', marginTop: 3 }}>Stop loss is your planned exit if the idea is wrong.</span><span style={{ display: 'block', marginTop: 3 }}>Liquidation is the exchange’s forced close — set by leverage. Keep your stop well clear of it.</span></span>;
const TARGETS_TIP = <span>{secTipTitle('Bank & trail out')}<span style={{ display: 'block', marginTop: 3 }}>Bank a fixed slice of the position at each target price.</span><span style={{ display: 'block', marginTop: 3 }}>Trail the rest up on your chosen timeframe / Donchian channel to ride the move.</span></span>;

function SectionHeader({ text, color, tip, right }: { text: string; color: string; tip: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color, whiteSpace: 'nowrap' }}>
        <HoverTip tip={tip} width={308}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, cursor: 'help', color, letterSpacing: '0.06em', fontWeight: 800 }}>
            <span>{text}</span>
            <span style={{ height: 2, width: '100%', background: color, borderRadius: 2 }} />
          </span>
        </HoverTip>
      </span>
      <span style={{ flex: 1, height: 1, background: '#efece6', minWidth: 12 }} />
      {right}
    </div>
  );
}

function LiqCell({ d, c }: { d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  // Auto liquidation from the current entry (falls back to the live mark before an entry is typed),
  // so the cell always previews where liq sits at this leverage. Editing leverage is the only mover.
  const L = tpNum(d.lev) || 5;
  const E = c.E;
  const lq = isFinite(E) && E > 0 ? (d.dir === 'long' ? E * (1 - 1 / L) : E * (1 + 1 / L)) : NaN;
  const liqVal = isFinite(lq) ? tpFmtNum(String(Math.round(lq))) : '';
  const pctTxt = isFinite(E) && E > 0 ? '-' + Math.round((100 / L) * 10) / 10 + '%' : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a294' }}>Liquidation <span style={{ color: '#c8c3b8' }}>· auto from {tpNum(d.lev) || 5}×</span></span>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: 13, color: '#cdcabf' }}>$</span>
        <input value={liqVal} readOnly tabIndex={-1} inputMode="decimal" placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 48px 8px 22px', border: '1px solid #eeeae3', borderRadius: 12, fontFamily: MONOF, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.02em', color: '#938d82', background: '#f7f6f3', outline: 'none', fontVariantNumeric: 'tabular-nums', cursor: 'default' }} />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: MONOF, fontWeight: 700, fontSize: 11, color: '#b7b1a5', pointerEvents: 'none' }}>{pctTxt}</span>
      </div>
    </div>
  );
}

function DirLevHeading({ d }: { d: PlanDraft }) {
  const isShort = d.dir === 'short', dc = isShort ? '#df5338' : '#1f9d55';
  const lev = (tpNum(d.lev) || 5) + '×';
  let holdSeg: React.ReactNode = null;
  if (d.tradeDate) {
    const pp = String(d.tradeDate).split('-'); const sel = new Date(+pp[0], +pp[1] - 1, +pp[2]);
    let st: Date;
    if (d.startDate) { const sp = String(d.startDate).split('-'); st = new Date(+sp[0], +sp[1] - 1, +sp[2]); }
    else { const n = new Date(); st = new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
    const days = Math.round((sel.getTime() - st.getTime()) / 86400000);
    if (!isNaN(days) && days >= 0) {
      const txt = days === 0 ? 'today' : days >= 14 ? '~' + Math.round(days / 7) + 'w' : '~' + days + 'd';
      holdSeg = <><span style={{ color: '#c9c5bb', margin: '0 1px' }}>·</span><svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={9} /><path d="M12 7.5V12l3 1.8" /></svg><span style={{ color: '#7c5cff' }}>{txt}</span></>;
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 24, letterSpacing: '-0.025em', lineHeight: 1.08 }}>
      <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={dc} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}>{isShort ? <><path d="M22 17 13.5 8.5l-5 5L2 7" /><path d="M16 17h6v-6" /></> : <><path d="M22 7 13.5 15.5l-5-5L2 17" /><path d="M16 7h6v6" /></>}</svg>
      <span style={{ color: dc }}>{isShort ? 'Short' : 'Long'}</span>
      <span style={{ color: '#c9c5bb', margin: '0 1px' }}>·</span>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="#1a1813" stroke="none" style={{ flex: '0 0 auto' }}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
      <span style={{ color: '#1a1813' }}>{lev}</span>
      {holdSeg}
    </span>
  );
}

// portaled dropdown shell (anchored to a chevron rect), avoids the Setup sheet's overflow clip
function LvlPortal({ pos, onClose, panelStyle, children }: { pos: { top: number; left?: number; right?: number }; onClose: () => void; panelStyle?: CSSProperties; children: React.ReactNode }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
      <div style={{ position: 'fixed', top: pos.top, left: pos.left, right: pos.right, zIndex: 201, background: '#fff', border: '1px solid #ece9e3', borderRadius: 11, boxShadow: '0 14px 34px -10px rgba(30,20,10,.26)', ...panelStyle }}>{children}</div>
    </>, document.body);
}
const GRN = '#1f9d55';
const BANK_OPTS: { v: string; hint?: string }[] = [{ v: '25' }, { v: '50' }, { v: '70', hint: 'default' }, { v: '100', hint: 'all' }];
const TRAIL_TF_OPTS: { v: string; hint?: string }[] = [{ v: '15m' }, { v: '1h' }, { v: '4h' }, { v: '1d', hint: 'daily' }];
const TRAIL_LEN_OPTS: { v: string }[] = [{ v: '3' }, { v: '5' }, { v: '8' }, { v: '10' }];
const chkIcon = (col: string) => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 6" /></svg>;

// ── Targets = scale-out bank ladder (each row: trail·Donchian | $price/reward | bank%), ported from tpTargetsUI ──
function TargetsLadder({ d, c }: { d: PlanDraft; c: ReturnType<typeof tpCompute> }) {
  const raw = tpLevels(d);
  const levels: Level[] = c.levels || [];
  const [menu, setMenu] = useState<{ idx: number; kind: 'bank' | 'trail'; pos: { top: number; left?: number; right?: number } } | null>(null);
  const [unitMap, setUnitMap] = useState<Record<number, 'price' | 'reward'>>({});
  const [rewEdit, setRewEdit] = useState<{ idx: number; text: string } | null>(null);
  const closeMenu = () => setMenu(null);
  const openMenu = (e: React.MouseEvent, idx: number, kind: 'bank' | 'trail') => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu((m) => (m && m.idx === idx && m.kind === kind ? null : { idx, kind, pos: { top: r.bottom + 6, left: kind === 'trail' ? r.left : undefined, right: kind === 'bank' ? Math.max(8, window.innerWidth - r.right) : undefined } }));
  };
  const chev = (idx: number, kind: 'bank' | 'trail', col: string) => (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openMenu(e, idx, kind); }} aria-label={kind + ' presets'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: '2px 0 2px 1px', margin: 0, cursor: 'pointer', color: col }}>
      <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
  const trailIcon = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={6} cy={19} r={3} /><circle cx={18} cy={5} r={3} /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /></svg>;

  const row = (idx: number) => {
    const rl = raw[idx], cl = levels[idx] || ({} as Level);
    const isLastRow = idx === levels.length - 1;
    const pctPh = isLastRow ? String(Math.round(c.runnerPct || 0)) : '70';
    const unit = unitMap[idx] === 'reward' ? 'reward' : 'price';
    const toggleUnit = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setUnitMap((m) => ({ ...m, [idx]: unit === 'reward' ? 'price' : 'reward' })); };
    const solveRew = (num: number) => { const frac = (pctNum(rl.pct) || (isLastRow ? c.runnerPct || 0 : 70)) / 100; const qty = c.qty, E = c.E; if (isFinite(num) && frac > 0 && isFinite(qty) && qty > 0 && isFinite(E) && E > 0) { const price = d.dir === 'long' ? E + num / (qty * frac) : E - num / (qty * frac); setLevelField(d, idx, 'price', String(Math.round(price))); } };
    const rewDisp = cl.rewardUSD != null && isFinite(cl.rewardUSD) ? tpFmtNum(String(Math.round(cl.rewardUSD))) : '';
    const rewShown = rewEdit && rewEdit.idx === idx ? rewEdit.text : rewDisp;

    const trailSeg = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, borderRight: '1px solid #dcefe4', background: '#f1f9f4', padding: '0 3px 0 6px', flex: '0 0 auto' }}>
        {trailIcon}
        <input value={rl.trail || ''} onChange={(e) => setLevelField(d, idx, 'trail', e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 4))} onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value && e.currentTarget.placeholder) { e.preventDefault(); setLevelField(d, idx, 'trail', e.currentTarget.placeholder); } }} placeholder="1d" style={{ width: 20, textAlign: 'center', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 11.5, color: GRN, outline: 'none' }} />
        <span style={{ color: '#b7d7c6', fontWeight: 800, fontSize: 11 }}>·</span>
        <input value={rl.trailLen || ''} onChange={(e) => setLevelField(d, idx, 'trailLen', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value && e.currentTarget.placeholder) { e.preventDefault(); setLevelField(d, idx, 'trailLen', e.currentTarget.placeholder); } }} inputMode="numeric" placeholder="20" title="Donchian length (bars)" style={{ width: 20, textAlign: 'center', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 11.5, color: GRN, outline: 'none' }} />
        {chev(idx, 'trail', GRN)}
      </div>
    );
    const priceInner = (
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <button onClick={toggleUnit} title="Toggle price / reward $" style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', alignItems: 'center', border: 'none', background: 'transparent', padding: 3, cursor: 'pointer', fontFamily: MONOF, fontWeight: 800, fontSize: 13, lineHeight: 1, color: unit === 'reward' ? GRN : '#cbc9c0' }}>{unit === 'reward' ? '+$' : '$'}</button>
        {unit === 'reward'
          ? <input value={rewShown} onChange={(e) => { const t = e.target.value; setRewEdit({ idx, text: t }); solveRew(parseFloat(t.replace(/[^0-9.]/g, ''))); }} onBlur={() => setRewEdit(null)} inputMode="numeric" placeholder="0" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 3px 8px 31px', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.02em', color: GRN, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
          : <input value={tpFmtNum(rl.price)} onChange={(e) => setLevelField(d, idx, 'price', e.target.value.replace(/,/g, ''))} inputMode="decimal" placeholder="0.00" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 3px 8px 23px', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 600, fontSize: 13.5, letterSpacing: '-0.02em', color: '#1a1813', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />}
      </div>
    );
    const bankChip = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, borderLeft: '1px solid #d5ebdf', background: '#eef7f1', padding: '0 3px 0 6px', flex: '0 0 auto' }}>
        <Pie pct={isFinite(cl.pct) ? cl.pct : (pctNum(rl.pct) || (isLastRow ? c.runnerPct : 70))} color={GRN} />
        <input value={rl.pct || ''} onChange={(e) => setLevelField(d, idx, 'pct', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && !e.currentTarget.value && e.currentTarget.placeholder) { e.preventDefault(); setLevelField(d, idx, 'pct', e.currentTarget.placeholder); } }} inputMode="numeric" placeholder={pctPh} style={{ width: 25, textAlign: 'right', border: 'none', background: 'transparent', fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: GRN, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: GRN }}>%</span>
        {chev(idx, 'bank', GRN)}
      </div>
    );
    const removeBtn = idx >= 2 ? <button onClick={() => removeLevel(d, idx)} title="Remove level" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', padding: 0, margin: 0, cursor: 'pointer', color: '#c4c1b8', flex: '0 0 auto' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={9} /><path d="M8 12h8" /></svg></button> : null;
    const rewPills = unit === 'reward' ? (
      <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>{[100000, 150000, 200000].map((v) => { const on = Math.round(cl.rewardUSD) === v; return <button key={v} onClick={() => { setRewEdit(null); solveRew(v); }} style={{ flex: 1, border: '1px solid ' + (on ? GRN : '#cbe7d6'), background: on ? GRN : '#f2faf5', color: on ? '#fff' : GRN, borderRadius: 8, padding: '3px 0', cursor: 'pointer', fontFamily: MONOF, fontWeight: 800, fontSize: 10.5 }}>{'$' + v / 1000 + 'k'}</button>; })}</div>
    ) : null;
    return (
      <div key={'lv' + idx} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.05em', color: GRN, paddingLeft: 3 }}>{'TP' + (idx + 1)}</span>{removeBtn}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e7e3dc', borderRadius: 12, background: '#fbfdfb', overflow: 'hidden' }}>{trailSeg}{priceInner}{bankChip}</div>
        </div>
        {rewPills}
      </div>
    );
  };

  const optRow = (active: boolean, label: string, hint: string | undefined, onClick: () => void, accent: string, accentBg: string) => (
    <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, border: 'none', background: active ? accentBg : 'transparent', borderRadius: 7, padding: '7px 9px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}><span style={{ fontFamily: MONOF, fontWeight: 800, fontSize: 12.5, color: active ? accent : '#3a352c' }}>{label}</span>{hint ? <span style={{ fontSize: 9.5, fontWeight: 600, color: '#a8a69b' }}>{hint}</span> : null}</span>
      {active ? chkIcon(accent) : null}
    </button>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px 12px' }}>
      {levels.map((_, idx) => row(idx))}
      {levels.length < 6 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 10.5, paddingLeft: 3, visibility: 'hidden' }}>+</span>
          <button onClick={() => addLevel(d)} aria-label="Add level" title="Add another level" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 39, border: '1px dashed #cbe4d5', background: '#f6fbf8', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 11, letterSpacing: '0.01em', color: GRN }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>Add level
          </button>
        </div>
      ) : null}
      {menu && menu.kind === 'bank' ? (
        <LvlPortal pos={menu.pos} onClose={closeMenu} panelStyle={{ padding: 5, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontFamily: 'inherit', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#b3aea2', padding: '4px 9px 5px' }}>Bank % of position</div>
          {BANK_OPTS.map((o) => optRow(String(raw[menu.idx].pct || '') === o.v, o.v + '%', o.hint, () => { setLevelField(d, menu.idx, 'pct', o.v); closeMenu(); }, GRN, '#eaf6ef'))}
        </LvlPortal>
      ) : null}
      {menu && menu.kind === 'trail' ? (
        <LvlPortal pos={menu.pos} onClose={closeMenu} panelStyle={{ padding: 6, display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 104 }}>
            <div style={{ fontFamily: 'inherit', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b3aea2', padding: '2px 8px 5px' }}>Timeframe</div>
            {TRAIL_TF_OPTS.map((o) => optRow((raw[menu.idx].trail || '1d') === o.v, o.v, o.hint, () => { setLevelField(d, menu.idx, 'trail', o.v); closeMenu(); }, GRN, '#eaf6ef'))}
          </div>
          <div style={{ width: 1, background: '#f1efe9', margin: '4px 2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 104 }}>
            <div style={{ fontFamily: 'inherit', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b3aea2', padding: '2px 8px 5px' }}>Donchian length</div>
            {TRAIL_LEN_OPTS.map((o) => optRow(String(raw[menu.idx].trailLen || '') === o.v, o.v + '-bar', undefined, () => { setLevelField(d, menu.idx, 'trailLen', o.v); closeMenu(); }, GRN, '#eaf6ef'))}
          </div>
        </LvlPortal>
      ) : null}
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
// top stats strip (ported from tp4aStrip): Risk · Reward·plan · R:R · Position · Margin · Stop-vs-liq.
// Reward + R:R are generalized multi-slice — one bar segment per scale-out level (empty until priced).
function EquityStrip({ c, d }: { c: ReturnType<typeof tpCompute>; d: PlanDraft }) {
  const GREEN = '#1f9d55', RED = '#df5338', ORANGE = '#ff7a00', INK = '#1a1813', PURP = '#7c5cff';
  const MO = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";
  const money = (v: number, dec = 0) => (isFinite(v) ? tpMoney(v, dec) : '—');
  const slices = (c.levels || []).filter((l) => isFinite(l.rewardUSD));
  const denom = slices.reduce((s, l) => s + (l.rewardUSD > 0 ? l.rewardUSD : 0), 0);
  const segCol = (l: Level) => (l.isRunner ? '#57c98a' : GREEN);
  const totalReward = c.planReward, hasReward = c.planRewardHas, planR = c.planR;
  const rrStr = isFinite(planR) ? planR.toFixed(2) : '—';
  const rrColor = !isFinite(planR) ? '#b3b0a6' : planR >= 2.5 ? GREEN : planR >= 1.5 ? '#c9821f' : RED;
  const rrVerd = !isFinite(planR) ? 'Set levels' : planR >= 2.5 ? 'Strong edge' : planR >= 1.5 ? 'Fair edge' : 'Thin edge';

  const lbl = (t: string, col?: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#a29b8c' }}>{col ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flex: '0 0 auto' }} /> : null}{t}</span>;
  const sub = (txt: string, col = '#b6a99e') => <span style={{ fontFamily: MO, fontWeight: 700, fontSize: 11, color: col, marginTop: 4 }}>{txt}</span>;
  const cellS = (flex: number, minW: number): CSSProperties => ({ flex: `${flex} 1 ${minW}px`, minWidth: minW, padding: '11px 20px', background: '#fff', display: 'flex', flexDirection: 'column' });
  const moveIcon = (col: string, upDir: boolean) => <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke={col} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d={upDir ? 'M2 11L6 7.5L9 9L14 4' : 'M2 5L6 8.5L9 7L14 12'} /><path d={upDir ? 'M10 4H14V8' : 'M10 12H14V8'} /></svg>;
  const eqIcon = (col: string) => <svg width={12} height={12} viewBox="0 0 16 16" fill={col} style={{ flex: '0 0 auto' }}><rect x={1} y={3.5} width={14} height={9} rx={1.6} /><circle cx={8} cy={8} r={1.9} fill="#fff" /><circle cx={3.4} cy={8} r={0.7} fill="#fff" /><circle cx={12.6} cy={8} r={0.7} fill="#fff" /></svg>;
  const bignum = (txt: string, col: string) => <span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: col, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1 }}>{txt}</span>;
  const rightStack = (rows: React.ReactNode[]) => <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>{rows.map((r, i) => (r ? <span key={i} style={{ display: 'contents' }}>{r}</span> : null))}</div>;
  const pctChip = (icon: React.ReactNode, txt: string, col: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{icon}<span style={{ fontFamily: MO, fontWeight: 700, fontSize: 12, color: col, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{txt}</span></span>;

  // Reward · plan — total headline + one bar segment / legend entry per priced level
  let finalMove = NaN; (c.levels || []).forEach((l) => { if (l.hasPrice && isFinite(l.distPct)) { if (!isFinite(finalMove) || l.distPct > finalMove) finalMove = l.distPct; } });
  const rewEqPct = isFinite(totalReward) && isFinite(c.Q) && c.Q > 0 ? (totalReward / c.Q) * 100 : NaN;
  const sliceBar = slices.length ? (
    <div style={{ display: 'flex', gap: 3, height: 8, marginTop: 7 }}>{slices.map((l, idx) => { const share = denom > 0 ? Math.max(0, l.rewardUSD) / denom : 0; return share > 0 ? <div key={idx} style={{ flexGrow: share, flexShrink: 1, flexBasis: 0, minWidth: 2, background: segCol(l), borderRadius: 99 }} /> : null; })}</div>
  ) : null;
  const sliceLegend = slices.length ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>{slices.map((l, idx) => (
      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, alignItems: idx === 0 ? 'flex-start' : idx === slices.length - 1 ? 'flex-end' : 'center' }}>
        <span style={{ fontFamily: MO, fontWeight: 700, fontSize: 12, color: '#3f7355', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isFinite(l.rewardUSD) ? '+' + money(l.rewardUSD) : '—'}</span>
        <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#a8a294', whiteSpace: 'nowrap' }}>{(l.isRunner ? 'Run' : 'TP' + l.i) + ' · ' + Math.round(l.pct) + '%'}</span>
      </div>
    ))}</div>
  ) : null;

  // R:R — per-level R strip + values
  const rLevels = (c.levels || []).filter((l) => isFinite(l.r));
  const rTotal = rLevels.reduce((s, l) => s + (l.r > 0 ? l.r : 0), 0);
  const rrBar = rLevels.length ? (
    <div style={{ display: 'flex', gap: 3, height: 8, marginTop: 7 }}>{rLevels.map((l, idx) => { const share = rTotal > 0 ? Math.max(0, l.r) / rTotal : 0; return share > 0 ? <div key={idx} style={{ flexGrow: share, flexShrink: 1, flexBasis: 0, minWidth: 2, background: idx % 2 ? '#57c98a' : GREEN, borderRadius: 99 }} /> : null; })}</div>
  ) : null;
  const rrBreak = rLevels.length ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>{rLevels.map((l, idx) => <span key={idx} style={{ fontFamily: MO, fontWeight: 700, fontSize: 12, color: '#3f7355', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.r.toFixed(2) + 'R'}</span>)}</div>
  ) : null;

  // stop-vs-liq geometry
  const price = c.mkt.mark;
  const liqDist = isFinite(c.liq) ? (Math.abs(price - c.liq) / price) * 100 : NaN;
  const stopDist = isFinite(c.S) ? (Math.abs(price - c.S) / price) * 100 : NaN;
  const cushion = isFinite(liqDist) && isFinite(stopDist) && stopDist > 0 ? liqDist / stopDist : NaN;
  const verd = !isFinite(cushion) ? { t: '—', c: '#b3b0a6' } : cushion >= 3 ? { t: 'Clear of liq', c: GREEN } : cushion >= 1.5 ? { t: 'Near liq', c: '#c9821f' } : { t: 'Close to liq', c: RED };
  const stopPos = isFinite(liqDist) && isFinite(stopDist) && liqDist > 0 ? Math.max(6, Math.min(94, (1 - stopDist / liqDist) * 100)) : 50;
  const tdot = (left: number, col: string) => <span style={{ position: 'absolute', left: left + '%', top: '50%', width: 12, height: 12, borderRadius: '50%', background: '#fff', border: '3px solid ' + col, transform: 'translate(-50%,-50%)', boxShadow: '0 1px 3px rgba(20,20,12,0.25)' }} />;

  return (
    <div style={{ background: '#fff', border: '1px solid #efedf3', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden', position: 'relative', zIndex: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 1, background: '#f1eff5' }}>
        {/* Risk */}
        <div style={cellS(1.15, 232)}>{lbl('Risk', RED)}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>{bignum(isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : '—', RED)}{rightStack([
            isFinite(c.distStopPct) ? pctChip(moveIcon('#c56a5a', !c.isLong), c.distStopPct.toFixed(2) + '%', '#c56a5a') : null,
            isFinite(c.riskPct) ? pctChip(eqIcon(PURP), c.riskPct.toFixed(2) + '%', PURP) : null,
          ])}</div>
        </div>
        {/* Reward · plan */}
        <div style={cellS(1.8, 250)}>{lbl('Reward · plan', GREEN)}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>{bignum(hasReward ? '+' + money(totalReward) : '—', GREEN)}{rightStack([
            isFinite(finalMove) ? pctChip(moveIcon('#4f9e6f', c.isLong), finalMove.toFixed(2) + '%', '#4f9e6f') : null,
            isFinite(rewEqPct) ? pctChip(eqIcon(PURP), rewEqPct.toFixed(2) + '%', PURP) : null,
          ])}</div>
          {sliceBar}{sliceLegend}
        </div>
        {/* R:R */}
        <div style={cellS(1, 140)}>{lbl('R : R')}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 6 }}><span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: rrColor, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{rrStr}</span><span style={{ fontFamily: MO, fontWeight: 700, fontSize: 11, color: rrColor, whiteSpace: 'nowrap', flex: '0 0 auto' }}>{rrVerd}</span></div>
          {rrBar}{rrBreak}
        </div>
        {/* Position */}
        <div style={cellS(0.8, 150)}>{lbl('Position', PURP)}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}><span style={{ fontFamily: MO, fontWeight: 800, fontSize: 23, letterSpacing: '-0.025em', color: INK, fontVariantNumeric: 'tabular-nums' }}>{isFinite(c.qty) ? c.qty.toFixed(c.qty < 10 ? 3 : 2) : '—'}</span><CoinIcon sym={d.sym} /></span>
          {sub(isFinite(c.notional) ? 'Notional · ' + money(c.notional) : '—')}
        </div>
        {/* Margin */}
        <div style={cellS(1.4, 172)}>{lbl('Margin', PURP)}
          <span style={{ fontFamily: MO, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: INK, marginTop: 7, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{isFinite(c.margin) ? money(c.margin) : '—'}{isFinite(c.marginPct) ? <span style={{ color: PURP, margin: '0 0 0 4px' }}>{'· ' + c.marginPct.toFixed(0) + '%'}</span> : null}</span>
          <span style={{ height: 8, borderRadius: 99, background: '#f0efeb', overflow: 'hidden', display: 'block', marginTop: 8 }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, c.marginPct || 0)) + '%', background: PURP, borderRadius: 99 }} /></span>
        </div>
        {/* Stop vs liq */}
        <div style={cellS(1.6, 210)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{lbl('Stop vs liq', ORANGE)}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: verd.c, fontWeight: 800, fontSize: 10 }}>{verd.t}</span></div>
          <div style={{ position: 'relative', height: 9, borderRadius: 99, background: ORANGE, marginTop: 11 }}><div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '9%', background: RED, borderRadius: '0 99px 99px 0' }} />{tdot(2, ORANGE)}{tdot(stopPos, RED)}{tdot(99, PURP)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontFamily: MO, fontWeight: 700, fontSize: 10.5 }}><span style={{ color: ORANGE }}>LIQ {isFinite(c.liq) ? money(c.liq) : '—'}</span><span style={{ color: RED }}>STOP {isFinite(c.S) ? money(c.S) : '—'}</span><span style={{ color: PURP }}>{money(price)}</span></div>
        </div>
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
  // hovered risk-mode cell (shows the "riding to liquidation" hint when no stop is set)
  const [sizeTip, setSizeTip] = useState<string | null>(null);

  // collapsible sections + expand-all per group (persisted)
  const [secOpen, setSecOpen] = useState<Record<SecKey, boolean>>(() => {
    try { const s = localStorage.getItem('tdplan_ed_open'); if (s) return { ...SEC_DEFAULT, ...JSON.parse(s) }; } catch { /* ignore */ }
    return SEC_DEFAULT;
  });
  useEffect(() => { try { localStorage.setItem('tdplan_ed_open', JSON.stringify(secOpen)); } catch { /* ignore */ } }, [secOpen]);
  // exclusive accordion (dc.html tpAcc): clicking a subsection closes every sibling in
  // its group and toggles the clicked one — only one open per column at a time.
  const toggleSec = (k: SecKey) => setSecOpen((o) => {
    const group: SecKey[] = k === 'thesis' || k === 'chart' ? ['thesis', 'chart'] : ['identity', 'levels', 'sizing', 'leverage'];
    const wasOpen = o[k], n = { ...o };
    group.forEach((g) => (n[g] = false));
    n[k] = !wasOpen;
    return n;
  });
  const setGroup = (keys: SecKey[], v: boolean) => setSecOpen((o) => { const n = { ...o }; keys.forEach((k) => (n[k] = v)); return n; });
  const theoryAllOpen = secOpen.thesis && secOpen.chart;
  const setupAllOpen = secOpen.identity && secOpen.levels && secOpen.sizing && secOpen.leverage;

  const save = () => {
    if (!c.valid) return;
    const name = d.name.trim();
    const plan: Plan = editing
      ? { ...editing, ...d, name, draft: { ...d }, status: editing.status }
      : { id: 'tp_' + Date.now().toString(36), sym: d.sym, dir: d.dir, conv: d.conv, status: 'idea' as Status, createdAt: Date.now(), name, lev: d.lev, rationale: d.rationale, trigger: d.trigger, invalidation: d.invalidation, targetNote: d.targetNote, startDate: d.startDate, tradeDate: d.tradeDate, entry: d.entry, stop: d.stop, rr: c.rrList[0]?.rr, draft: { ...d } };
    planActions.savePlan(plan);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      <style>{`.tpsec-hd{transition:background .15s}.tpsec-hd:hover{background:#faf9f7}.tpdatechip:hover{background:#f4f1fd}.tp-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;outline:none;cursor:pointer}.tp-range::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:#fff;border:1px solid #d7d4cc;box-shadow:0 1px 3px rgba(20,20,12,.18);cursor:pointer}.tp-range::-moz-range-thumb{width:17px;height:17px;border-radius:50%;background:#fff;border:1px solid #d7d4cc;cursor:pointer}`}</style>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', padding: '6px 2px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span onClick={() => (editing ? planActions.cancelEdit() : planActions.setView('board'))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700, fontSize: 11.5, color: '#b0aea3', width: 'max-content' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>{editing ? 'Cancel' : 'Back to Plans'}
          </span>
          <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.025em', color: '#1a1813', lineHeight: 1.08 }}>{editing ? 'Edit plan.' : 'Plan this trade.'}</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70', lineHeight: 1.5, maxWidth: 560 }}>{editing ? `Updating ${TP_MARKETS[d.sym].label} ${d.dir} — change levels, size, leverage or thesis.` : 'Lock the specifics — levels, size, leverage, thesis. You’ll still execute manually on TradingView.'}</span>
        </div>
        <span style={{ alignSelf: 'flex-start', marginTop: -4 }}><DirLevHeading d={d} /></span>
      </div>

      {/* top equity strip — live math condensed into Risk/Reward/R:R/Position/Margin/Stop-vs-liq */}
      <EquityStrip c={c} d={d} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        {/* THEORY group — name/date + thesis + chart, collapsible under a purple gradient header */}
        <GroupSheet glow="#7c5cff">
          <GroupHead label="Theory" color="#7c5cff" gradient="linear-gradient(180deg,#ffffff 0%,#faf8ff 45%,#ece5fb 100%)" border="#e6ddfb" allOpen={theoryAllOpen} onToggleAll={() => setGroup(['thesis', 'chart'], !theoryAllOpen)} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '9px 18px', borderBottom: '1px solid #f3f1f7' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 5 }}>
              <input value={d.name} onChange={(e) => planActions.setDraft({ name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey && !d.name.trim() && tpAutoName(d)) { e.preventDefault(); planActions.setDraft({ name: tpAutoName(d) }); } }} placeholder={tpAutoName(d)} style={{ width: '100%', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: '#1a1813', padding: 0 }} />
              <span style={{ height: 2, width: '100%', background: 'linear-gradient(90deg,#c9bcff,rgba(201,188,255,0))', borderRadius: 2 }} />
            </div>
            <ExpectedDate d={d} />
          </div>
          <SecHead title="Thesis" open={secOpen.thesis} onToggle={() => toggleSec('thesis')} collapsedRight={<ThesisChips d={d} />} />
          {secOpen.thesis && <Thesis d={d} c={c} />}
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
            <SecHead title="Levels" open={secOpen.levels} onToggle={() => toggleSec('levels')} fixedH
              collapsedRight={<LevelsSummary d={d} c={c} />} />
            {secOpen.levels && (
            <div style={{ padding: '4px 18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* ENTRY */}
              {d.entryMode === 'zone' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <SectionHeader text="Entry" color="#7c5cff" tip={ENTRY_TIP} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ flex: 1 }}><PriceInput value={d.ez1} onChange={(v) => planActions.setDraft({ ez1: v })} placeholder="from" /></div><span style={{ fontWeight: 800, fontSize: 14, color: '#cbc9c0' }}>–</span><div style={{ flex: 1 }}><PriceInput value={d.ez2} onChange={(v) => planActions.setDraft({ ez2: v })} placeholder="to" /></div></div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <SectionHeader text="Entry" color="#7c5cff" tip={ENTRY_TIP} right={<EntryTotals d={d} c={c} />} />
                  <EntryLadder d={d} />
                </div>
              )}
              {/* RISK — stop + liquidation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <SectionHeader text="Risk" color="#df5338" tip={RISK_TIP} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#df5338' }}>Stop loss <span style={{ color: '#d3beb7' }}>· blank = ride to liq</span></span>
                    <PriceInput value={d.stop} onChange={(v) => planActions.setDraft({ stop: v })} placeholder="0.00" accent="#df5338" tint="#f2ddd6" bg="#fffcfb" />
                  </div>
                  <LiqCell d={d} c={c} />
                </div>
              </div>
              {/* TARGETS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                <SectionHeader text="Targets" color="#1f9d55" tip={TARGETS_TIP} right={<BanksTotal c={c} />} />
                <TargetsLadder d={d} c={c} />
              </div>
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
                // riskusd/riskpct with no stop → "riding to liquidation" hover hint (matches the reference)
                const hasTip = (m.v === 'riskusd' || m.v === 'riskpct') && c.usingLiqStop;
                return (
                  <div key={m.v} onClick={() => planActions.setDraft({ sizeMode: m.v })}
                    onMouseEnter={hasTip ? () => setSizeTip(m.v) : undefined}
                    onMouseLeave={hasTip ? () => setSizeTip((s) => (s === m.v ? null : s)) : undefined}
                    style={{ position: 'relative', padding: '12px 14px', cursor: 'pointer', borderRight: i < 4 ? '1px solid #f1f0ed' : 'none', background: a ? '#faf8ff' : 'transparent', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontWeight: a ? 800 : 700, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: a ? '#7c5cff' : '#a8a69b', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{a ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c5cff' }} /> : null}{m.label}</span>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1813', fontVariantNumeric: 'tabular-nums' }}>{val}{m.v === 'qty' ? <span style={{ fontWeight: 600, fontSize: 9.5, color: '#b3b0a6' }}>{' ' + d.sym}</span> : null}</span>
                    {hasTip && sizeTip === m.v ? <span style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 186, background: '#1a1813', color: '#fbfbf9', fontSize: 11.5, fontWeight: 500, lineHeight: 1.45, textTransform: 'none', letterSpacing: 0, padding: '9px 12px', borderRadius: 10, boxShadow: '0 10px 26px rgba(20,18,12,0.22)', zIndex: 30, textAlign: 'left', whiteSpace: 'normal', pointerEvents: 'none' }}>No stop-loss set — riding to liquidation, so your max loss is the full margin you post.</span> : null}
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
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #eeecf3', borderRadius: 12, background: '#fff' }}>
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
              <span style={{ fontWeight: 800, fontSize: 13, color: '#b3b0a6' }}>{c.levBlocked ? 'Leverage above 10× — bring it down to save' : c.sizeBlocked ? 'Size above 70% — bring it down to save' : 'Fill entry, stop, a target & size'}</span>
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

const stepBtn: CSSProperties = { width: 34, height: 34, flex: '0 0 auto', borderRadius: 9, border: '1px solid #eeecf3', background: '#faf9f7', color: '#56544b', fontSize: 20, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' };


