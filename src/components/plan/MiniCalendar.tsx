'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dateToISO, isoToDate, tpPlanName, type Plan } from '@/lib/plan-model';
import { planActions } from '@/lib/plan-store';

const FONT = "'Plus Jakarta Sans',sans-serif";
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sameDay = (a: Date | null, b: Date | null) =>
  !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());

// Notion-style month calendar. Presentational: caller owns the popover/modal
// wrapper. Used by the editor's Expected-date dropdown + the board/drawer modal.
export function MiniCalendar({ value, onPick, onClear, cellH = 34 }: {
  value?: string; onPick: (iso: string) => void; onClear: () => void; cellH?: number;
}) {
  const today = new Date();
  const sel = isoToDate(value);
  const [view, setView] = useState<{ y: number; m: number }>(
    sel ? { y: sel.getFullYear(), m: sel.getMonth() } : { y: today.getFullYear(), m: today.getMonth() },
  );
  const step = (dir: 'n' | 'p') => { const nm = new Date(view.y, view.m + (dir === 'n' ? 1 : -1), 1); setView({ y: nm.getFullYear(), m: nm.getMonth() }); };

  const first = new Date(view.y, view.m, 1);
  const gridStart = new Date(view.y, view.m, 1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { const dt = new Date(gridStart); dt.setDate(gridStart.getDate() + i); cells.push(dt); }

  const arrow = (dir: 'n' | 'p') => (
    <button key={dir} onClick={() => step(dir)} style={{ width: 27, height: 27, borderRadius: 8, border: '1px solid #efedea', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#56524b' }}>
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d={dir === 'n' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>
    </button>
  );
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14.5, color: '#1a1813', letterSpacing: '-0.01em' }}>{MON[view.m]} {view.y}</span>
        <div style={{ display: 'flex', gap: 6 }}>{arrow('p')}{arrow('n')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i} style={{ textAlign: 'center', fontFamily: FONT, fontWeight: 700, fontSize: 10.5, color: '#b3b0a6', padding: '4px 0' }}>{w}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((dt, i) => {
          const inM = dt.getMonth() === view.m, isS = sameDay(dt, sel), isT = sameDay(dt, today);
          return (
            <button key={i} onClick={() => onPick(dateToISO(dt))}
              onMouseEnter={(e) => { if (!isS) e.currentTarget.style.background = '#f5f2ff'; }}
              onMouseLeave={(e) => { if (!isS) e.currentTarget.style.background = 'transparent'; }}
              style={{ height: cellH, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: isS || isT ? 800 : 600, fontSize: 12.5,
                background: isS ? '#7c5cff' : 'transparent', color: isS ? '#fff' : inM ? '#1a1813' : '#cfcdc4',
                boxShadow: isT && !isS ? 'inset 0 0 0 1.5px #ddd0f7' : 'none', display: 'grid', placeItems: 'center', transition: 'background .1s' }}>
              {dt.getDate()}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #f2f1ed' }}>
        <button onClick={onClear} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 12.5, color: '#897f70', padding: 0 }}>Clear</button>
        <button onClick={() => onPick(dateToISO(new Date()))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontWeight: 800, fontSize: 12.5, color: '#7c5cff', padding: 0 }}>Today</button>
      </div>
    </>
  );
}

// The small calendar icon used on every date trigger.
export function CalIcon({ size = 15, stroke = '#7c5cff' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" /><path d="M16 2v4" /><rect x={3} y={4} width={18} height={18} rx={2} /><path d="M3 10h18" />
    </svg>
  );
}

// Centered modal calendar for editing a saved plan's expected date — shared by
// the board card date trigger and the plan drawer date pill.
export function PlanDateModal({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pick = (iso: string) => { planActions.setPlanDate(plan.id, iso); onClose(); };
  if (!mounted) return null;
  // Portal to <body>: the board lanes / drawer panels carry transforms, which
  // would otherwise contain (and clip) this position:fixed modal.
  return createPortal((
    <>
      <style>{`@keyframes pkUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.34)', zIndex: 130, animation: 'fadeIn .18s ease' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 131, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, pointerEvents: 'none' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ pointerEvents: 'auto', width: 316, maxWidth: '92vw', boxSizing: 'border-box', background: '#fff', border: '1px solid #ecebe6', borderRadius: 16, boxShadow: '0 24px 60px -16px rgba(20,20,12,0.34)', padding: 18, animation: 'pkUp .16s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: '#f3eefe', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}><CalIcon /></span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1, minWidth: 0 }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a89cd6' }}>Expected date</span>
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13.5, color: '#1a1813', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(plan)}</span>
            </div>
          </div>
          <MiniCalendar value={plan.tradeDate} onPick={pick} onClear={() => pick('')} />
        </div>
      </div>
    </>
  ), document.body);
}
