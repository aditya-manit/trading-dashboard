'use client';

import { HeatmapPage } from './HeatmapPage';
import { useHeatmapLaunch, heatmapLaunch } from '@/lib/heatmap-launch';

// Full-screen launcher for the liquidation heatmap. Opened from the workbook
// Step 5 card and the plan editor's Levels card (heatmapLaunch.open(symbol)); the
// page underneath stays mounted, so closing returns the user where they were.
export function HeatmapOverlay() {
  const { open, symbol } = useHeatmapLaunch();
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'var(--bg, #e9e8e4)' }}>
      <HeatmapPage initialSymbol={symbol} onClose={() => heatmapLaunch.close()} />
    </div>
  );
}
