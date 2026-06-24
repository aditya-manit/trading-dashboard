'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  type PlanDraft, type SizeMode, type Sym, type Dir, type Conv,
  tpCompute, tpFmtNum, tpNum, tpMoney, tpAutoName, TP_MARKETS, TP_EQUITY, type Plan, type Status,
} from '@/lib/plan-model';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { useAccount } from '@/hooks/useAccount';
import { usePositions } from '@/hooks/usePositions';
import { useBtcCandles } from '@/hooks/useBtcCandles';
import { HeatmapLaunchCard } from '@/components/heatmap/HeatmapLaunchCard';
import type { HeatSymbol } from '@/hooks/useHeatmap';
import { LiveMath } from './LiveMath';
import { RrDiagram } from './RrDiagram';

const PURP = '#7c5cff';
const SIZE_MODES: { v: SizeMode; label: string; unit: string; hint: string }[] = [
  { v: 'qty', label: 'Contracts', unit: 'contracts', hint: 'units of the asset' },
  { v: 'margin', label: 'Margin USD', unit: 'USD margin', hint: 'margin you post' },
  { v: 'marginpct', label: '% balance', unit: '% of balance', hint: '% of equity as margin' },
  { v: 'riskusd', label: 'Risk, USD', unit: 'USD risk', hint: 'USD lost if stopped' },
  { v: 'riskpct', label: 'Risk, %', unit: '% risk', hint: '% of equity risked' },
];

