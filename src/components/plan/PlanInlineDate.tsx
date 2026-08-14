'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { planActions } from '@/lib/plan-store';
import type { Plan } from '@/lib/plan-model';

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toISO = (dt: Date) => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
const parse = (s?: string): Date | null => { if (!s) return null; const q = String(s).split('-'); return new Date(+q[0], +q[1] - 1, +q[2]); };
const dayN = (x: Date | null): number => (x ? new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() : 0);
const sameDay = (a: Date | null, b: Date | null) => !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());

// Shared planned-window range picker: a caller-styled trigger + a portaled calendar popover.
// Portaled to <body> so it survives the board card's overflow:hidden. Writes via setPlanDates.
export function PlanInlineDate({ plan, children }: { plan: Plan; children: (o: { open: boolean; onToggle: (e: React.MouseEvent) => void }) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const start = parse(plan.startDate);
  const sel = parse(plan.tradeDate);
  const today = new Date();
  const vw = view || (sel ? { y: sel.getFullYear(), m: sel.getMonth() } : start ? { y: start.getFullYear(), m: start.getMonth() } : { y: today.getFullYear(), m: today.getMonth() });

  const onToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 9, left: Math.max(8, Math.min(r.left, window.innerWidth - 300)) }); setView(vw); }
    setOpen((v) => !v);
  };
  const pick = (dt: Date) => {
    const iso = toISO(dt);
    if (!start || (start && sel)) { planActions.setPlanDates(plan.id, { startDate: iso, tradeDate: '' }); setHover(null); }
    else if (dayN(dt) < dayN(start)) { planActions.setPlanDates(plan.id, { startDate: iso }); }
    else { planActions.setPlanDates(plan.id, { tradeDate: iso }); setOpen(false); setHover(null); }
  };

  const first = new Date(vw.y, vw.m, 1);
  const gridStart = new Date(vw.y, vw.m, 1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { const dt = new Date(gridStart); dt.setDate(gridStart.getDate() + i); cells.push(dt); }
  const hov = start && !sel && hover ? parse(hover) : null;
  const pEnd = sel || (hov && dayN(hov) > dayN(start) ? hov : null);

  return (
    <>
      {children({ open, onToggle })}
      {open && mounted && pos ? createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 201, width: 288, boxSizing: 'border-box', background: '#fff', border: '1px solid #ecebe6', borderRadius: 14, boxShadow: '0 14px 40px -12px rgba(20,20,12,0.28)', padding: 16, animation: 'pkUp .16s ease both' }}>
            <style>{`@keyframes pkUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{MON[vw.m] + ' ' + vw.y}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['p', 'n'] as const).map((dir) => (
                  <button key={dir} onClick={(e) => { e.stopPropagation(); const nm = new Date(vw.y, vw.m + (dir === 'n' ? 1 : -1), 1); setView({ y: nm.getFullYear(), m: nm.getMonth() }); }} style={{ width: 27, height: 27, borderRadius: 8, border: '1px solid #efedea', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#56524b' }}>
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
                const rng = !!(start && pEnd) && dayN(dt) > dayN(start) && dayN(dt) < dayN(pEnd);
                const rad = isS ? (pEnd ? '8px 0 0 8px' : '8px') : isE ? (start ? '0 8px 8px 0' : '8px') : rng ? '0' : '8px';
                return (
                  <button key={i} onClick={(e) => { e.stopPropagation(); pick(dt); }} onMouseEnter={() => { if (start && !sel) setHover(toISO(dt)); }}
                    style={{ height: 32, borderRadius: rad, border: 'none', cursor: 'pointer', fontWeight: isEnd || isT ? 800 : 600, fontSize: 12.5,
                      background: isEnd ? (isHovEnd ? '#9a83f5' : '#7c5cff') : rng ? '#efe9ff' : 'transparent', color: isEnd ? '#fff' : inM ? '#1a1813' : '#cfcdc4',
                      boxShadow: isT && !isEnd ? 'inset 0 0 0 1.5px #ddd0f7' : 'none', display: 'grid', placeItems: 'center' }}>
                    {dt.getDate()}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f2f1ed' }}>
              <button onClick={(e) => { e.stopPropagation(); planActions.setPlanDates(plan.id, { startDate: '', tradeDate: '' }); setOpen(false); setHover(null); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, color: '#897f70', padding: 0 }}>Clear</button>
              {start && pEnd
                ? <span style={{ fontWeight: 800, fontSize: 12, color: '#7c5cff' }}>{(() => { const dd = Math.round((dayN(pEnd) - dayN(start)) / 86400000); return dd === 0 ? 'same day' : dd === 1 ? '1 day hold' : dd + ' days hold'; })()}</span>
                : <span style={{ fontWeight: 600, fontSize: 11, color: '#b3aea2' }}>{start ? 'Pick the exit date' : 'Pick the entry date'}</span>}
            </div>
          </div>
        </>, document.body) : null}
    </>
  );
}

// compact range/relative label for a plan's planned window (main + optional sub)
export function planWindowLabel(p: Plan): { main: string; sub: string | null } | null {
  const start = parse(p.startDate), sel = parse(p.tradeDate);
  if (!start && !sel) return null;
  if (start && sel) {
    const sameMo = start.getMonth() === sel.getMonth() && start.getFullYear() === sel.getFullYear();
    const main = MONS[start.getMonth()] + ' ' + start.getDate() + ' → ' + (sameMo ? String(sel.getDate()) : MONS[sel.getMonth()] + ' ' + sel.getDate());
    const dd = Math.round((dayN(sel) - dayN(start)) / 86400000);
    return { main, sub: dd === 0 ? 'same day' : dd === 1 ? '1 day hold' : dd + ' days hold' };
  }
  const only = sel || start!;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const diff = Math.round((dayN(only) - t0.getTime()) / 86400000);
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const short = MONS[only.getMonth()] + ' ' + only.getDate();
  if (diff === 0) return { main: 'Today', sub: short };
  if (diff === 1) return { main: 'Tomorrow', sub: short };
  if (diff > 1 && diff <= 6) return { main: WD[only.getDay()], sub: short };
  if (diff === -1) return { main: 'Yesterday', sub: short };
  return { main: short + ', ' + only.getFullYear(), sub: null };
}
