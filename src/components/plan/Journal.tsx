'use client';

import { useMemo, useState } from 'react';
import { usePositionHistory } from '@/hooks/usePositionHistory';
import { useAccount } from '@/hooks/useAccount';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpPlanName, planToDraft, tpCompute, TP_EQUITY } from '@/lib/plan-model';
import {
  mapTrade, journalBuild, filterEntries, jMoney,
  type JEntry, type JStats, type JFilter, type AdhCheck,
} from '@/lib/journal';
import { CoinIcon } from './coins';
import { PlanLinkCell } from './PlanLinkCell';

const FONT = "'Plus Jakarta Sans', sans-serif";
// Grade colors — one source of truth, used in all 5 spots (KPI cell, Reviewed
// filter, entry pill, drawer buttons, suggested chip). B brightened off A, C
// darkened for legibility.
const GRADE_COL: Record<string, string> = { A: '#1f9d55', B: '#a0c52a', C: '#ef9512', D: '#df5338' };
const baseSym = (sym: string) => (sym.split('/')[0] as 'BTC' | 'ETH' | 'SOL');

export function Journal() {
  const { data, isLoading } = usePositionHistory();
  const { data: account } = useAccount();
  const equity = parseFloat(account?.total || '') || TP_EQUITY;
  const { links, plans, journal } = usePlanStore();
  const [filter, setFilter] = useState<JFilter>('all');
  const [openPid, setOpenPid] = useState<string | null>(null);

  const { entries, stats } = useMemo(() => {
    const trades = (data || []).filter((p) => Math.abs(parseFloat(p.max_size) || 0) > 0).map(mapTrade);
    return journalBuild(trades, links, plans, journal, equity);
  }, [data, links, plans, journal, equity]);

  const list = filterEntries(entries, filter);
  const openEntry = openPid ? entries.find((e) => e.t.pid === openPid) || null : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        .jrow:hover { background: #faf9f7; }
        .jnote:focus { border-color: #c3b4f5 !important; background: #fff !important; }
        .jplan-link:hover .jplan-name { border-bottom-color: rgba(124,92,255,0.7) !important; }
      `}</style>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', padding: '6px 2px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c5cff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cff' }} />Journal
          </span>
          <span style={{ fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', color: '#1a1813', lineHeight: 1.08 }}>Did you trade your plan?</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#897f70', lineHeight: 1.5, maxWidth: 580 }}>Every closed trade, scored against the plan you linked it to. Process over outcome — a win you weren’t supposed to take is still a mistake.</span>
        </div>
        <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9b988d' }}>{stats.reviewedN} reviewed · {stats.toReview} to review</span>
      </div>

      {isLoading && !data ? (
        <div style={{ padding: '70px 18px', textAlign: 'center', fontWeight: 600, fontSize: 13, color: '#a8a69b' }}>Loading your trades…</div>
      ) : (
        <>
          <Kpis s={stats} />
          <Filters s={stats} cur={filter} onSet={setFilter} />
          <Entries list={list} onOpen={(e) => setOpenPid(e.t.pid)} />
        </>
      )}

      {openEntry ? <JournalDrawer e={openEntry} onClose={() => setOpenPid(null)} /> : null}
    </div>
  );
}

// ── ring ──────────────────────────────────────────────────────────────────────
function Ring({ pct, color, sz = 58 }: { pct: number; color: string; sz?: number }) {
  const SW = Math.max(5.5, sz * 0.095), R = sz / 2 - SW / 2 - 2, C = 2 * Math.PI * R, off = C * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ flex: '0 0 auto' }}>
      <circle cx={sz / 2} cy={sz / 2} r={R} fill="none" stroke="#efeee9" strokeWidth={SW} />
      <circle cx={sz / 2} cy={sz / 2} r={R} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${sz / 2} ${sz / 2})`} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      <text x={sz / 2} y={sz / 2 + 5} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={sz * 0.27} fill="#1a1813">{pct}%</text>
    </svg>
  );
}

const cap = (t: string) => <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a69b' }}>{t}</span>;
const sub = (t: string, c?: string) => <span style={{ fontWeight: 600, fontSize: 11.5, color: c || '#897f70', lineHeight: 1.4 }}>{t}</span>;

