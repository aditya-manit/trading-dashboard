'use client';

import { useRef, useState } from 'react';
import { type Plan, type Status, tpCompute, planToDraft, tpPlanName, tpMoney, relDateLabel } from '@/lib/plan-model';
import { planActions, usePlanStore } from '@/lib/plan-store';
import { CoinIcon } from './coins';
import { StatsBar } from './StatsBar';
import { PlanDateModal, CalIcon } from './MiniCalendar';

type EmptyCfg = { ink: string; ring: string; tint: string; sub: string; icon: 'plus' | 'target' | 'bolt'; title: string };
type Lane = {
  key: Status; label: string; caption: string; num: string; glow: string; glowOp: number;
  empty: EmptyCfg; drop: { ring: string; tint: string };
};
const LANES: Lane[] = [
  { key: 'idea', label: 'Ideas', caption: 'plans mapped', num: '#e8920f', glow: '#ffa31a', glowOp: 0.28,
    empty: { ink: '#d98a1f', ring: '#efd9b2', tint: '#fffaf1', sub: 'Map a setup to start your first idea', icon: 'plus', title: 'No ideas yet' },
    drop: { ring: '#f4c884', tint: '#fff7ec' } },
  { key: 'armed', label: 'Armed', caption: 'waiting on trigger', num: '#7c5cff', glow: '#7c5cff', glowOp: 0.26,
    empty: { ink: '#7c5cff', ring: '#ddd2fb', tint: '#fbfaff', sub: 'Ideas ready to fire show up here', icon: 'target', title: 'Nothing armed' },
    drop: { ring: '#d3c4ff', tint: '#f7f4ff' } },
  { key: 'triggered', label: 'Triggered', caption: 'now live', num: '#1f9d55', glow: '#1f9d55', glowOp: 0.24,
    empty: { ink: '#1f9d55', ring: '#bbe1cb', tint: '#f6fbf8', sub: 'Live trades appear here once they trigger', icon: 'bolt', title: 'None triggered' },
    drop: { ring: '#abdcc0', tint: '#edf7f1' } },
];
const money = (v: number) => (isFinite(v) ? tpMoney(v, v < 1000 ? 2 : 0) : '—');

