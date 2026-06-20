'use client';

import { useEffect, useState } from 'react';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpCompute, planToDraft, tpPlanName, type Plan, type PlanDraft, type Status } from '@/lib/plan-model';
import { LiveMath } from './LiveMath';
import { RrDiagram } from './RrDiagram';
import { CoinIcon } from './coins';

const STATUSES: { k: Status; label: string; c: string; bg: string }[] = [
  { k: 'idea', label: 'Idea', c: '#6a45d8', bg: '#f3f0ff' },
  { k: 'armed', label: 'Armed', c: '#1f8a52', bg: '#eef8f1' },
  { k: 'triggered', label: 'Triggered', c: '#c9821f', bg: '#fbf2e3' },
];
const CONVS = [{ k: 'low', label: 'Low', n: 1 }, { k: 'med', label: 'Medium', n: 2 }, { k: 'high', label: 'High', n: 3 }] as const;
type ThesisKey = 'rationale' | 'trigger' | 'invalidation' | 'targetNote';
const THESIS: { k: ThesisKey; lab: string; dot: string }[] = [
  { k: 'rationale', lab: 'Rationale', dot: '#7c5cff' },
  { k: 'trigger', lab: 'Trigger', dot: '#1f9d55' },
  { k: 'invalidation', lab: 'Invalidation', dot: '#df5338' },
  { k: 'targetNote', lab: 'Target / exit', dot: '#c9821f' },
];
const hexRgba = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const icoBtn = { cursor: 'pointer', border: '1px solid #ebe9e4', background: '#fff', width: 34, height: 34, borderRadius: '50%', color: '#8c897f', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' } as const;
const cardWrap = { background: '#fff', border: '1px solid #efedea', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.04)' } as const;

function ConvDots({ n, sz = 6 }: { n: number; sz?: number }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: sz, height: sz, borderRadius: '50%', background: i < n ? '#7c5cff' : 'transparent', border: i < n ? 'none' : '1.5px solid #d3cfe6', boxSizing: 'border-box' }} />)}</span>;
}
function StageHead({ txt, accent }: { txt: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: '1px solid #f4f3f0' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }} />
      <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#56544b' }}>{txt}</span>
    </div>
  );
}