// ── KPI band ───────────────────────────────────────────────────────────────────
function Kpis({ s }: { s: JStats }) {
  const adhColor = s.adherence >= 70 ? '#1f9d55' : s.adherence >= 45 ? '#d98a1f' : '#df5338';
  const edge = s.winPlanned - s.winUnplanned;
  const bar = (label: string, pct: number, color: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 11 }}>
        <span style={{ color: '#6b6357' }}>{label}</span><span style={{ color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: '#efeee9', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 99 }} /></div>
    </div>
  );
  const cellStyle: React.CSSProperties = { flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11, borderRight: '1px solid #efeee9' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', background: '#fff', border: '1px solid #ece9e3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      <div style={cellStyle}>
        {cap('Plan adherence')}
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <Ring pct={s.adherence} color={adhColor} sz={80} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1813' }}>{s.followedN} of {s.plannedN} followed</span>
            {sub('of planned trades stuck to the rules')}
          </div>
        </div>
      </div>
      <div style={cellStyle}>
        {cap('Coverage')}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.03em', color: '#1a1813' }}>{s.plannedN}/{s.total}</span>
          <span style={{ fontWeight: 700, fontSize: 12, color: '#897f70' }}>planned</span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#efeee9' }}>
          <div style={{ width: s.coverage + '%', background: 'linear-gradient(90deg,#9d82ff,#7c5cff)' }} /><div style={{ flex: 1 }} />
        </div>
        {sub(s.coverage + '% of trades had a written plan')}
      </div>
      <div style={cellStyle}>
        {cap('Win rate · by discipline')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{bar('Planned', s.winPlanned, '#1f9d55')}{bar('Unplanned', s.winUnplanned, '#b6b1a6')}</div>
        {sub(edge >= 0 ? `Planned trades win ${edge} pts more` : `Planned win ${Math.abs(edge)} pts less`, edge >= 0 ? '#1f9d55' : '#df5338')}
      </div>
      <div style={cellStyle}>
        {cap('Net P&L · by discipline')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 11.5, color: '#6b6357' }}>Planned</span>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: s.pnlPlanned >= 0 ? '#1f9d55' : '#df5338' }}>{jMoney(s.pnlPlanned)}</span>
          </div>
          <div style={{ height: 1, background: '#f1f0ed' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 11.5, color: '#6b6357' }}>Unplanned</span>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: s.pnlUnplanned >= 0 ? '#1f9d55' : '#df5338' }}>{jMoney(s.pnlUnplanned)}</span>
          </div>
        </div>
        {sub('what discipline is actually worth')}
      </div>
      {/* 5 — grade distribution (manual reviews) */}
      <div style={{ flex: 1, minWidth: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {cap('Grades · reviewed')}
        {(() => {
          const gItems: [string, number, string][] = [['A', s.gradeA, GRADE_COL.A], ['B', s.gradeB, GRADE_COL.B], ['C', s.gradeC, GRADE_COL.C], ['D', s.gradeD, GRADE_COL.D]];
          const gTot = s.gradeA + s.gradeB + s.gradeC + s.gradeD;
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 27, letterSpacing: '-0.03em', color: '#1a1813' }}>{gTot}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#897f70' }}>graded</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#efeee9' }}>
                {gItems.map(([l, n, col]) => (gTot > 0 && n > 0) ? <div key={l} style={{ width: (n / gTot * 100) + '%', background: col }} /> : null)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                {gItems.map(([l, n, col]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flex: '0 0 auto' }} />
                    <span style={{ fontWeight: 800, fontSize: 12, color: '#1a1813' }}>{l}</span>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#897f70', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── filter chips ───────────────────────────────────────────────────────────────
const Eyebrow = ({ t, dot }: { t: string; dot?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 2 }}>
    {dot ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot, flex: '0 0 auto' }} /> : null}
    <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#aaa79c', whiteSpace: 'nowrap' }}>{t}</span>
  </div>
);
const FlowArrow = () => (
  <div style={{ flex: '0 0 auto', color: '#cfcbc1', display: 'flex', alignItems: 'center', padding: '0 2px' }}>
    <svg width={7} height={13} viewBox="0 0 7 13"><path d="M1 1 L6 6.5 L1 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
  </div>
);

// Journal filter bar — a connected spec-table flow: All Trades › Planned[…] /
// Unplanned[…] › Queue › Reviewed[A/B/C/D], joined by chevrons, no outer box.
function Filters({ s, cur, onSet }: { s: JStats; cur: JFilter; onSet: (k: JFilter) => void }) {
  // standalone rounded pill (All / To review)
  const chip = (k: JFilter, label: string, n: number, dot: string) => {
    const active = k === cur;
    return (
      <button onClick={() => onSet(k)} className="jfpill" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FONT, fontWeight: 600, fontSize: 12, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (active ? '#23211b' : '#eceae4'), background: active ? '#23211b' : '#fff', color: active ? '#fff' : '#4a443b', whiteSpace: 'nowrap', boxShadow: 'none' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: '0 0 auto' }} />{label}
        <span style={{ fontWeight: 800, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: active ? 'rgba(255,255,255,0.85)' : '#a8a69b', background: active ? 'rgba(255,255,255,0.16)' : '#f3f1ec', borderRadius: 99, padding: '1px 6px', minWidth: 8, textAlign: 'center' }}>{n}</span>
      </button>
    );
  };
  // connected segmented control
  const seg = (defs: [JFilter, string, string, number][]) => (
    <div style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid #e6e4dd', borderRadius: 999, background: '#fff', overflow: 'hidden', alignSelf: 'flex-start' }}>
      {defs.map(([k, label, dot, n], i) => {
        const active = k === cur;
        return (
          <button key={k} onClick={() => onSet(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONT, fontWeight: active ? 700 : 600, fontSize: 11.5, padding: '6px 11px', cursor: 'pointer', border: 'none', borderLeft: i > 0 ? '1px solid #efeee9' : 'none', background: active ? '#23211b' : 'transparent', color: active ? '#fff' : '#4a443b', whiteSpace: 'nowrap' }}>
            {dot ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: '0 0 auto' }} /> : null}{label}
            <span style={{ fontWeight: 800, fontSize: 9.5, fontVariantNumeric: 'tabular-nums', color: active ? 'rgba(255,255,255,0.8)' : '#a8a69b' }}>{n}</span>
          </button>
        );
      })}
    </div>
  );
  const Col = ({ eb, children }: { eb: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>{eb}{children}</div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 2px 8px', overflowX: 'auto' }}>
      <Col eb={<Eyebrow t="All Trades" />}>{chip('all', 'All', s.total, '#c2bfb4')}</Col>
      <FlowArrow />
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 14 }}>
        <Col eb={<Eyebrow t="Planned" dot="#7c5cff" />}>{seg([['planned', 'All', '#c2bfb4', s.plannedN], ['followed', 'Followed', '#1f9d55', s.followedN], ['off', 'Off-plan', '#d98a1f', s.offN], ['wrong', 'Wrong dir', '#df5338', s.wrongN]])}</Col>
        <Col eb={<Eyebrow t="Unplanned" dot="#b4b1a6" />}>{seg([['unplanned', 'No plan', '#b4b1a6', s.unplannedN]])}</Col>
      </div>
      <FlowArrow />
      <Col eb={<Eyebrow t="Queue" />}>{chip('review', 'To review', s.toReview, '#7c5cff')}</Col>
      <FlowArrow />
      <Col eb={<Eyebrow t="Reviewed" />}>{seg([['graded', 'All', '#c2bfb4', s.gradeA + s.gradeB + s.gradeC + s.gradeD], ['gA', 'A', GRADE_COL.A, s.gradeA], ['gB', 'B', GRADE_COL.B, s.gradeB], ['gC', 'C', GRADE_COL.C, s.gradeC], ['gD', 'D', GRADE_COL.D, s.gradeD]])}</Col>
    </div>
  );
}

