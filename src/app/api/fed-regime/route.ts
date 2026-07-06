import { NextResponse } from 'next/server';

// Fed policy regime, auto-derived from the effective fed funds rate (FRED,
// keyless CSV). Drives the news-card verdict's Fed action + the header chip.
// Cached 12h server-side — the rate only moves monthly.
export const revalidate = 43200;

type Regime = 'hiking' | 'holding' | 'cutting';

export async function GET() {
  try {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS', { next: { revalidate: 43200 } });
    if (!res.ok) throw new Error('FRED ' + res.status);
    const csv = await res.text();
    const rows = csv.trim().split('\n').slice(1) // drop the header row
      .map((l) => l.split(','))
      .filter((c) => c.length >= 2 && c[1] !== '.' && c[1].trim() !== '')
      .map((c) => ({ date: c[0], v: parseFloat(c[1]) }))
      .filter((o) => isFinite(o.v));
    if (rows.length < 2) throw new Error('no data');
    const win = rows.slice(-7); // last ~6 months of monthly readings
    const latest = win[win.length - 1], first = win[0];
    const delta = +(latest.v - first.v).toFixed(2);
    let regime: Regime = 'holding';
    if (delta >= 0.25) regime = 'hiking';
    else if (delta <= -0.25) regime = 'cutting';
    // last ~2 years of monthly readings for the tooltip sparkline
    const series = rows.slice(-24).map((o) => ({ d: o.date, v: o.v }));
    return NextResponse.json({ regime, rate: latest.v, asOf: latest.date, delta, series });
  } catch (e) {
    // graceful: default to 'holding' so the verdict still renders sensibly
    return NextResponse.json({ regime: 'holding', rate: null, error: String((e as Error).message) });
  }
}