// Board card — the 'ac' variant the design actually renders: margin donut +
// coin/name/dir/lev + entry, over big Risk·equity / Reward·equity numbers + bar.
function BoardCard({ p, onOpen, tradeState }: { p: Plan; onOpen: (p: Plan) => void; tradeState?: 'executed' | 'closed' | null }) {
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const dragAt = useRef(0);
  const rel = relDateLabel(p.tradeDate);
  const archived = !!p.archived;
  const ts = tradeState ? ({ executed: { ink: '#1f9d55', tint: '#f3faf6', dot: '#1f9d55', label: 'Executed', sub: 'trade taken' }, closed: { ink: '#6f6a60', tint: '#faf9f7', dot: '#9a958a', label: 'Closed', sub: 'no trade taken' } } as const)[tradeState] : null;
  const long = p.dir === 'long', col = long ? '#1f9d55' : '#df5338';
  const d = planToDraft(p), c = tpCompute(d);
  const tp1 = c.rrList[0], rr = c.primaryR;
  const rewardUSD = tp1 ? tp1.rewardUSD : NaN, rewardPct = isFinite(rewardUSD) ? (rewardUSD / c.Q) * 100 : NaN;
  const riskW = isFinite(rr) && rr > 0 ? Math.max(8, Math.min(60, 100 / (1 + rr))) : 25;
  const mp = Math.max(0, Math.min(100, c.marginPct || 0));
  const cvn = ({ high: { n: 3, label: 'High', col: '#7c5cff' }, med: { n: 2, label: 'Med', col: '#9d86f5' }, low: { n: 1, label: 'Low', col: '#c3b6f2' } } as const)[p.conv || 'med'] || { n: 2, label: 'Med', col: '#9d86f5' };

  return (
    <div draggable
      onDragStart={(e) => { (window as unknown as { __tpDrag?: string }).__tpDrag = p.id; dragAt.current = Date.now(); setDragging(true); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.id); } catch { /* noop */ } }}
      onDragEnd={() => setDragging(false)}
      onClick={() => { if (Date.now() - dragAt.current > 250) onOpen(p); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: '#fff', border: archived ? '1.5px dotted #c4c0b6' : '1px solid #efedea', borderRadius: 14, overflow: menuOpen ? 'visible' : 'hidden', zIndex: menuOpen ? 20 : undefined, cursor: dragging ? 'grabbing' : 'pointer', display: 'flex', flexDirection: 'column', opacity: dragging ? 0.45 : 1, boxShadow: dragging ? '0 12px 28px rgba(20,20,12,0.16)' : hover ? '0 6px 18px rgba(20,18,12,0.08)' : '0 1px 3px rgba(20,20,12,0.04)', transition: 'box-shadow .15s, opacity .12s' }}>
      {/* direction bookmark (top-left triangle) — replaced by the ARCHIVED tag when archived */}
      {archived ? (
        <span style={{ position: 'absolute', top: 8, left: 0, zIndex: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px 3px 13px', borderRadius: '0 99px 99px 0', background: '#efede9', boxShadow: '0 1px 2px rgba(20,20,12,0.06)' }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#8a857b" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={4} rx={1} /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /></svg>
          <span style={{ fontWeight: 800, fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a857b' }}>Archived</span>
        </span>
      ) : (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 36, height: 36, background: col, clipPath: 'polygon(0 0,100% 0,0 100%)', zIndex: 3 }} />
      )}
      {/* corner: kebab (hover) over the always-on date trigger */}
      <div style={{ position: 'absolute', top: 8, right: 11, zIndex: 6, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <button title="Plan actions" onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          style={{ width: 22, height: 22, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + (menuOpen ? '#ddd0f7' : '#efedea'), background: menuOpen ? '#f3eefe' : '#fff', borderRadius: 7, cursor: 'pointer', color: menuOpen ? '#7c5cff' : '#a8a39a', padding: 0, opacity: menuOpen || hover ? 1 : 0, transition: 'opacity .12s, background .12s, border-color .12s, color .12s' }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><circle cx={12} cy={5} r={1.7} /><circle cx={12} cy={12} r={1.7} /><circle cx={12} cy={19} r={1.7} /></svg>
        </button>
        <button title={rel ? 'Change expected date' : 'Set expected date'} onClick={(e) => { e.stopPropagation(); setDateOpen(true); }}
          style={{ border: 'none', background: 'transparent', padding: '2px 4px', margin: '-2px -4px', borderRadius: 7, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f5ff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          {rel ? (
            <>
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.015em', color: '#6b46e0' }}>{rel.label}</span>
              {rel.sub ? <span style={{ fontWeight: 600, fontSize: 9, letterSpacing: '0.02em', color: '#b3aea2' }}>{rel.sub}</span> : null}
            </>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#b9a9ee' }}><CalIcon size={11} stroke="currentColor" />Date</span>
          )}
        </button>
      </div>
      {menuOpen ? (
        <>
          <div onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 7 }} />
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 35, right: 11, zIndex: 8, width: 154, background: '#fff', border: '1px solid #ecebe5', borderRadius: 11, boxShadow: '0 8px 24px rgba(20,20,12,0.16)', padding: 4, display: 'flex', flexDirection: 'column' }}>
            <MenuItem label="Edit plan" onClick={() => { setMenuOpen(false); planActions.startEdit(p.id, planToDraft(p)); }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </MenuItem>
            <MenuItem label="Duplicate" onClick={() => { setMenuOpen(false); planActions.duplicatePlan(p.id); }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={9} y={9} width={13} height={13} rx={2} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </MenuItem>
            <MenuItem label={archived ? 'Unarchive' : 'Archive'} onClick={() => { setMenuOpen(false); planActions.archivePlan(p.id, !archived); }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={4} rx={1} /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>
            </MenuItem>
            <div style={{ height: 1, background: '#f1f0ed', margin: '4px 6px' }} />
            <MenuItem label="Delete" danger onClick={() => { setMenuOpen(false); planActions.deletePlan(p.id); }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </MenuItem>
          </div>
        </>
      ) : null}
      {dateOpen ? <PlanDateModal plan={p} onClose={() => setDateOpen(false)} /> : null}
      {/* head: donut + name/dir/lev + entry */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 13, padding: '12px 15px 9px' }}>
        <div style={{ position: 'relative', width: 66, height: 66, flex: '0 0 auto', alignSelf: 'center', borderRadius: '50%', background: `conic-gradient(#7c5cff 0 ${mp}%,#f0efeb ${mp}% 100%)` }}>
          <div style={{ position: 'absolute', inset: 7, background: '#fff', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: '#1a1813', lineHeight: 1 }}>{isFinite(c.marginPct) ? Math.round(c.marginPct) : '—'}<span style={{ fontSize: 10, color: '#7c5cff' }}>%</span></span>
            <span style={{ fontWeight: 700, fontSize: 6, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbb3a8' }}>margin</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 11, paddingRight: 58 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><CoinIcon sym={p.sym} /><span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.015em', color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(p)}</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 800, fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: col }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">{long ? <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></> : <><path d="M7 7 17 17" /><path d="M17 8v9H8" /></>}</svg>{long ? 'Long' : 'Short'}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d4cc' }} />
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}><span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em', color: '#1a1813' }}>{p.lev}×</span><span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b3b0a6' }}>lev</span></span>
              <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d4cc' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2.5 }}>
                  {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < cvn.n ? cvn.col : 'transparent', border: i < cvn.n ? 'none' : '1px solid #d2cfc6', boxSizing: 'border-box' }} />)}
                </span>
                <span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b3b0a6' }}>{cvn.label}</span>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px solid #f1f0ed', paddingTop: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a8a69b' }}>Entry</span>
            <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '-0.01em', color: '#1a1813' }}>{c.hasEntry ? money(c.E) : '—'}</span>
          </div>
        </div>
      </div>
      {/* triggered: executed (trade linked) / closed (no trade) */}
      {ts ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 15px', borderTop: '1px solid #f3f2ef', background: ts.tint }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ts.dot, flex: '0 0 auto' }} />
          <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: ts.ink }}>{ts.label}</span>
          <span style={{ fontWeight: 600, fontSize: 9.5, color: '#b3aea2' }}>{'· ' + ts.sub}</span>
        </div>
      ) : null}
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

