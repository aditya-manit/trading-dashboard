'use client';

import { useState, type ReactNode } from 'react';
import { heatmapLaunch } from '@/lib/heatmap-launch';
import { HeatMatrixIcon } from './HeatMatrixIcon';
import type { HeatSymbol } from '@/hooks/useHeatmap';

// Launch card for the full-screen liquidation heatmap (handoff 34: unified
// heat-matrix icon). Two variants:
//   'card' — white bordered card, "Shorts vs longs" eyebrow (workbook Step 5)
//   'row'  — borderless link row with a top divider (plan editor Levels)
// Per the no-hover-lift rule, the card hover shifts shadow + border-color only.
export function HeatmapLaunchCard({
  symbol = 'BTC',
  title = 'See the live liquidation heatmap',
  sub = 'Which side is offside, and where.',
  variant = 'card',
  eyebrow,
}: { symbol?: HeatSymbol; title?: string; sub?: string; variant?: 'card' | 'row'; eyebrow?: ReactNode }) {
  const [hov, setHov] = useState(false);
  const isCard = variant === 'card';
  const iconSize = isCard ? 46 : 42;
  const defaultEyebrow = isCard
    ? <><span style={{ color: '#1f9d55' }}>Shorts</span> vs <span style={{ color: '#df5338' }}>longs</span></>
    : 'Liquidation heatmap';
  return (
    <button
      onClick={() => heatmapLaunch.open(symbol)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: isCard ? 13 : 12,
        ...(isCard
          ? {
              padding: '12px 14px 12px 12px', background: '#fff',
              border: `1px solid ${hov ? '#e0dcd2' : '#ece9e2'}`, borderRadius: 14,
              boxShadow: hov ? '0 10px 24px -12px rgba(20,20,12,0.28)' : '0 1px 2px rgba(20,20,12,0.04)',
              transition: 'box-shadow .2s ease, border-color .2s ease',
            }
          : {
              padding: '16px 0 0', marginTop: 2, background: 'transparent',
              border: 'none', borderTop: '1px solid #f4f3f0', borderRadius: 0, boxShadow: 'none',
            }),
      }}
    >
      <span style={{ flex: '0 0 auto', width: iconSize, height: iconSize }}><HeatMatrixIcon size={iconSize} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, lineHeight: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b3aea2' }}>{eyebrow ?? defaultEyebrow}</span>
        <span style={{ fontWeight: 800, fontSize: isCard ? 13.5 : 12.5, letterSpacing: '-0.01em', color: '#1a1813', lineHeight: 1.25 }}>{title}</span>
        <span style={{ fontWeight: 600, fontSize: 11, color: '#9a958a', lineHeight: 1.3 }}>{sub}</span>
      </span>
      <span style={{ flex: '0 0 auto', color: '#7c5cff', fontSize: isCard ? 17 : 16, lineHeight: 1 }}>→</span>
    </button>
  );
}
