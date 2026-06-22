'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FONT = "'Plus Jakarta Sans', sans-serif";

// Shared dark-popup tooltip — the project's standard hover affordance (replaces
// native `title=`). Portaled to <body> so a transformed/clipped ancestor can't
// hide it; anchors to the wrapped content's rect, opening above it (flips below
// near the viewport top). `style` lets the wrapper join a flex row (e.g. equal-
// width grade buttons). The popup only renders when `tip` is non-empty.
export function HoverTip({ tip, width = 240, children, style }: { tip: ReactNode; width?: number; children: ReactNode; style?: CSSProperties }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <span
      style={{ display: 'inline-block', minWidth: 0, cursor: 'help', ...style }}
      onMouseEnter={(ev) => setRect(ev.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {tip && rect && typeof document !== 'undefined' && createPortal(
        <span style={{ position: 'fixed', left: Math.round(Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))), zIndex: 300, width, maxWidth: '92vw', background: '#1a1813', color: '#f1efe9', fontSize: 11, fontWeight: 500, lineHeight: 1.5, padding: '9px 12px', borderRadius: 10, boxShadow: '0 10px 30px rgba(20,18,12,0.3)', pointerEvents: 'none', fontFamily: FONT,
          ...(rect.top > 130
            ? { top: Math.round(rect.top - 8), transform: 'translateY(-100%)' }
            : { top: Math.round(rect.bottom + 8) }) }}>
          {tip}
        </span>,
        document.body,
      )}
    </span>
  );
}