function MenuItem({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 11px', border: 'none', background: h ? (danger ? '#fdf2ef' : '#f7f5ff') : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12.5, color: danger ? '#df5338' : '#3a3833', borderRadius: 7 }}>
      {children}<span>{label}</span>
    </button>
  );
}

function EmptyLane({ e }: { e: EmptyCfg }) {
  const clickable = e.icon === 'plus';
  const icon = e.icon === 'plus'
    ? <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={e.ink} strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
    : e.icon === 'target'
      ? <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={e.ink} strokeWidth={2}><circle cx={12} cy={12} r={8} /><circle cx={12} cy={12} r={3.4} fill={e.ink} stroke="none" /></svg>
      : <svg width={17} height={17} viewBox="0 0 24 24" fill={e.ink} stroke="none"><path d="M13 2 4 14h5.5L8.5 22 20 9h-6.2z" /></svg>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textAlign: 'center', padding: '32px 18px', borderRadius: 16, border: '1.5px dashed ' + e.ring, background: e.tint }}>
      <div
        onClick={clickable ? () => { planActions.clearDraft(); planActions.setView('editor'); } : undefined}
        title={clickable ? 'Plan a new idea' : undefined}
        onMouseEnter={clickable ? (ev) => { ev.currentTarget.style.transform = 'translateY(-1px)'; ev.currentTarget.style.boxShadow = '0 4px 12px rgba(217,138,31,.22)'; } : undefined}
        onMouseLeave={clickable ? (ev) => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,.04)'; } : undefined}
        style={{ width: 42, height: 42, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid ' + e.ring, boxShadow: '0 2px 5px rgba(0,0,0,.04)', marginBottom: 1, cursor: clickable ? 'pointer' : 'default', transition: 'transform .14s ease, box-shadow .14s ease' }}>
        {icon}
      </div>
      <span style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '0.01em', color: '#6f6a60' }}>{e.title}</span>
      <span style={{ fontWeight: 600, fontSize: 10.5, lineHeight: 1.5, color: '#b0ada3', maxWidth: 156 }}>{e.sub}</span>
    </div>
  );
}

// Per-column accent for the archive toggle pill + the "all archived" empty title.
const ARCH: Record<Status, { ink: string; tint: string; ring: string; emptyTitle: string }> = {
  idea: { ink: '#e8920f', tint: '#fbf2e3', ring: '#f0e2c4', emptyTitle: 'All ideas archived' },
  armed: { ink: '#7c5cff', tint: '#f3f0ff', ring: '#ddd0f7', emptyTitle: 'All armed archived' },
  triggered: { ink: '#1f9d55', tint: '#f3faf6', ring: '#cfe6da', emptyTitle: 'All triggered are archived' },
};

