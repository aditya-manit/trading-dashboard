'use client';

import { useRef, useState } from 'react';
import { type Plan, type Status, tpCompute, planToDraft, tpPlanName, tpMoney } from '@/lib/plan-model';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { CoinIcon } from './coins';

const COLS: { key: Status; label: string; dot: string }[] = [
  { key: 'idea', label: 'Ideas', dot: '#c9b8ff' },
  { key: 'armed', label: 'Armed', dot: '#7c5cff' },
  { key: 'triggered', label: 'Triggered', dot: '#1f9d55' },
];
const money = (v: number) => (isFinite(v) ? tpMoney(v, v < 1000 ? 2 : 0) : '—');

// Board card — the 'ac' variant the design actually renders: margin donut +
// coin/name/dir/lev + entry, over big Risk·equity / Reward·equity numbers + bar.
function BoardCard({ p, onOpen }: { p: Plan; onOpen: (p: Plan) => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const delT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragAt = useRef(0);
  const long = p.dir === 'long', col = long ? '#1f9d55' : '#df5338';
  const d = planToDraft(p), c = tpCompute(d);
  const tp1 = c.rrList[0], rr = c.primaryR;
  const rewardUSD = tp1 ? tp1.rewardUSD : NaN, rewardPct = isFinite(rewardUSD) ? (rewardUSD / c.Q) * 100 : NaN;
  const riskW = isFinite(rr) && rr > 0 ? Math.max(8, Math.min(60, 100 / (1 + rr))) : 25;
  const mp = Math.max(0, Math.min(100, c.marginPct || 0));

  return (
    <div draggable
      onDragStart={(e) => { (window as unknown as { __tpDrag?: string }).__tpDrag = p.id; dragAt.current = Date.now(); setDragging(true); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.id); } catch { /* noop */ } }}
      onDragEnd={() => setDragging(false)}
      onClick={() => { if (Date.now() - dragAt.current > 250) onOpen(p); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: '#fff', border: '1px solid #efedea', borderRadius: 14, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab', display: 'flex', flexDirection: 'column', opacity: dragging ? 0.45 : 1, boxShadow: dragging ? '0 12px 28px rgba(20,20,12,0.16)' : hover ? '0 6px 18px rgba(20,18,12,0.08)' : '0 1px 3px rgba(20,20,12,0.04)', transition: 'box-shadow .15s, opacity .12s' }}>
      {/* direction bookmark */}
      <div style={{ position: 'absolute', top: 0, right: 24, width: 26, height: 34, background: col, clipPath: 'polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)', zIndex: 2 }} />
      {/* delete */}
      <div style={{ position: 'absolute', top: 6, right: 7, zIndex: 4, opacity: hover || confirmDel ? 1 : 0, transition: 'opacity .12s' }}>
        {confirmDel ? (
          <button onClick={(e) => { e.stopPropagation(); if (delT.current) clearTimeout(delT.current); planActions.deletePlan(p.id); }} title="Confirm delete" style={{ cursor: 'pointer', border: 'none', background: '#df5338', color: '#fff', padding: 4, display: 'inline-flex', borderRadius: 8, boxShadow: '0 2px 6px rgba(223,83,56,0.3)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); setConfirmDel(true); delT.current = setTimeout(() => setConfirmDel(false), 2600); }} title="Delete plan" style={{ cursor: 'pointer', border: '1px solid #efedea', background: '#fff', color: '#c2c0b6', padding: 4, display: 'inline-flex', borderRadius: 8, boxShadow: '0 1px 3px rgba(20,20,12,0.1)' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        )}
      </div>
      {/* head: donut + name/dir/lev + entry */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 13, padding: '12px 15px 9px' }}>
        <div style={{ position: 'relative', width: 66, height: 66, flex: '0 0 auto', alignSelf: 'center', borderRadius: '50%', background: `conic-gradient(#7c5cff 0 ${mp}%,#f0efeb ${mp}% 100%)` }}>
          <div style={{ position: 'absolute', inset: 7, background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: '#1a1813', lineHeight: 1 }}>{isFinite(c.marginPct) ? Math.round(c.marginPct) : '—'}<span style={{ fontSize: 10, color: '#7c5cff' }}>%</span></span>
            <span style={{ fontWeight: 700, fontSize: 6, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbb3a8' }}>margin</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 11, paddingRight: 42 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><CoinIcon sym={p.sym} /><span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.015em', color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(p)}</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: col }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">{long ? <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></> : <><path d="M7 7 17 17" /><path d="M17 8v9H8" /></>}</svg>{long ? 'Long' : 'Short'}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d4cc' }} />
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}><span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em', color: '#1a1813' }}>{p.lev}×</span><span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b3b0a6' }}>lev</span></span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px solid #f1f0ed', paddingTop: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a8a69b' }}>Entry</span>
            <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.01em', color: '#1a1813' }}>{c.hasEntry ? money(c.E) : '—'}</span>
          </div>
        </div>
      </div>
      {/* score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', padding: '11px 15px 12px', borderTop: '1px solid #f3f2ef' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb3a8' }}>Risk · equity</span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.035em', color: '#df5338', lineHeight: 1.05 }}>{isFinite(c.riskPct) ? '↓ ' + c.riskPct.toFixed(1) + '%' : '—'}</span>
          <span style={{ fontWeight: 700, fontSize: 10, color: '#c9a99f' }}>{isFinite(c.riskUSD) ? '−' + money(c.riskUSD) : '—'}</span>
        </div>
        <span style={{ width: 1, height: 38, background: '#eeede9' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bbb3a8' }}>Reward · equity</span>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.035em', color: '#1f9d55', lineHeight: 1.05 }}>{isFinite(rewardPct) ? '↑ ' + rewardPct.toFixed(1) + '%' : '—'}</span>
          <span style={{ fontWeight: 700, fontSize: 10, color: '#9cc4ab' }}>{isFinite(rewardUSD) ? '+' + money(rewardUSD) : '—'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', height: 4 }}><div style={{ width: riskW + '%', background: '#df5338' }} /><div style={{ flex: 1, background: '#1f9d55' }} /></div>
    </div>
  );
}

export function Board({ onOpen }: { onOpen: (p: Plan) => void }) {
  const store = usePlanStore();
  const [overCol, setOverCol] = useState<Status | null>(null);
  const plans = store.plans;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', padding: '6px 2px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c5cff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cff' }} />Plans board
          </span>
          <span style={{ fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', color: '#1a1813', lineHeight: 1.08 }}>Your trade plans.</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70', lineHeight: 1.5, maxWidth: 560 }}>Ideas you’ve mapped, armed setups waiting on a trigger, and the ones now live. Execute on TradingView — this stays your record.</span>
        </div>
        <button onClick={() => { planActions.clearDraft(); planActions.setView('editor'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, background: '#7c5cff', color: '#fff', border: 'none', borderRadius: 13, padding: '11px 18px', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, letterSpacing: '-0.01em', cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,92,255,0.28)', flex: '0 0 auto' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>New plan
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'stretch' }}>
        {COLS.map((col) => {
          const items = plans.filter((p) => p.status === col.key);
          const isOver = overCol === col.key;
          const empty = col.key === 'idea' ? 'No ideas yet' : col.key === 'armed' ? 'Nothing armed' : 'None triggered';
          return (
            <div key={col.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 2px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot }} />
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a1813' }}>{col.label}</span>
                <span style={{ fontWeight: 800, fontSize: 10.5, color: '#a8a69b', background: '#f1f0ed', borderRadius: 99, padding: '2px 8px', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); }}
                onDragLeave={() => setOverCol((s) => (s === col.key ? null : s))}
                onDrop={(e) => { e.preventDefault(); setOverCol(null); const id = (window as unknown as { __tpDrag?: string }).__tpDrag; if (id) planActions.movePlan(id, col.key); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1, minHeight: 88, borderRadius: 14, padding: 6, transition: 'background .12s, box-shadow .12s', background: isOver ? '#f7f4ff' : 'transparent', boxShadow: isOver ? 'inset 0 0 0 2px #d3c4ff' : 'inset 0 0 0 1px transparent' }}>
                {items.length === 0 ? (
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#bdbbb1', fontWeight: 600, fontSize: 12, padding: '24px 0', textAlign: 'center' }}>{empty}</div>
                ) : items.map((p) => <BoardCard key={p.id} p={p} onOpen={onOpen} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
