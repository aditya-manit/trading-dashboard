'use client';

import { useEffect, useState } from 'react';
import { HeatmapPage } from '@/components/heatmap/HeatmapPage';
import type { HeatSymbol } from '@/hooks/useHeatmap';

// Standalone liquidation-heatmap page — opened in a NEW TAB from the workbook Step 5
// card, the plan editor's Levels card, and the global Topbar button
// (window.open('/heatmap?symbol=…')). Auth is the same owner+MFA gate (shared cookie).
export default function HeatmapRoute() {
  const [mounted, setMounted] = useState(false);
  const [symbol, setSymbol] = useState<HeatSymbol>('BTC');
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('symbol');
    if (s === 'ETH' || s === 'SOL') setSymbol(s);
    setMounted(true);
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg, #e9e8e4)' }}>
      {mounted ? <HeatmapPage initialSymbol={symbol} onClose={() => window.close()} /> : null}
    </div>
  );
}