export function PlanDrawer() {
  const { openPlanId, plans } = usePlanStore();
  const [full, setFull] = useState<string | null>(null);
  const [statusMenu, setStatusMenu] = useState(false);
  const [convMenu, setConvMenu] = useState(false);
  const [stage, setStage] = useState(false); // desktop ≥900px → side stage panel
  useEffect(() => {
    const u = () => setStage(window.innerWidth >= 900);
    u(); window.addEventListener('resize', u);
    return () => window.removeEventListener('resize', u);
  }, []);
  const p = openPlanId ? plans.find((x) => x.id === openPlanId) : null;
  if (!p) return null;

  const long = p.dir === 'long', col = long ? '#1f9d55' : '#df5338';
  const d = planToDraft(p), c = tpCompute(d);
  const sm = STATUSES.find((s) => s.k === p.status) || STATUSES[0];
  const convCur = p.conv === 'high' ? 3 : p.conv === 'low' ? 1 : 2;
  const close = () => planActions.closePlan();
  const name = tpPlanName(p);
  let l1 = name, l2 = '';
  if (name.length > 26) { const cut = name.lastIndexOf(' ', 26); const k = cut > 12 ? cut : 26; l1 = name.slice(0, k); l2 = name.slice(k).trim(); }
  const dirArrow = <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">{long ? <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></> : <><path d="M7 7 17 17" /><path d="M17 8v9H8" /></>}</svg>;

  const thesisEl = (
    <div style={{ margin: '0 -24px', borderTop: '1px solid #efedea', borderBottom: '1px solid #efedea', overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: '1px solid #efe9fb', background: '#f6f4ff' }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, background: '#f3f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg></span>
        <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6a45d8' }}>Thesis</span>
      </div>
      {THESIS.map((t, i) => (
        <div key={t.k} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px', borderBottom: i < 3 ? '1px solid #f3f2ef' : 'none' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 9.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: hexRgba(t.dot, 0.92) }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dot }} />{t.lab}</span>
          <textarea key={p.id + '_' + t.k} defaultValue={String(p[t.k] ?? '')} placeholder={'Add ' + t.lab.toLowerCase() + '…'} rows={1}
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p[t.k] || '')) planActions.updateThesis(p.id, t.k, v); }}
            style={{ display: 'block', width: '100%', margin: 0, padding: 0, boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontWeight: 500, fontSize: 13, lineHeight: 1.55, color: '#3a382f', overflowWrap: 'anywhere', fieldSizing: 'content' } as React.CSSProperties} />
        </div>
      ))}
    </div>
  );
  const liveMathEl = <div style={{ margin: '0 -24px', borderBottom: '1px solid #f1f0ed' }}><LiveMath c={c} d={d} idSuffix={p.id} /></div>;
  const diagramEl = <div style={{ margin: '0 -24px', borderTop: '1px solid #f1f0ed', borderBottom: '1px solid #f1f0ed', padding: '16px 4px 18px' }}><RrDiagram c={c} d={d} compact /></div>;
  const chartCardEl = p.chart ? (
    <div style={{ margin: '0 -24px', borderTop: '1px solid #f1f0ed', borderBottom: '1px solid #f1f0ed', background: '#fcfbfa', padding: '14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 11 }}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={3} width={18} height={18} rx={2} /><circle cx={8.5} cy={8.5} r={1.6} /><path d="m21 15-5-5L5 21" /></svg>
        <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b0aea3' }}>Your chart</span>
      </div>
      <div onClick={() => setFull(p.chart || null)} style={{ position: 'relative', borderRadius: 11, overflow: 'hidden', border: '1px solid #ececea', cursor: 'zoom-in' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.chart} alt="chart" style={{ display: 'block', width: '100%', height: 'auto', background: '#fff' }} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <style>{`@keyframes pdIn{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes pdFade{from{opacity:0}to{opacity:1}}@keyframes pdStageIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,18,12,0.34)', backdropFilter: 'blur(2px)', animation: 'pdFade .2s both' }} />

      {/* desktop stage panel: big R/R map + chart, left of the drawer */}
      {stage ? (
        <div style={{ position: 'fixed', top: 0, bottom: 0, right: 434, width: 'min(680px, calc(100vw - 494px))', zIndex: 92, background: '#faf9f7', borderRight: '1px solid #e7e5de', display: 'flex', flexDirection: 'column', animation: 'pdStageIn .36s cubic-bezier(.22,.9,.28,1) both' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 30px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardWrap}>
              <StageHead txt="Risk / reward map" accent="#7c5cff" />
              <div style={{ padding: '4px 16px 12px', display: 'flex', justifyContent: 'center' }}><div style={{ width: '100%', maxWidth: 600 }}><RrDiagram c={c} d={d} /></div></div>
            </div>
            {p.chart ? (
              <div style={cardWrap}>
                <StageHead txt="Your chart" accent="#1f9d55" />
                <div onClick={() => setFull(p.chart || null)} style={{ padding: 14, cursor: 'zoom-in', display: 'flex', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.chart} alt="chart" style={{ display: 'block', width: '100%', maxWidth: 720, height: 'auto', borderRadius: 10, border: '1px solid #f0efec' }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 434, maxWidth: '100vw', zIndex: 91, background: '#fff', boxShadow: '-12px 0 40px rgba(20,18,12,0.16)', display: 'flex', flexDirection: 'column', animation: 'pdIn .28s cubic-bezier(.22,1,.36,1) both' }}>
        {/* header */}
        <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '20px 22px', borderBottom: '1px solid #f0efec', background: 'linear-gradient(180deg,#fcfbf9,#fff)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div style={{ width: 38, height: 38, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ transform: 'scale(2.53)', display: 'flex' }}><CoinIcon sym={p.sym} /></div></div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#1a1813', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l1}</span>
                {l2 ? <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, color: '#b3b0a6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l2}</span> : null}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: col }}>{dirArrow}{long ? 'Long' : 'Short'}</span>
              <Dot />
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3 }}><span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em', color: '#1a1813' }}>{p.lev}×</span><span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b3b0a6' }}>lev</span></span>
              <Dot />
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <button onClick={(e) => { e.stopPropagation(); setConvMenu((v) => !v); setStatusMenu(false); }} title="Conviction" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0 }}>
                  <ConvDots n={convCur} /><svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#bbb3a8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {convMenu ? <Menu onClose={() => setConvMenu(false)}>{CONVS.map((cv) => <MenuRow key={cv.k} active={cv.k === p.conv} onClick={() => { setConvMenu(false); planActions.updateThesis(p.id, 'conv', cv.k); }}><ConvDots n={cv.n} />{cv.label}</MenuRow>)}</Menu> : null}
              </span>
              <Dot />
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <button onClick={(e) => { e.stopPropagation(); setStatusMenu((v) => !v); setConvMenu(false); }} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: sm.c, background: sm.bg, padding: '3px 6px 3px 9px', borderRadius: 99, border: 'none' }}>{sm.label}<svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65 }}><polyline points="6 9 12 15 18 9" /></svg></button>
                {statusMenu ? <Menu onClose={() => setStatusMenu(false)}>{STATUSES.map((st) => <MenuRow key={st.k} active={st.k === p.status} onClick={() => { setStatusMenu(false); if (st.k !== p.status) planActions.movePlan(p.id, st.k); }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: st.c }} />{st.label}</MenuRow>)}</Menu> : null}
              </span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,34px)', gap: 7, flex: '0 0 auto' }}>
            <button onClick={() => planActions.startEdit(p.id, planToDraft(p))} title="Edit plan" style={icoBtn}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg></button>
            <button onClick={close} title="Close" style={icoBtn}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg></button>
            <button onClick={() => planActions.duplicatePlan(p.id)} title="Duplicate" style={icoBtn}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x={9} y={9} width={13} height={13} rx={2} /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></button>
            <button onClick={() => { planActions.deletePlan(p.id); close(); }} title="Delete" style={icoBtn}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg></button>
          </div>
        </div>

        {/* body — stage: live-math + thesis; else: thesis + live-math + diagram + chart */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {stage ? <>{liveMathEl}{thesisEl}</> : <>{thesisEl}{liveMathEl}{diagramEl}{chartCardEl}</>}
        </div>
      </div>

      {full ? <div onClick={() => setFull(null)} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(14,13,11,0.88)', display: 'grid', placeItems: 'center', padding: 40, cursor: 'zoom-out' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={full} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} /></div> : null}
    </>
  );
}

function Dot() { return <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#d6d4cc' }} />; }
function Menu({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 24 }} />
      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 25, background: '#fff', borderRadius: 12, border: '1px solid #ececea', boxShadow: '0 14px 34px rgba(20,18,12,0.16)', padding: 5, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 156 }}>{children}</div>
    </>
  );
}
function MenuRow({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? '#faf9f7' : 'transparent', fontFamily: 'inherit', textAlign: 'left', fontWeight: 700, fontSize: 12.5, color: '#1a1813', width: '100%' }}>
      {children}
      {active ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1f9d55" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12" /></svg> : null}
    </button>
  );
}
