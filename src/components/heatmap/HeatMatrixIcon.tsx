// Unified heatmap glyph (handoff 34): a 4×4 grid of rounded cells, top half green
// → bottom half red (one neutral cell), echoing the liquidation heatmap. Used by
// all three entry points — the header button, workbook Step 5, and editor Levels.
const G = '#1f9d55', R = '#df5338', N = '#cdb9b2';
const RECTS: { x: number; y: number; o: number; c: string }[] = [
  { x: 2, y: 2, o: 0.35, c: G }, { x: 13.5, y: 2, o: 0.85, c: G }, { x: 25, y: 2, o: 0.5, c: G }, { x: 36.5, y: 2, o: 0.2, c: G },
  { x: 2, y: 13.5, o: 0.6, c: G }, { x: 13.5, y: 13.5, o: 1, c: G }, { x: 25, y: 13.5, o: 0.75, c: G }, { x: 36.5, y: 13.5, o: 0.4, c: N },
  { x: 2, y: 25, o: 0.5, c: R }, { x: 13.5, y: 25, o: 0.85, c: R }, { x: 25, y: 25, o: 1, c: R }, { x: 36.5, y: 25, o: 0.55, c: R },
  { x: 2, y: 36.5, o: 0.25, c: R }, { x: 13.5, y: 36.5, o: 0.6, c: R }, { x: 25, y: 36.5, o: 0.35, c: R }, { x: 36.5, y: 36.5, o: 0.18, c: R },
];

export function HeatMatrixIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" style={{ display: 'block' }}>
      {RECTS.map((r, i) => <rect key={i} x={r.x} y={r.y} width={9.5} height={9.5} rx={2.5} fill={r.c} opacity={r.o} />)}
    </svg>
  );
}
