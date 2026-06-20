'use client';

import { useState } from 'react';
import { usePlanStore, planActions } from '@/lib/plan-store';
import { tpPlanName, type Plan } from '@/lib/plan-model';
import { CoinIcon } from './coins';

// base symbol from a pid like "BTC/USDT.P" or a trade pid "BTC/USDT.P#Jun09#3"
const baseSym = (pid: string) => pid.split('/')[0].replace('.P', '').trim();
const STAT: Record<string, [string, string, string]> = {
  idea: ['Idea', '#7c5cff', '#f3f0ff'],
  armed: ['Armed', '#d98a1f', '#fbf2e3'],
  triggered: ['Triggered', '#1f9d55', '#ebf6ef'],
};

// Notion-style plan↔position/trade link cell. In the dashboard TABLE (overflow
// clips an absolute menu) pass `openDrawer` → the chip routes to the row's drawer
// where the inline dropdown lives. In drawers (no clip), omit it → inline picker.
export function PlanLinkCell({ pid, openDrawer }: { pid: string; openDrawer?: () => void }) {
  const { links, plans } = usePlanStore();
  const [open, setOpen] = useState(false);
  const curId = links[pid];
  const linked = curId ? plans.find((p) => p.id === curId) : null;

  const toggle = (e: React.MouseEvent) => { e.stopPropagation(); if (openDrawer) { openDrawer(); return; } setOpen((v) => !v); };

  const chip = linked ? (() => {
    const long = linked.dir === 'long', col = long ? '#1f9d55' : '#df5338';
    return (
      <span onClick={toggle} title={'Linked to ' + tpPlanName(linked)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', cursor: 'pointer', background: open ? '#ece6fb' : '#f3f0ff', border: '1px solid #e7dffa', padding: '4px 9px 4px 8px', borderRadius: 7, transition: 'background .12s' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flex: '0 0 auto' }} />
        <span style={{ fontWeight: 700, fontSize: 11.5, color: '#5b46c9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(linked)}</span>
        {openDrawer ? null : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#9683df" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9" /></svg>}
      </span>
    );
  })() : (
    <span onClick={toggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: open ? '#7c5cff' : '#a8a69b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', border: '1px dashed ' + (open ? '#c3b4f5' : '#dcdad1'), background: open ? '#f7f4ff' : 'transparent', padding: '4px 10px 4px 8px', borderRadius: 7, transition: 'border-color .12s,color .12s' }}>
      <span style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>+</span> Link plan
    </span>
  );

  return (
    <span style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
      {chip}
      {open && !openDrawer ? (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 198 }} />
          <Dropdown pid={pid} curId={curId} plans={plans} onClose={() => setOpen(false)} />
        </>
      ) : null}
    </span>
  );
}

function Dropdown({ pid, curId, plans, onClose }: { pid: string; curId?: string; plans: Plan[]; onClose: () => void }) {
  const base = baseSym(pid);
  const ordered = plans.filter((p) => p.sym === base).concat(plans.filter((p) => p.sym !== base));
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 7px)', left: 0, zIndex: 200, width: 290, maxWidth: '78vw', background: '#fff', border: '1px solid #e9e7e2', borderRadius: 13, boxShadow: '0 16px 44px rgba(20,18,14,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 332 }}>
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {ordered.length === 0 ? (
          <div style={{ padding: '26px 18px', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#a8a69b', lineHeight: 1.5 }}>No saved plans yet. Plan a trade first, then link it here.</div>
        ) : ordered.map((p) => {
          const long = p.dir === 'long', col = long ? '#1f9d55' : '#df5338';
          const st = STAT[p.status] || STAT.idea, sel = p.id === curId;
          return (
            <button key={p.id} onClick={(e) => { e.stopPropagation(); planActions.linkSet(pid, p.id); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: sel ? '#f7f4ff' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              <CoinIcon sym={p.sym} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: '-0.01em', color: '#1a1813', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpPlanName(p)}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 10, color: '#a8a69b' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: col, flex: '0 0 auto' }} />
                  {(long ? 'Long' : 'Short') + ' · ' + p.lev + '× · R:R ' + (p.rr || '—')}
                </span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 9, letterSpacing: '0.04em', color: st[1], background: st[2], padding: '3px 7px', borderRadius: 99, flex: '0 0 auto' }}>{st[0].toUpperCase()}</span>
              {sel ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#7c5cff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><polyline points="20 6 9 17 4 12" /></svg> : null}
            </button>
          );
        })}
      </div>
      {curId ? (
        <button onClick={(e) => { e.stopPropagation(); planActions.linkClear(pid); onClose(); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: 11, border: 'none', borderTop: '1px solid #f1f0ed', background: '#fff', color: '#df5338', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" /></svg>
          Remove link
        </button>
      ) : null}
    </div>
  );
}
