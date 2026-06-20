'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { type Plan, type Status, tpCompute, planToDraft, tpPlanName, tpMoney } from '@/lib/plan-model';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { LiveMath } from './LiveMath';
import { CoinIcon } from './coins';

const COLS: { key: Status; label: string }[] = [
  { key: 'idea', label: 'Ideas' },
  { key: 'armed', label: 'Armed' },
  { key: 'triggered', label: 'Triggered' },
];
const lbl = (t: string) => <span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#a8a69b' }}>{t}</span>;

function BoardCard({ p, onOpen }: { p: Plan; onOpen: (p: Plan) => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [hover, setHover] = useState(false);
  const delT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = p.dir === 'long', col = long ? '#1f9d55' : '#df5338';
  const d = planToDraft(p), c = tpCompute(d);
  const levHigh = Number(p.lev) > 5;
  const dragAt = useRef(0);

  return (
    <div
      draggable
      onDragStart={(e) => { planActions; (window as unknown as { __tpDrag?: string }).__tpDrag = p.id; dragAt.current = Date.now(); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => { if (Date.now() - dragAt.current > 250) onOpen(p); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: '#fff', border: '1px solid #ece9e3', borderLeft: `3px solid ${col}`, borderRadius: 14, overflow: 'hidden', cursor: 'pointer', boxShadow: hover ? '0 4px 16px rgba(20,18,12,0.07)' : '0 1px 2px rgba(20,20,12,0.03)', transition: 'box-shadow .15s, border-color .15s' }}
    >
      {p.chart ? (
        <div style={{ width: '100%', overflow: 'hidden', borderBottom: '1px solid #f1f0ed', background: '#fbfaf8' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.chart} alt="" style={{ display: 'block', width: '100%', height: 'auto' }} />
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', padding: '9px 38px 9px 13px', borderBottom: '1px solid #f1f0ed' }}>
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(p)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.72fr', borderBottom: '1px solid #e4e2db', background: '#faf9f7' }}>
        <div style={{ padding: '8px 12px', borderRight: '1px solid #e4e2db', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>{lbl('Market')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}><CoinIcon sym={p.sym} /><span style={{ fontWeight: 800, fontSize: 13, color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.symLabel || p.sym + '/USDT.P'}</span></div>
        </div>
        <div style={{ padding: '8px 12px', borderRight: '1px solid #e4e2db', display: 'flex', flexDirection: 'column', gap: 4 }}>{lbl('Direction')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">{long ? <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></> : <><path d="M7 7 17 17" /><path d="M17 8v9H8" /></>}</svg>
            <span style={{ fontWeight: 800, fontSize: 13, color: col }}>{long ? 'Long' : 'Short'}</span>
          </div>
        </div>
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>{lbl('Leverage')}
          <span style={{ fontWeight: 800, fontSize: 13, color: levHigh ? '#df5338' : '#1a1813', fontVariantNumeric: 'tabular-nums' }}>{p.lev}×</span>
        </div>
      </div>
      <LiveMath c={c} d={d} dense idSuffix={p.id} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', color: '#1a1813' }}>Plans.</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70' }}>Drag a plan between columns as it moves from idea → armed → triggered.</span>
        </div>
        <button onClick={() => { planActions.clearDraft(); planActions.setView('editor'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#7c5cff', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 1px 2px rgba(20,20,12,0.05)' }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>New plan
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, alignItems: 'stretch' }}>
        {COLS.map((col) => {
          const items = plans.filter((p) => p.status === col.key);
          const isOver = overCol === col.key;
          return (
            <div key={col.key}
              onDragOver={(e) => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); }}
              onDragLeave={() => setOverCol((s) => (s === col.key ? null : s))}
              onDrop={(e) => { e.preventDefault(); setOverCol(null); const id = (window as unknown as { __tpDrag?: string }).__tpDrag; if (id) planActions.movePlan(id, col.key); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 11, borderRadius: 16, padding: 12, background: isOver ? '#f7f4ff' : '#faf9f7', border: `1px solid ${isOver ? '#d9cffb' : '#efedea'}`, boxShadow: isOver ? 'inset 0 0 0 1px #d9cffb' : 'none', transition: 'all .14s', minHeight: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
                <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#56544b' }}>{col.label}</span>
                <span style={{ fontWeight: 800, fontSize: 11, color: '#a8a69b', background: '#fff', border: '1px solid #ecebe6', borderRadius: 99, padding: '1px 8px', fontVariantNumeric: 'tabular-nums' }}>{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#bdbbb1', fontWeight: 600, fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Drag a plan here</div>
              ) : items.map((p) => <BoardCard key={p.id} p={p} onOpen={onOpen} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
