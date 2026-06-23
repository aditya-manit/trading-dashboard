'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Hero } from '@/components/hero/Hero';
import { EquityChart } from '@/components/charts/EquityChart';
import { HighlightCards } from '@/components/stats/HighlightCards';
import { RealizedPerformance } from '@/components/stats/RealizedPerformance';
import { KpiStrip } from '@/components/stats/KpiStrip';
import { PositionsTable } from '@/components/positions/PositionsTable';
import { KeyMetricsRow } from '@/components/stats/KeyMetricsRow';
import { PositionHistoryTable } from '@/components/positions-history/PositionHistoryTable';
import { PlanFunnel } from '@/components/plan/PlanFunnel';
import { HeatmapOverlay } from '@/components/heatmap/HeatmapOverlay';

export default function DashboardPage() {
  const [page, setPage] = useState<'dashboard' | 'plan'>('plan');

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontVariantNumeric: 'tabular-nums', color: '#181712' }}>
      <div style={{ background: '#ffffff', minHeight: '100vh' }}>
        <Topbar page={page} onPageChange={setPage} />
        <div style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {page === 'plan' ? (
            <PlanFunnel />
          ) : (
            <>
              <section id="overview" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <Hero />
                <EquityChart />
                <HighlightCards />
                <RealizedPerformance />
                <KpiStrip />
              </section>
              <section id="positions"><PositionsTable /></section>
              <section id="reports"><KeyMetricsRow /></section>
              <section id="history"><PositionHistoryTable /></section>
            </>
          )}
        </div>
      </div>
      {/* Full-screen liquidation heatmap, launched from workbook Step 5 / plan editor */}
      <HeatmapOverlay />
    </div>
  );
}
