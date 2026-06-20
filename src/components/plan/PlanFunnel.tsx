'use client';

import { usePlanStore, planActions } from '@/lib/plan-store';
import { PlanPage } from './PlanPage';
import { Editor } from './Editor';
import { Board } from './Board';
import { Journal } from './Journal';
import { PlanDrawer } from './PlanDrawer';

// Top-level Plan view switcher (workbook · editor · board · journal). Workbook is
// the existing PlanPage (5-step + live news). The plan-detail drawer overlays any
// view (top-level, like the design). Journal is built in a later phase.
export function PlanFunnel() {
  const { view } = usePlanStore();
  return (
    <>
      {view === 'editor' ? <Editor /> : view === 'board' ? <Board onOpen={(p) => planActions.openPlan(p.id)} /> : view === 'journal' ? <Journal /> : <PlanPage />}
      <PlanDrawer />
    </>
  );
}
