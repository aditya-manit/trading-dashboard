'use client';

import { useState } from 'react';
import { heatmapLaunch } from '@/lib/heatmap-launch';
import type { HeatSymbol } from '@/hooks/useHeatmap';

// Launch card for the full-screen liquidation heatmap (shorts/longs donut gauge,
// handoff-32 variation H). Used in workbook Step 5 and the plan editor's Levels
// card. Per the project's no-hover-lift rule, hover shifts shadow + border-color
// only — no translateY.
export function HeatmapLaunchCard({ symbol = 'BTC', title = 'See the live liquidation heatmap', sub = 'Which side is offside, and where.' }: { symbol?: HeatSymbol; title?: string; sub?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => heatmapLaunch.open(symbol)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px 12px 12px',
        background: '#fff', border: `1px solid ${hov ? '#e0dcd2' : '#ece9e2'}`, borderRadius: 14,
        boxShadow: hov ? '0 10px 24px -12px rgba(20,20,12,0.28)' : '0 1px 2px rgba(20,20,12,0.04)',
        transition: 'box-shadow .2s ease, border-color .2s ease',
      }}
    >
      <span style={{ flex: '0 0 auto', width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block' }}>
          <circle cx="26" cy="26" r="20" fill="none" stroke="#eee9e0" strokeWidth="7" />
          <circle cx="26" cy="26" r="20" fill="none" stroke="#1f9d55" strokeWidth="7" strokeLinecap="round" strokeDasharray="69 126" transform="rotate(-90 26 26)" />
          <circle cx="26" cy="26" r="20" fill="none" stroke="#df5338" strokeWidth="7" strokeLinecap="round" strokeDasharray="53 126" strokeDashoffset="-72" transform="rotate(-90 26 26)" />
        </svg>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, lineHeight: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#b3aea2' }}>
          <span style={{ color: '#1f9d55' }}>Shorts</span> vs <span style={{ color: '#df5338' }}>longs</span>
        </span>
        <span style={{ fontWeight: 800, fontSize: 13.5, letterSpacing: '-0.01em', color: '#1a1813', lineHeight: 1.25 }}>{title}</span>
        <span style={{ fontWeight: 600, fontSize: 11, color: '#9a958a', lineHeight: 1.3 }}>{sub}</span>
      </span>
      <span style={{ flex: '0 0 auto', color: '#7c5cff', fontSize: 17, lineHeight: 1 }}>→</span>
    </button>
  );
}