// ── entries table ────────────────────────────────────────────────────────────
const GRID = '1.7fr 0.9fr 1.05fr 1.5fr 1.05fr 0.95fr 24px';
function Entries({ list, onOpen }: { list: JEntry[]; onOpen: (e: JEntry) => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece9e3', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '11px 18px', borderBottom: '1px solid #efeee9', background: '#faf9f7' }}>
        {['Trade', 'Side', 'Result', 'Plan', 'Adherence', 'Reviewed', ''].map((t, i) => (
          <span key={i} style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#a8a69b' }}>{t}</span>
        ))}
      </div>
      {list.length ? list.map((e, i) => <EntryRow key={e.t.pid} e={e} last={i === list.length - 1} onOpen={onOpen} />)
        : <div style={{ padding: '46px 18px', textAlign: 'center', fontWeight: 600, fontSize: 13, color: '#a8a69b' }}>No trades in this view.</div>}
    </div>
  );
}

function EntryRow({ e, last, onOpen }: { e: JEntry; last: boolean; onOpen: (e: JEntry) => void }) {
  const t = e.t, long = t.sideLong, dirCol = long ? '#1f9d55' : '#df5338', up = t.up;
  const arrow = (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={dirCol} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      {long ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7l10 10M9 17h8V9" />}
    </svg>
  );
  return (
    <div className="jrow" onClick={() => onOpen(e)} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, alignItems: 'center', padding: '13px 18px', borderBottom: last ? 'none' : '1px solid #f4f3f0', cursor: 'pointer', transition: 'background .12s' }}>
      {/* trade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <CoinIcon sym={baseSym(t.sym)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: '#1a1813' }}>{t.sym.replace('/USDT.P', '')}</span>
          <span style={{ fontWeight: 600, fontSize: 11, color: '#a8a69b' }}>{t.date}</span>
        </div>
      </div>
      {/* side */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: dirCol }}>
        {arrow}{long ? 'Long' : 'Short'}<span style={{ fontWeight: 700, fontSize: 10.5, color: '#a8a69b' }}>{t.lev}</span>
      </span>
      {/* result */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.02em', color: up ? '#1f9d55' : '#df5338' }}>{t.pnl}</span>
        <span style={{ fontWeight: 600, fontSize: 11, color: '#a8a69b' }}>{t.ret}</span>
      </div>
      {/* plan — inline link/unlink picker (portaled, so the table won't clip it) */}
      <div style={{ minWidth: 0 }} onClick={(ev) => ev.stopPropagation()}>
        <PlanLinkCell pid={t.pid} />
      </div>
      {/* adherence verdict */}
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.02em', color: e.adh.color, background: e.adh.bg, border: '1px solid ' + e.adh.border, borderRadius: 99, padding: '3px 9px 3px 7px' }}>
          {e.adh.scored ? <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 17, height: 17, padding: '0 4px', borderRadius: 99, background: e.adh.color, color: '#fff', fontWeight: 800, fontSize: 9.5, fontVariantNumeric: 'tabular-nums' }}>{e.adh.score}</span> : null}
          {e.adh.label}
        </span>
      </div>
      {/* review */}
      <div>
        {e.reviewed ? (
          e.rec.grade ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 11.5, color: GRADE_COL[e.rec.grade] || '#1f9d55' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 6, background: GRADE_COL[e.rec.grade] || '#1f9d55', color: '#fff', fontWeight: 800, fontSize: 11, flex: '0 0 auto' }}>{e.rec.grade}</span>Graded
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, fontSize: 11.5, color: '#1f9d55' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f9d55', flex: '0 0 auto' }} />Reviewed
            </span>
          )
        ) : <span style={{ fontWeight: 700, fontSize: 11.5, color: '#c08a3e' }}>Add note ›</span>}
      </div>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#cbc8be" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </div>
  );
}