function ArchiveToggle({ st, count, active, onToggle }: { st: Status; count: number; active: boolean; onToggle: () => void }) {
  if (!count) return null;
  const { ink, tint, ring } = ARCH[st];
  return (
    <button onClick={onToggle} title={active ? 'Hide archived plans' : 'Show archived plans'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: '1px solid ' + (active ? ring : '#e7e5df'), background: active ? tint : '#fff', borderRadius: 99, padding: '4px 11px', boxShadow: '0 1px 2px rgba(20,20,12,0.04)', transition: 'all .14s' }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={active ? ink : '#9a958a'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={4} width={18} height={4} rx={1} /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></svg>
      <span style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: '-0.005em', color: active ? ink : '#7c7668' }}>{(active ? 'Hide' : 'Show') + ' archived'}</span>
      <span style={{ fontWeight: 800, fontSize: 10, color: '#fff', background: active ? ink : '#b3aea2', borderRadius: 99, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{count}</span>
    </button>
  );
}

export function Board({ onOpen }: { onOpen: (p: Plan) => void }) {
  const store = usePlanStore();
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [showArchived, setShowArchived] = useState<Partial<Record<Status, boolean>>>({});
  const plans = store.plans;
  // a triggered plan linked to a real trade is "executed", else "closed"
  const linkedPlanIds = new Set(Object.values(store.links));

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
        <button onClick={() => { planActions.clearDraft(); planActions.setView('editor'); }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px -6px rgba(124,92,255,0.4)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(124,92,255,0.08)'; }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'linear-gradient(180deg,#f7f3ff,#efe7ff)', border: '1px solid #e3d8fb', borderRadius: 12, padding: '8px 9px 8px 16px', fontFamily: 'inherit', cursor: 'pointer', flex: '0 0 auto', boxShadow: '0 1px 2px rgba(124,92,255,0.08)', transition: 'box-shadow .2s ease' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: '#5a3ff0', letterSpacing: '-0.01em' }}>New plan</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 25, height: 25, borderRadius: 8, background: 'linear-gradient(150deg,#9d82ff,#7c5cff)', boxShadow: '0 3px 9px -2px rgba(124,92,255,0.6)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          </span>
        </button>
      </div>

      {/* own layer so the lane glows below never bleed onto the stats card */}
      <div style={{ position: 'relative', zIndex: 2 }}><StatsBar plans={plans} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'stretch' }}>
        {LANES.map((lane) => {
          const all = plans.filter((p) => p.status === lane.key);
          const archivedCount = all.filter((p) => p.archived).length;
          const showArch = !!showArchived[lane.key];
          const items = showArch ? all : all.filter((p) => !p.archived);
          const isOver = overCol === lane.key;
          const emptyCfg = archivedCount && !showArch ? { ...lane.empty, title: ARCH[lane.key].emptyTitle } : lane.empty;
          return (
            <div key={lane.key} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* lane glow halo */}
              <div style={{ position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)', width: '84%', height: 170, borderRadius: '50%', background: lane.glow, filter: 'blur(58px)', opacity: lane.glowOp, pointerEvents: 'none', zIndex: 0 }} />
              {/* number-led header */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontWeight: 800, fontSize: 34, lineHeight: 0.85, letterSpacing: '-0.03em', color: lane.num, fontVariantNumeric: 'tabular-nums' }}>{all.length}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a1813' }}>{lane.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 10.5, color: '#a8a69b' }}>{lane.caption}</span>
                  </div>
                </div>
                <ArchiveToggle st={lane.key} count={archivedCount} active={showArch} onToggle={() => setShowArchived((s) => ({ ...s, [lane.key]: !s[lane.key] }))} />
              </div>
              {/* drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); if (overCol !== lane.key) setOverCol(lane.key); }}
                onDragLeave={() => setOverCol((s) => (s === lane.key ? null : s))}
                onDrop={(e) => { e.preventDefault(); setOverCol(null); const id = (window as unknown as { __tpDrag?: string }).__tpDrag; if (id) planActions.movePlan(id, lane.key); }}
                style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 11, flex: 1, minHeight: 88, borderRadius: 14, padding: 6, transition: 'background .12s, box-shadow .12s', background: isOver ? lane.drop.tint : 'transparent', boxShadow: isOver ? 'inset 0 0 0 2px ' + lane.drop.ring : 'inset 0 0 0 1px transparent' }}>
                {items.length === 0 ? <EmptyLane e={emptyCfg} /> : items.map((p) => <BoardCard key={p.id} p={p} onOpen={onOpen} tradeState={lane.key === 'triggered' ? (linkedPlanIds.has(p.id) ? 'executed' : 'closed') : null} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