const card: CSSProperties = { background: '#fff', border: '1px solid #efedf3', borderRadius: 18, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden' };
const cardHead: CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, padding: '15px 20px', borderBottom: '1px solid #f4f3f0' };
const num = (n: string) => <span style={{ fontWeight: 800, fontSize: 15, color: PURP, letterSpacing: '-0.01em' }}>{n}</span>;
const ttl = (t: string) => <span style={{ fontWeight: 800, fontSize: 13.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{t}</span>;

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
  return (
    <div style={{ padding: '15px 18px', borderRight: i % 2 === 0 ? '1px solid #f0efec' : 'none', borderBottom: i < 2 ? '1px solid #f0efec' : 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#1a1813' }}>
          <span style={{ fontWeight: 800, fontSize: 9, color: f.nc, fontVariantNumeric: 'tabular-nums' }}>{f.n}</span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: f.dot }} />{f.lab}
        </span>
        <span style={{ fontWeight: 500, fontSize: 10.5, color: '#bdbbb1', letterSpacing: '0.01em' }}>{f.cap}</span>
      </div>
      <textarea value={String(d[f.k] ?? '')} onChange={(e) => planActions.setDraft({ [f.k]: e.target.value } as Partial<PlanDraft>)} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} placeholder={f.ph}
        style={{ width: '100%', boxSizing: 'border-box', minHeight: 82, resize: 'vertical', padding: '9px 11px', border: 'none', borderRadius: 10, background: foc ? f.tint : 'transparent', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, color: '#1a1813', outline: 'none', lineHeight: 1.6, transition: 'background .15s' }} />
    </div>
  );
}
function Thesis({ d }: { d: PlanDraft }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>{THESIS_FIELDS.map((f, i) => <ThesisField key={f.k} f={f} i={i} d={d} />)}</div>;
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
  const userId = btcPos?.user || (positions || [])[0]?.user;
  const acctLabel = userId ? `CX-${String(userId).slice(-4)}` : '';

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

  const save = () => {
    if (!c.valid) return;
    const name = d.name.trim();
    const plan: Plan = editing
      ? { ...editing, ...d, name, draft: { ...d }, status: editing.status }
      : { id: 'tp_' + Date.now().toString(36), sym: d.sym, dir: d.dir, conv: d.conv, status: 'idea' as Status, createdAt: Date.now(), name, lev: d.lev, rationale: d.rationale, trigger: d.trigger, invalidation: d.invalidation, targetNote: d.targetNote, entry: d.entry, stop: d.stop, rr: c.rrList[0]?.rr, draft: { ...d } };
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
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70', lineHeight: 1.5, maxWidth: 560 }}>{editing ? `Updating ${TP_MARKETS[d.sym].label}…` : 'State the idea, set the levels, size it, and let the math check your risk before you commit.'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', paddingBottom: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#a8a69b' }}>{TP_MARKETS[d.sym].label} · mark</span>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#1a1813', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{tpMoney(c.mkt.mark, c.mkt.mark < 1000 ? 2 : 0)}</span>
          <span style={{ fontWeight: 600, fontSize: 11, color: '#b3b0a6' }}>Equity {tpMoney(equity, 0)}{acctLabel ? ` · ${acctLabel}` : ''}</span>
        </div>
      </div>

      {/* idea: thesis + chart */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0efec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 22px', borderBottom: '1px solid #f4f3f0' }}>
              {num('1')}
              <input value={d.name} onChange={(e) => planActions.setDraft({ name: e.target.value })} placeholder={tpAutoName(d)} style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 800, fontSize: 17, letterSpacing: '-0.015em', color: '#1a1813', padding: '9px 0' }} />
              <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c4c2b8', flex: '0 0 auto' }}>Name · optional</span>
            </div>
            <Thesis d={d} />
          </div>
          <div style={{ flex: '0 0 37%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: '1px solid #f4f3f0' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 7, background: '#f2f0ec' }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.6} /><path d="m21 15-5-5L5 21" /></svg></span>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', color: '#1a1813' }}>Chart</span>
              <span style={{ fontWeight: 600, fontSize: 10.5, color: '#bdbbb1', marginLeft: 'auto' }}>optional</span>
            </div>
            <div style={{ flex: 1 }}><ChartUpload d={d} onFull={setFull} /></div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.32fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}><div style={cardHead}>{num('2')}{ttl('Identity')}</div><IdentitySection d={d} btcMark={btcMark} /></div>

          <div style={card}>
            <div style={{ ...cardHead, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>{num('3')}{ttl('Levels')}</div>
              <Seg opts={[{ v: 'price', label: 'Single price' }, { v: 'zone', label: 'Zone' }]} cur={d.entryMode} onPick={(v) => planActions.setDraft({ entryMode: v as 'price' | 'zone' })} accent="#23211b" />
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {d.entryMode === 'zone' ? (
                <Field label="Entry zone"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ flex: 1 }}><PriceInput value={d.ez1} onChange={(v) => planActions.setDraft({ ez1: v })} placeholder="from" /></div><span style={{ fontWeight: 800, fontSize: 14, color: '#cbc9c0' }}>–</span><div style={{ flex: 1 }}><PriceInput value={d.ez2} onChange={(v) => planActions.setDraft({ ez2: v })} placeholder="to" /></div></div></Field>
              ) : (
                <Field label="Entry price"><PriceInput value={d.entry} onChange={(v) => planActions.setDraft({ entry: v })} placeholder="0.00" /></Field>
              )}
              <Field label="Stop loss" labelColor="#df5338" hint="blank = ride to liq"><PriceInput value={d.stop} onChange={(v) => planActions.setDraft({ stop: v })} placeholder="0.00" accent="#df5338" tint="#f2ddd6" bg="#fffcfb" /></Field>
              <Field label="Targets" labelColor="#1f9d55">
                <div style={{ display: 'flex', gap: 9 }}>
                  {(['t1', 't2', 't3'] as const).map((k, i) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', color: i === 0 ? '#5aa97a' : '#bdbbb1', paddingLeft: 2 }}>{'TP' + (i + 1)}{i > 0 ? ' · optional' : ''}</span>
                      <PriceInput value={d[k]} onChange={(v) => planActions.setDraft({ [k]: v } as Partial<PlanDraft>)} placeholder="0.00" accent="#1f9d55" tint={i === 0 ? '#d9ecdf' : '#eceae5'} bg={i === 0 ? '#fbfdfb' : '#fff'} />
                    </div>
                  ))}
                </div>
              </Field>
              {/* check the stop/targets against the live liquidation clusters */}
              <HeatmapLaunchCard variant="row" symbol={d.sym as HeatSymbol} title="Check your stop against the real clusters" sub="Is it beyond the sweep, not inside it?" />
            </div>
          </div>

          {/* sizing */}
          <div style={card}>
            <div style={cardHead}>{num('4')}{ttl('Sizing')}<span style={{ fontWeight: 600, fontSize: 11, color: '#b3b0a6', marginLeft: 'auto' }}>size by the unit you think in</span></div>
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
          </div>

          {/* leverage */}
          <div style={card}>
            <div style={cardHead}>{num('5')}{ttl('Leverage')}</div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13 }}>
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
          </div>
        </div>

        {/* RIGHT live math + diagram + save */}
        <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...card, border: '1px solid #f5f4f1', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderBottom: '1px solid #f4f3f0', background: '#fcfbff' }}>
              <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c5cff' }}>Live math</span>
              <span style={{ fontWeight: 600, fontSize: 10.5, color: '#b3b0a6' }}>auto from your inputs</span>
            </div>
            {c.dirErr ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '14px 18px 0', background: '#fdf2ee', border: '1px solid #f6d9cf', borderRadius: 10, padding: '10px 12px' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#df5338" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={10} /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#a33f28', lineHeight: 1.4 }}>{c.dirErr}</span>
              </div>
            ) : null}
            <LiveMath c={c} d={d} />
          </div>

          <div style={{ ...card, border: '1px solid #f5f4f1', borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderBottom: '1px solid #f4f3f0', background: '#fcfbff' }}>
              <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c5cff' }}>Risk / reward map</span>
              <span style={{ fontWeight: 600, fontSize: 10.5, color: '#b3b0a6' }}>entry · stop · targets</span>
            </div>
            <div style={{ padding: '16px 18px' }}><RrDiagram c={c} d={d} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {c.valid ? (
              <span onClick={save}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(124,92,255,0.4)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(124,92,255,0.08)'; }}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 11, cursor: 'pointer', background: 'linear-gradient(180deg,#f7f3ff,#efe7ff)', border: '1px solid #e3d8fb', borderRadius: 12, padding: '11px 12px 11px 18px', boxShadow: '0 1px 2px rgba(124,92,255,0.08)', transition: 'box-shadow .2s ease' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span style={{ fontWeight: 800, fontSize: 14.5, color: '#5a3ff0', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{editing ? 'Update plan' : 'Save to Plans'}</span><span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#5a3ff0', background: '#fff', border: '1px solid #e3d8fb', padding: '3px 8px', borderRadius: 99 }}>{editing ? editing.status : 'Ideas'}</span></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 27, height: 27, borderRadius: 99, background: 'linear-gradient(150deg,#9d82ff,#7c5cff)', boxShadow: '0 3px 9px -2px rgba(124,92,255,0.6)', flex: '0 0 auto' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
              </span>
            ) : (
              <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#f4f3f0', borderRadius: 12, padding: 14 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx={12} cy={12} r={10} /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <span style={{ fontWeight: 800, fontSize: 13.5, color: '#b3b0a6' }}>{c.levBlocked ? 'Leverage above 10× — bring it down to save' : c.sizeBlocked ? 'Size above 70% — bring it down to save' : 'Set entry, stop, a target & size to save'}</span>
              </span>
            )}
            <button onClick={() => planActions.clearDraft()}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#df5338'; e.currentTarget.style.borderColor = '#f2ddd6'; e.currentTarget.style.background = '#fdfbfa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9b988d'; e.currentTarget.style.borderColor = '#ededea'; e.currentTarget.style.background = '#fff'; }}
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '13px 18px 13px 15px', borderRadius: 12, border: '1px solid #ededea', background: '#fff', color: '#9b988d', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'color .15s, border-color .15s, background .15s' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>Clear
            </button>
          </div>
        </div>
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