// ── drawer ───────────────────────────────────────────────────────────────────
function JournalDrawer({ e, onClose }: { e: JEntry; onClose: () => void }) {
  const t = e.t, long = t.sideLong, dirCol = long ? '#1f9d55' : '#df5338', up = t.up;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,12,0.32)', zIndex: 120, animation: 'fadeIn .2s ease' }} />
      <div onClick={(ev) => ev.stopPropagation()} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 486, maxWidth: '94vw', background: '#fff', zIndex: 121, boxShadow: '-24px 0 60px rgba(20,18,12,0.2)', display: 'flex', flexDirection: 'column', animation: 'drawerIn .3s cubic-bezier(.22,.8,.3,1)', fontFamily: FONT }}>
        {/* header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid #f0efec' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: '#faf9f7', border: '1px solid #efeee9', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <div style={{ transform: 'scale(1.7)', display: 'flex' }}><CoinIcon sym={baseSym(t.sym)} /></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em', color: '#1a1813' }}>{t.sym.replace('/USDT.P', '')} · {t.date}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 11, color: dirCol, background: long ? '#ebf6ef' : '#fdeee9', borderRadius: 99, padding: '3px 9px' }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={dirCol} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">{long ? <path d="M7 17 17 7M9 7h8v8" /> : <path d="M7 7l10 10M9 17h8V9" />}</svg>
                    {long ? 'Long' : 'Short'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#897f70' }}>{t.lev} · held {t.durStr}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 21, letterSpacing: '-0.03em', color: up ? '#1f9d55' : '#df5338' }}>{t.pnl}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#a8a69b' }}>{t.ret}</span>
              </div>
              <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ebe9e4', background: '#fff', color: '#8c897f', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
              </button>
            </div>
          </div>
        </div>
        {/* body */}
        <div style={{ padding: '22px 24px 30px', overflowY: 'auto' }}>
          <DrawerBody e={e} onClose={onClose} />
        </div>
      </div>
    </>
  );
}

