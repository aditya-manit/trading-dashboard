'use client';

import { usePlanStore, planActions } from '@/lib/plan-store';
import { PlanPage } from './PlanPage';
import { Editor } from './Editor';
import { Board } from './Board';
import { PlanDrawer } from './PlanDrawer';

// Top-level Plan view switcher (workbook · editor · board · journal). Workbook is
// the existing PlanPage (5-step + live news). The plan-detail drawer overlays any
// view (top-level, like the design). Journal is built in a later phase.
export function PlanFunnel() {
  const { view } = usePlanStore();
  return (
    <>
      {view === 'editor' ? <Editor /> : view === 'board' ? <Board onOpen={(p) => planActions.openPlan(p.id)} /> : view === 'journal' ? <JournalSoon /> : <PlanPage />}
      <PlanDrawer />
    </>
  );
}

function JournalSoon() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 360, textAlign: 'center', gap: 12 }}>
      <span style={{ width: 52, height: 52, borderRadius: 15, background: '#f4f3f0', display: 'grid', placeItems: 'center' }}>
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1813' }}>Journal — building next</span>
        <span style={{ fontWeight: 500, fontSize: 13, color: '#a8a69b' }}>Post-trade review + plan-adherence scoring against your real Gate.io trades.</span>
      </div>
    </div>
  );
}