const sectionLabel = (txt: string, accent?: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 13px' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent || '#7c5cff' }} />
    <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8c8a81' }}>{txt}</span>
  </div>
);

function SpecRow({ label, vPlan, vAct, pc, ac }: { label: string; vPlan: string; vAct: string; pc?: string; ac?: string }) {
  const cell = (v: string, c?: string, border?: boolean) => (
    <div style={{ padding: '10px 14px', borderRight: border ? '1px solid #f1f0ed' : undefined }}>
      <div style={{ fontWeight: 600, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b0aea3', marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.01em', color: v === '—' ? '#c8c5bb' : (c || '#1a1813') }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #f1f0ed' }}>
      {cell(vPlan, pc, true)}{cell(vAct, ac)}
    </div>
  );
}

function DrawerBody({ e, onClose }: { e: JEntry; onClose: () => void }) {
  const { journal } = usePlanStore();
  const { data: account } = useAccount();
  const equity = parseFloat(account?.total || '') || TP_EQUITY;
  const t = e.t, long = t.sideLong, dirCol = long ? '#1f9d55' : '#df5338', up = t.up;
  const plan = e.plan, adh = e.adh;
  const rec = journal[t.pid] || {};

  // plan reference values for the spec table
  let pMarPct = NaN; let pDraft: ReturnType<typeof planToDraft> | null = null;
  if (plan) { try { pDraft = planToDraft(plan); pMarPct = tpCompute(pDraft, equity).marginPct; } catch { pMarPct = NaN; } }
  const aMarPct = (t.marginN / equity) * 100;
  const planMarTxt = plan ? (isFinite(pMarPct) ? pMarPct.toFixed(1) + '% of equity' : '—') : '—';
  const actMarTxt = t.marginStr + (isFinite(aMarPct) ? ' · ' + aMarPct.toFixed(1) + '%' : '');
  const marOver = !!plan && isFinite(pMarPct) && isFinite(aMarPct) && aMarPct > Math.min(pMarPct, 50) + 0.05;
  const planExitTxt = plan
    ? (up ? (pDraft && pDraft.t1 ? '$' + Number(pDraft.t1).toLocaleString('en-US') : (plan.rr ? 'R:R ' + plan.rr : '—'))
          : (plan.stopLabel || (plan.stop ? '$' + Number(plan.stop).toLocaleString('en-US') : '—')))
    : '—';
  const exitLabel = plan ? (up ? 'Take-profit → Exit' : 'Stop → Exit') : 'Exit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. Intended vs actual */}
      <div>
        {sectionLabel('Intended vs actual')}
        <div style={{ border: '1px solid #ece9e3', borderRadius: 13, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#faf9f7' }}>
            {plan ? (
              <div className="jplan-link" onClick={() => { onClose(); planActions.openPlan(plan.id); }} title="Open this plan" style={{ padding: '9px 14px', borderRight: '1px solid #f1f0ed', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#7c5cff', minWidth: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c5cff', flex: '0 0 auto' }} />
                <span className="jplan-name" style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid rgba(124,92,255,0.32)', paddingBottom: 1 }}>{tpPlanName(plan)}</span>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><path d="M7 17 17 7M8 7h9v9" /></svg>
                <button onClick={(ev) => { ev.stopPropagation(); planActions.linkClear(t.pid); }} title="Unlink plan" style={{ marginLeft: 'auto', flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 19, height: 19, borderRadius: 99, border: '1px solid #e7dffa', background: '#fff', cursor: 'pointer', color: '#9b86e6', padding: 0 }}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round"><path d="M5 12h14" /></svg>
                </button>
              </div>
            ) : (
              <div style={{ padding: '9px 14px', borderRight: '1px solid #f1f0ed', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7c5cff' }} />
                <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7c5cff' }}>Intended · plan</span>
              </div>
            )}
            <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1a1813' }} />
              <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a1813' }}>Actual · filled</span>
            </div>
          </div>
          <SpecRow label="Direction" vPlan={plan ? (plan.dir === 'long' ? 'Long' : 'Short') : '—'} vAct={long ? 'Long' : 'Short'} pc={plan ? (plan.dir === 'long' ? '#1f9d55' : '#df5338') : undefined} ac={dirCol} />
          <SpecRow label="Entry" vPlan={plan ? (plan.entryLabel || ('$' + plan.entry)) : '—'} vAct={t.entryStr} />
          <SpecRow label="Leverage" vPlan={plan ? (plan.lev + '×') : '—'} vAct={t.lev} ac={(plan && t.levN > (parseInt(String(plan.lev), 10) || 99)) ? '#df5338' : '#1a1813'} />
          <SpecRow label="Margin" vPlan={planMarTxt} vAct={actMarTxt} ac={marOver ? '#df5338' : '#1a1813'} />
          <SpecRow label={exitLabel} vPlan={planExitTxt} vAct={t.exitStr + (t.ret ? ' · ' + t.ret : '')} ac={up ? '#1f9d55' : '#df5338'} />
        </div>
      </div>

      {/* 2. Adherence */}
      {plan && adh.checks ? (
        <div style={{ marginTop: 22 }}>
          {sectionLabel('Adherence', adh.color)}
          <ScoreHead adh={adh} up={up} />
          <div style={{ border: '1px solid #ece9e3', borderRadius: 13, overflow: 'hidden', marginTop: 11 }}>
            {adh.checks.map((c) => <CheckRow key={c.label} c={c} />)}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          {sectionLabel('Adherence')}
          <div style={{ padding: 16, background: '#faf9f7', border: '1px dashed #e2e0d8', borderRadius: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#6b6357', lineHeight: 1.5 }}>This trade isn’t linked to a plan, so there’s nothing to score it against. Link one to measure adherence.</span>
            <div style={{ position: 'relative', alignSelf: 'flex-start' }}><PlanLinkCell pid={t.pid} /></div>
          </div>
        </div>
      )}

      {/* 3. Review */}
      <Review e={e} rec={rec} />
    </div>
  );
}

function ScoreHead({ adh, up }: { adh: JEntry['adh']; up: boolean }) {
  const wrong = !adh.dirMatch;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: adh.bg, borderRadius: 12, border: '1px solid ' + adh.border }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '2px solid ' + adh.suggColor }}>
        <span style={{ fontWeight: 800, fontSize: 18, lineHeight: 1, letterSpacing: '-0.03em', color: '#1a1813' }}>{adh.score}</span>
        <span style={{ fontWeight: 700, fontSize: 7, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b4ab9c' }}>score</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 800, fontSize: 14.5, letterSpacing: '-0.01em', color: adh.color }}>{wrong ? 'Wrong direction — plan voided' : adh.followed ? 'You followed your plan' : 'You drifted off-plan'}</span>
        <span style={{ fontWeight: 600, fontSize: 11.5, color: '#897f70', lineHeight: 1.4 }}>{wrong ? 'Opposite side of the plan — nothing else counts.' : adh.followed ? (up ? 'Right process, right result.' : 'Right process — the loss was within the rules.') : 'The result doesn’t excuse the deviation.'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: '0 0 auto', padding: '6px 12px', borderRadius: 10, background: adh.suggColor }}>
        <span style={{ fontWeight: 800, fontSize: 20, lineHeight: 1, color: '#fff' }}>{adh.suggGrade}</span>
        <span style={{ fontWeight: 700, fontSize: 8, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>suggested</span>
      </div>
    </div>
  );
}

function CheckRow({ c }: { c: AdhCheck }) {
  const st = c.s >= 0.999 ? 'pass' : c.s <= 0.001 ? 'fail' : 'partial';
  const stCol = { pass: '#1f9d55', partial: '#d98a1f', fail: '#df5338' } as const;
  const stBg = { pass: '#ebf6ef', partial: '#fbf2e3', fail: '#fdeee9' } as const;
  const ic = st === 'pass'
    ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={stCol.pass} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    : st === 'fail'
      ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={stCol.fail} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} /></svg>
      : <span style={{ width: 8, height: 8, borderRadius: 2, background: stCol.partial, transform: 'rotate(45deg)' }} />;
  const ptsTxt = c.gate ? 'GATE' : (Math.round(c.s * (c.weight || 0)) + '/' + c.weight);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: '1px solid #f1f0ed' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: stBg[st] }}>{ic}</span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#2a271f' }}>{c.label}</span>
          {c.conf === 'inferred' ? <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#a59c8c', background: '#f1efe9', padding: '2px 5px', borderRadius: 4 }}>inferred</span> : null}
        </div>
        <span style={{ fontWeight: 600, fontSize: 11, color: '#9b9488', lineHeight: 1.35 }}>{c.detail}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: '0 0 auto' }}>
        <span style={{ fontWeight: 800, fontSize: 11.5, color: c.gate ? '#8c8a81' : stCol[st], fontVariantNumeric: 'tabular-nums' }}>{ptsTxt}</span>
        <span style={{ fontWeight: 600, fontSize: 10.5, color: '#b4ab9c' }}>{c.got}</span>
      </div>
    </div>
  );
}

function Review({ e, rec }: { e: JEntry; rec: { grade?: string; note?: string } }) {
  const t = e.t, plan = e.plan, adh = e.adh;
  const grades: [string, string, string, string][] = [['A', 'Textbook', GRADE_COL.A, '90–100'], ['B', 'Solid', GRADE_COL.B, '75–89'], ['C', 'Sloppy', GRADE_COL.C, '60–74'], ['D', 'Tilt', GRADE_COL.D, '< 60']];
  const showSugg = !!plan && adh.scored;
  return (
    <div style={{ marginTop: 22 }}>
      {sectionLabel('Your review', '#d98a1f')}
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b0aea3', marginBottom: 8 }}>Process grade — did you follow your process?</div>
      {showSugg ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', marginBottom: 10, borderRadius: 10, background: '#faf9f7', border: '1px dashed #e2e0d8' }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: adh.suggColor, color: '#fff', fontWeight: 800, fontSize: 13 }}>{adh.suggGrade}</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 11.5, color: '#6b6357', lineHeight: 1.4 }}>Suggested from adherence ({adh.score}/100). Confirm or override — your call.</span>
          {rec.grade !== adh.suggGrade ? (
            <button onClick={() => planActions.setJournalField(t.pid, { grade: adh.suggGrade, reviewed: true })} style={{ flex: '0 0 auto', padding: '6px 11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: adh.suggColor, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 11 }}>Apply</button>
          ) : <span style={{ flex: '0 0 auto', fontWeight: 700, fontSize: 10.5, color: adh.suggColor }}>✓ applied</span>}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        {grades.map(([g, lbl, col, band]) => {
          const on = rec.grade === g;
          return (
            <button key={g} onClick={() => planActions.setJournalField(t.pid, { grade: g, reviewed: true })} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '9px 6px', borderRadius: 11, cursor: 'pointer', border: '1.5px solid ' + (on ? col : '#eceae4'), background: on ? col : '#fff', transition: 'all .14s' }}>
              <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: on ? '#fff' : '#1a1813' }}>{g}</span>
              <span style={{ fontWeight: 700, fontSize: 10, color: on ? 'rgba(255,255,255,0.85)' : '#a8a69b' }}>{lbl}</span>
              <span style={{ fontWeight: 700, fontSize: 9, fontVariantNumeric: 'tabular-nums', color: on ? 'rgba(255,255,255,0.7)' : '#c2bfb4' }}>{band}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#b0aea3', margin: '16px 0 8px' }}>Notes</div>
      <textarea key={'note_' + t.pid} defaultValue={rec.note || ''} placeholder="What did you do well? What would you change next time?"
        onBlur={(ev) => planActions.setJournalField(t.pid, { note: ev.target.value, reviewed: true })} className="jnote"
        style={{ width: '100%', minHeight: 92, resize: 'vertical', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: '1px solid #e7e5df', background: '#faf9f7', fontFamily: FONT, fontWeight: 500, fontSize: 13, lineHeight: 1.55, color: '#2a271f', outline: 'none' }} />
    </div>
  );
}
