'use client';

import { memo, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PLAN_STEP_DIAGRAMS } from './planDiagrams';
import { useCalendar, useCalendarInsights, useCalendarDefinitions, useCalendarReleased, useCalendarArchive, eventKey, type CalendarEvent, type AssetDir, type ReleasedInfo } from '@/hooks/useCalendar';
import { isBtcRelevant, relevanceTag } from '@/lib/calendar-filter';
import { planActions } from '@/lib/plan-store';

const FONT = "'Plus Jakarta Sans', sans-serif";

// ─── Economic-calendar helpers (real ForexFactory feed) ───────────────────────
const IMPACT_COLOR: Record<string, string> = { High: '#df5338', Medium: '#d98a1f', Low: '#1f9d55', Holiday: '#8c8a81' };

// Times render in the viewer's local timezone (the feed carries a US-Eastern offset).
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// "If <word>" label — keep the condition to a single word (Hawkish, Hot, Beat…)
// even if the model returned a multi-word variation ("Hawkish hike signal").
const firstWord = (s: string) => s.trim().split(/\s+/)[0].toLowerCase();

const localMidnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayDiff = (iso: string, now: Date) => Math.round((localMidnight(new Date(iso)).getTime() - localMidnight(now).getTime()) / 86_400_000);

function dayHeader(iso: string, now: Date) {
  const d = dayDiff(iso, now);
  const rel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d === -1 ? 'Yesterday' : '';
  const date = new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, '');
  return `${rel ? rel + ' · ' : ''}${date}`.toUpperCase();
}

// Day-aware time, e.g. "Today 18:00" / "Tomorrow 18:00" / "Thursday 18:00"
// (within the week) / "Jun 25 18:00" (further out).
function fmtWhen(iso: string) {
  const d = dayDiff(iso, new Date());
  const t = fmtTime(iso);
  if (d === 0) return `Today ${t}`;
  if (d === 1) return `Tomorrow ${t}`;
  if (d === -1) return `Yesterday ${t}`;
  if (d >= 2 && d <= 6) return `${new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })} ${t}`;
  return `${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`;
}

// Memoized so it only re-renders (and replays its entrance animation) when the
// step changes — toggling pre-flight checks must NOT remount it.
const StepDiagram = memo(function StepDiagram({ step }: { step: number }) {
  return <div dangerouslySetInnerHTML={{ __html: PLAN_STEP_DIAGRAMS[step] }} />;
});

// Re-render every second (for live countdowns). Isolated to small components so
// the rest of the Plan page never re-renders on a tick.
function useTick() {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((t) => t + 1), 1000); return () => clearInterval(id); }, []);
}

// Header countdown: "3d 22h 56m 43s" (days/hours roll in as needed), ticking
// each second. Past a day it shows days + hours so it never reads e.g. "94h".
function CountdownFull({ date, style }: { date: string; style?: CSSProperties }) {
  useTick();
  const ms = new Date(date).getTime() - Date.now();
  const base = { color: '#c9821f', fontVariantNumeric: 'tabular-nums' as const, ...style };
  if (ms <= 0) return <span style={base}>live now</span>;
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  // Days out → just "3d 22h" (seconds-precision is noise that far away). Under a
  // day → keep the ticking "5h 23m 07s" / "23m 07s" so it feels live up close.
  const out = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${p(m)}m ${p(s)}s` : `${p(m)}m ${p(s)}s`;
  return <span style={base}>{out}</span>;
}

// Per-card countdown: "in 2d 4h" / "in 5h 23m" / "in 5m 12s" (seconds under 1h).
function CountdownLabel({ date }: { date: string }) {
  useTick();
  const ms = new Date(date).getTime() - Date.now();
  const base = { fontWeight: 700, fontSize: 9.5, color: '#c9821f', fontVariantNumeric: 'tabular-nums' as const };
  if (ms <= 0) return <span style={base}>live now</span>;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const label = h >= 24 ? `in ${Math.floor(h / 24)}d ${h % 24}h` : h >= 1 ? `in ${h}h ${m}m` : `in ${m}m ${s}s`;
  return <span style={base}>{label}</span>;
}

function valueParts(e: CalendarEvent): { main: string; note: string; muted?: boolean } {
  const f = (e.forecast || '').trim(), p = (e.previous || '').trim();
  if (f && p) return { main: f, note: `exp · ${p} prev` };
  if (f) return { main: f, note: 'exp' };
  if (p) return { main: p, note: 'prev' };
  return { main: 'No number', note: '', muted: true };
}

// Replaces the old "HIGH" badge (everything is high-impact now): shows the tier
// the event passed the filter on — US MACRO / CENTRAL BANK — in the badge style.
function Tag({ e }: { e: CalendarEvent }) {
  const t = relevanceTag(e);
  return <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.05em', color: t.color }}>{t.label}</span>;
}

// One "print" row: date · magnitude bar (4h reaction) · signed 4h % (bold) ·
// full-day % (small, muted, 'd'). Falls back to the day move when the 4h
// reaction is missing (no intraday candles that far back).
function PrintBar({ p }: { p: { date: string; pct: number; reactPct?: number } }) {
  const hasReact = typeof p.reactPct === 'number';
  const primary = hasReact ? (p.reactPct as number) : p.pct; // bar + bold lead with the reaction
  const up = primary >= 0;
  const color = up ? '#1f9d55' : '#df5338';
  const width = Math.min(100, Math.max(8, Math.abs(primary) * 40));
  const label = new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dayUp = p.pct >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 9, color: '#a8a69b', width: 36, flex: '0 0 auto' }}>{label}</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f4f3f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 3 }} />
      </div>
      <span title="BTC's move in the 4h after the release" style={{ fontWeight: 700, fontSize: 10, color, width: 36, textAlign: 'right', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>
        {up ? '+' : '−'}{Math.abs(primary).toFixed(1)}%
      </span>
      {hasReact ? (
        <span title="BTC's full-day move" style={{ fontWeight: 600, fontSize: 9, color: '#b3b0a6', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {dayUp ? '+' : '−'}{Math.abs(p.pct).toFixed(1)}<span style={{ fontSize: 7 }}>d</span>
        </span>
      ) : null}
    </div>
  );
}

const cellLabel: CSSProperties = { fontWeight: 700, fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bba074' };
const labelCellBase: CSSProperties = { padding: '8px 12px', borderRight: '1px solid #f0efec', display: 'flex', alignItems: 'center' };
const valueCellBase: CSSProperties = { padding: '8px 13px', display: 'flex', alignItems: 'center' };
const topBorder: CSSProperties = { borderTop: '1px solid #f4f3f0' };

// Hover tooltip portaled to document.body so it escapes card overflow:hidden
// AND the drawer panel's transform (which would otherwise contain/clip a fixed
// child). Anchors to the wrapped content's rect, opening above it.
function HoverTip({ tip, width = 240, children }: { tip: React.ReactNode; width?: number; children: React.ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <span
      style={{ display: 'inline-block', minWidth: 0, cursor: 'help' }}
      onMouseEnter={(ev) => setRect(ev.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {children}
      {rect && typeof document !== 'undefined' && createPortal(
        // Open above the anchor, flip below when there isn't room (drawer header
        // near the top); clamp left so it never spills off the right/left edge.
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

// Plain-English explanation of the calendar filter (isBtcRelevant), as 3 points.
const FILTER_TIP = (
  <span style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bdb8ad' }}>What moves BTC — what we show</span>
    <span style={{ display: 'flex', gap: 7 }}><b style={{ color: '#5fcf95', flex: '0 0 auto' }}>+</b><span>High-impact USD releases — Fed, CPI, NFP, PCE</span></span>
    <span style={{ display: 'flex', gap: 7 }}><b style={{ color: '#5fcf95', flex: '0 0 auto' }}>+</b><span>Non-USD central-bank decisions — BoJ, ECB, BoE, SNB</span></span>
    <span style={{ display: 'flex', gap: 7 }}><b style={{ color: '#f0917a', flex: '0 0 auto' }}>−</b><span>Hidden: minor-currency data — NZD GDP, UK Claimant Count</span></span>
  </span>
);

// Event name with its definition tooltip on hover (dashed underline when a
// definition exists).
function EventName({ title, def }: { title: string; def?: string }) {
  const style: CSSProperties = { fontWeight: 700, fontSize: 13, color: '#897f70', letterSpacing: '-0.01em' };
  if (!def) return <span style={style}>{title}</span>;
  return <HoverTip tip={def}><span style={{ ...style, borderBottom: '1px dashed #d4d2c9' }}>{title}</span></HoverTip>;
}

// Shimmering placeholder bar for rows still loading (reaction / prints).
function Skel({ w, h = 9 }: { w: number | string; h?: number }) {
  return <span style={{ display: 'block', width: w, height: h, borderRadius: 4, background: '#edece8', animation: 'plPulse 1.2s ease-in-out infinite' }} />;
}

// Inline colored asset arrows: "BTC ↓ · USD ↑ · stocks ↓".
function AssetArrows({ assets }: { assets: { sym: string; dir: AssetDir }[] }) {
  return (
    <>
      {assets.map((a, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <b style={{ color: a.dir === 'up' ? '#1f9d55' : a.dir === 'down' ? '#df5338' : '#9b988d' }}>
            {a.sym}{a.dir === 'up' ? ' ↑' : a.dir === 'down' ? ' ↓' : ' flat'}
          </b>
        </span>
      ))}
    </>
  );
}

function ReactionLine({ e }: { e: CalendarEvent }) {
  if (!e.insight) return null;
  return <span style={{ fontWeight: 600, fontSize: 11.5, color: '#56544b' }}><AssetArrows assets={e.insight.assets} /></span>;
}

// Released (already-fired) card: recessed tint, 4-col spec table — Forecast +
// Actual (with Hot/Soft surprise chip), and If-<condition> + realized Reaction.
function ReleasedCard({ e, info, loading }: { e: CalendarEvent; info?: ReleasedInfo; loading?: boolean }) {
  // While the (slow) released map is still loading, show a shimmer for the
  // enriched cells instead of a bare "—" — a "—" reads like a lost figure.
  const pending = loading && !info;
  const forecast = (e.forecast || '').trim() || '—';
  // Actual reflects the figure vs FORECAST (independent of BTC): Hot (higher) →
  // red ▲, Soft (lower) → green ▼, In-line (equal / no forecast) → grey =. The
  // Reaction row shows what BTC actually did — kept SEPARATE so divergences read.
  // Hard guard: if the actual equals the forecast it is In-line, whatever the
  // model labelled it (a hold at the expected rate must not read Hot/red).
  const norm = (x: string) => x.replace(/\s/g, '').toLowerCase();
  // Only force In-line when the actual literally equals a real forecast (a hold
  // at the expected rate must not read Hot). A missing forecast does NOT force
  // In-line — e.g. the dot-plot revision is a genuine Hot surprise with no feed
  // forecast, and deserves the credit. (User: give the right event the credit.)
  const hasForecast = !!forecast && forecast !== '—' && /\d/.test(forecast);
  const inlineByFigure = !!info && hasForecast && norm(info.actual) === norm(forecast);
  const hot = !inlineByFigure && info?.surprise === 'Hot';
  const soft = !inlineByFigure && info?.surprise === 'Soft';
  const actualColor = !info ? '#1a1813' : hot ? '#df5338' : soft ? '#1f9d55' : '#8c897e';
  const caret = !info ? '' : hot ? '▲ ' : soft ? '▼ ' : '= ';
  const c = IMPACT_COLOR[e.impact] || '#df5338';
  const lab: CSSProperties = { fontWeight: 700, fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#bba074' };
  const labCell: CSSProperties = { padding: '8px 11px', borderRight: '1px solid #f0efec', display: 'flex', alignItems: 'center' };
  const valCell: CSSProperties = { padding: '8px 11px', display: 'flex', alignItems: 'center' };
  const tb: CSSProperties = { borderTop: '1px solid #f4f3f0' };
  const when = `${new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' })} ${fmtTime(e.date)}`;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0efec', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderBottom: '1px solid #f0efec' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: '0 0 auto' }} />
            <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1a1813' }}>{e.country}</span>
            <Tag e={e} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#897f70', letterSpacing: '-0.01em' }}>{e.title}</span>
        </div>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 11, color: '#a8a69b', flex: '0 0 auto' }}>{when}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '66px 1fr 66px 1fr' }}>
        <div style={labCell}><span style={lab}>Forecast</span></div>
        <div style={{ ...valCell, borderRight: '1px solid #f0efec' }}><span style={{ fontWeight: 800, fontSize: 12, color: '#1a1813' }}>{forecast}</span></div>
        <div style={labCell}><span style={lab}>Actual</span></div>
        <div style={valCell}>
          {pending ? (
            <Skel w={48} />
          ) : info?.note ? (
            <HoverTip tip={info.note} width={230}>
              <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: actualColor, borderBottom: '1px dashed #cfccc4' }}>{caret}{info.actual}</span>
            </HoverTip>
          ) : (
            <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em', color: actualColor }}>{caret}{info?.actual ?? '—'}</span>
          )}
        </div>
        <div style={{ ...labCell, ...tb }}><span style={lab}>{info?.condition ? `If ${firstWord(info.condition)}` : 'If'}</span></div>
        <div style={{ ...valCell, ...tb, borderRight: '1px solid #f0efec' }}><span style={{ fontWeight: 600, fontSize: 11, color: '#56544b' }}>{pending ? <Skel w={64} /> : <AssetArrows assets={info?.ifReaction ?? []} />}</span></div>
        <div style={{ ...labCell, ...tb }}><span style={lab}>Reaction</span></div>
        <div style={{ ...valCell, ...tb }}><span style={{ fontWeight: 600, fontSize: 11, color: '#56544b' }}>{pending ? <Skel w={64} /> : <AssetArrows assets={info?.reaction ?? []} />}</span></div>
      </div>
    </div>
  );
}

// Rich strip card: header (currency/title + time + live countdown) over a
// Forecast / If-<condition> / BTC-2-prints table.
function StripCard({ e, loading, def }: { e: CalendarEvent; loading: boolean; def?: string }) {
  const color = IMPACT_COLOR[e.impact] || '#8c8a81';
  const v = valueParts(e);
  const ins = e.insight;
  const hasReaction = !!ins && ins.assets.length > 0;
  const prints = ins?.prints ?? [];
  return (
    <div style={{ background: '#fff', border: '1px solid #f0efec', borderRadius: 13, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderBottom: '1px solid #f0efec' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
            <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1a1813' }}>{e.country}</span>
            <Tag e={e} />
          </div>
          <EventName title={e.title} def={def} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flex: '0 0 auto' }}>
          <span style={{ fontWeight: 700, fontSize: 10.5, color: '#a8a69b', whiteSpace: 'nowrap' }}>{fmtWhen(e.date)}</span>
          <CountdownLabel date={e.date} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr' }}>
        <div style={labelCellBase}><span style={cellLabel}>Forecast</span></div>
        <div style={{ ...valueCellBase, alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 12, color: v.muted ? '#a8a69b' : '#1a1813' }}>{v.main}</span>
          {v.note && <span style={{ fontWeight: 600, fontSize: 10.5, color: '#a8a69b' }}>{v.note}</span>}
        </div>
        {hasReaction ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder }}><span style={cellLabel}>{ins!.condition ? `If ${firstWord(ins!.condition)}` : 'Reaction'}</span></div>
            <div style={{ ...valueCellBase, ...topBorder }}><ReactionLine e={e} /></div>
          </>
        ) : loading ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder }}><span style={cellLabel}>Reaction</span></div>
            <div style={{ ...valueCellBase, ...topBorder }}><Skel w={150} /></div>
          </>
        ) : null}
        {prints.length > 0 ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder, alignItems: 'flex-start' }}><span style={{ ...cellLabel, lineHeight: 1.3 }}>BTC<br />{prints.length} prints</span></div>
            <div style={{ ...valueCellBase, ...topBorder, flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
              {prints.map((p, i) => <PrintBar key={i} p={p} />)}
            </div>
          </>
        ) : loading ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder, alignItems: 'flex-start' }}><span style={{ ...cellLabel, lineHeight: 1.3 }}>BTC<br />prints</span></div>
            <div style={{ ...valueCellBase, ...topBorder, flexDirection: 'column', alignItems: 'stretch', gap: 7 }}>
              <Skel w="100%" /><Skel w="100%" />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Compact drawer card (no countdown / prints table): currency, time, forecast,
// reaction row. Same table chrome as the strip, minus the countdown and the
// BTC-prints row (handoff-16 drawer style).
function NewsCard({ e, loading, def }: { e: CalendarEvent; loading: boolean; def?: string }) {
  const color = IMPACT_COLOR[e.impact] || '#8c8a81';
  const v = valueParts(e);
  const ins = e.insight;
  const hasReaction = !!ins && ins.assets.length > 0;
  return (
    <div style={{ background: '#fff', border: '1px solid #f0efec', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderBottom: '1px solid #f0efec' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
            <span style={{ fontWeight: 800, fontSize: 12.5, color: '#1a1813' }}>{e.country}</span>
            <Tag e={e} />
          </div>
          <EventName title={e.title} def={def} />
        </div>
        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 11, color: '#a8a69b', flex: '0 0 auto' }}>{fmtTime(e.date)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr' }}>
        <div style={labelCellBase}><span style={cellLabel}>Forecast</span></div>
        <div style={{ ...valueCellBase, alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontWeight: 800, fontSize: 12, color: v.muted ? '#a8a69b' : '#1a1813' }}>{v.main}</span>
          {v.note && <span style={{ fontWeight: 600, fontSize: 10.5, color: '#a8a69b' }}>{v.note}</span>}
        </div>
        {hasReaction ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder }}><span style={cellLabel}>{ins!.condition ? `If ${firstWord(ins!.condition)}` : 'Reaction'}</span></div>
            <div style={{ ...valueCellBase, ...topBorder }}><ReactionLine e={e} /></div>
          </>
        ) : loading ? (
          <>
            <div style={{ ...labelCellBase, ...topBorder }}><span style={cellLabel}>Reaction</span></div>
            <div style={{ ...valueCellBase, ...topBorder }}><Skel w={150} /></div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Illustrated empty state when a drawer search matches nothing (handoff 19).
function NewsEmpty({ query }: { query: string }) {
  return (
    <div style={{ padding: '40px 24px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 11, alignItems: 'center' }}>
      <span style={{ width: 48, height: 48, borderRadius: 14, background: '#f4f3f0', display: 'grid', placeItems: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m14 14-4 4" /><path d="m10 14 4 4" /></svg>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5, color: '#1a1813', letterSpacing: '-0.01em' }}>No events found</span>
        <span style={{ fontWeight: 500, fontSize: 12, color: '#a8a69b', lineHeight: 1.45 }}>Nothing matches “{query}” in this view.</span>
      </div>
    </div>
  );
}

// Illustrated empty state for a tab with no events (no active search) —
// icon chip + title + one-line caption, centered.
function NewsZero({ icon, title, sub, tint }: { icon: ReactNode; title: string; sub: string; tint?: { bg: string; fg: string } }) {
  return (
    <div style={{ padding: '46px 24px 38px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 13, alignItems: 'center' }}>
      <span style={{ position: 'relative', width: 54, height: 54, borderRadius: 16, background: tint?.bg ?? '#f4f3f0', display: 'grid', placeItems: 'center' }}>
        <span style={{ position: 'absolute', inset: -5, borderRadius: 20, border: `1px solid ${tint?.bg ?? '#f1f0ec'}`, opacity: 0.6 }} />
        {icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1813', letterSpacing: '-0.01em' }}>{title}</span>
        <span style={{ fontWeight: 500, fontSize: 12, color: '#a8a69b', lineHeight: 1.5, maxWidth: 250 }}>{sub}</span>
      </div>
    </div>
  );
}

// V5 "departure-board" news header: pulse + next release + big live countdown +
// time-until progress bar + this-week impact legend + View all (handoff 17).
function NewsHeader({ next, progressPct, counts, total, onViewAll }: {
  next: CalendarEvent | null;
  progressPct: number;
  counts: { usMacro: number; centralBank: number };
  total: number;
  onViewAll: () => void;
}) {
  const c = next ? (IMPACT_COLOR[next.impact] || '#df5338') : '#df5338';
  const tier = next ? relevanceTag(next) : null;
  const [vaHover, setVaHover] = useState(false);
  // Legend uses our own tiers (US Macro / Central Bank), matching the card tags.
  const legend: [string, number, string][] = [['#0ea5e9', counts.usMacro, 'US Macro'], ['#7c5cff', counts.centralBank, 'Central bank']];
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', background: '#fff', border: '1px solid #efedea', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,20,12,0.03)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 17px', flex: '0 0 auto' }}>
        <span style={{ position: 'relative', width: 8, height: 8, flex: '0 0 auto', display: 'inline-block' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#1f9d55' }} />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#1f9d55', transformOrigin: 'center', animation: 'pkPulse 2s infinite' }} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1a1813', whiteSpace: 'nowrap' }}>Market news</span>
          <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#bba074', whiteSpace: 'nowrap' }}>Live feed</span>
        </div>
      </div>
      <div style={{ width: 1, background: '#efedea', flex: '0 0 auto' }} />
      {next ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9, padding: '11px 18px', minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#a8a69b' }}>Next release</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#1a1813', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>{next.title}</span>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flex: '0 0 auto' }} />
                <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.06em', color: tier!.color, whiteSpace: 'nowrap' }}>{next.country} · {tier!.label}</span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flex: '0 0 auto' }}>
              <CountdownFull date={next.date} style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, whiteSpace: 'nowrap' }} />
              <span style={{ fontWeight: 700, fontSize: 7.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#d6b98a' }}>until release</span>
            </div>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: '#f3f1ec', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: '#c9821f', borderRadius: 99, transition: 'width .4s ease' }} />
          </div>
        </div>
      ) : (
        // No upcoming releases left this week — keep the board, swap the
        // countdown for a quiet "No upcoming news" (handoff 21 / dc.html).
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '11px 18px', minWidth: 200 }}>
          <span style={{ fontWeight: 800, fontSize: 8.5, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#a8a69b' }}>Next release</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#cfcdc4', flex: '0 0 auto' }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: '#9b988d', letterSpacing: '-0.015em' }}>No upcoming news</span>
          </div>
        </div>
      )}
      <div style={{ width: 1, background: '#efedea', flex: '0 0 auto' }} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: '11px 16px', flex: '0 0 auto' }}>
        <span style={{ fontWeight: 800, fontSize: 8, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#a8a69b' }}>This week</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {legend.map(([col, n, l]) => (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />
              <span style={{ fontWeight: 800, fontSize: 11, color: '#1a1813', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              <span style={{ fontWeight: 600, fontSize: 9, color: '#a8a69b' }}>{l}</span>
            </span>
          ))}
        </div>
      </div>
      <div style={{ width: 1, background: '#efedea', flex: '0 0 auto' }} />
      <button onClick={onViewAll} onMouseEnter={() => setVaHover(true)} onMouseLeave={() => setVaHover(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', background: vaHover ? '#faf8ff' : 'transparent', border: 'none', padding: '0 16px', flex: '0 0 auto', alignSelf: 'stretch', transition: 'all .15s' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 600, fontSize: 12.5, color: '#1a1813', letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>View all</span>
          <span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#c9821f', whiteSpace: 'nowrap' }}>{total} events</span>
        </span>
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#f4f3f0', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a1813" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </span>
      </button>
    </div>
  );
}

// ─── Step metadata (verbatim from handoff 15 planMeta) ────────────────────────
type PlanStep = {
  n: number; title: string; color: string; soft: string; border: string; shadow: string;
  rail: string; short: string; lead: string; hl: string[]; caption: string; ask: string[]; rule: string;
};

const PLAN_META: PlanStep[] = [
  { n: 1, title: 'Where is the nearest support & resistance?', color: '#7c5cff', soft: '#f3eefe', border: '#e7ddfb', shadow: 'rgba(124,92,255,0.32)', rail: 'Levels', short: 'Levels',
    lead: 'Price is always traveling between support and resistance. Before you enter, mark both.',
    hl: ['support and resistance', 'mark both'],
    caption: 'Price is pinned to support — a long has the whole range to run, a short has nowhere to go.',
    ask: ['I am NOT buying into resistance', 'I am NOT shorting into support', 'There is room for price to move my way'],
    rule: 'Never buy into resistance or short into support.' },
  { n: 2, title: 'What is the higher timeframe doing?', color: '#1f9d55', soft: '#edf7f0', border: '#cfe9da', shadow: 'rgba(31,157,85,0.3)', rail: 'Trend', short: 'Trend',
    lead: 'Trade with the trend, not against it. The higher timeframe decides which way you are allowed to lean.',
    hl: ['with the trend', 'higher timeframe'],
    caption: 'Price pulled back inside an uptrend — a long goes with the trend, a short fights it.',
    ask: ['Is the higher-timeframe trend up, down, or sideways?', 'Does my trade go WITH that trend?', 'If it is counter-trend, is my proof strong enough?'],
    rule: 'Trade with the trend. Against it, you need much stronger proof.' },
  { n: 3, title: 'Has price actually confirmed my idea?', color: '#2f6fc8', soft: '#eef3fb', border: '#d6e3f5', shadow: 'rgba(47,111,200,0.32)', rail: 'Confirmation', short: 'Confirm',
    lead: 'Do not predict the move — let price prove it. Wait for the break, and then for the hold.',
    hl: ['let price prove it', 'the break', 'the hold'],
    caption: 'Price broke the level and retested it — the break held, so the move is confirmed. A reclaim would have been a fakeout.',
    ask: ['Has the level actually broken, or am I guessing?', 'Did it hold the break, or instantly reclaim?', 'Am I reacting to price, or to hope?'],
    rule: 'Trade confirmations, not predictions.' },
  { n: 4, title: 'If I enter now, where is my stop?', color: '#7c5cff', soft: '#f3eefe', border: '#e4d8fb', shadow: 'rgba(124,92,255,0.32)', rail: 'Stop', short: 'Stop',
    lead: 'Decide where you are wrong before you decide where you are right. The stop comes first — always.',
    hl: ['where you are wrong', 'where you are right', 'stop comes first'],
    caption: 'The stop sits just below the major level — on structure, where losing it truly means the idea failed. Not inside the noise.',
    ask: ['Where exactly is my idea invalidated?', 'Is the stop on structure, or on emotion?', 'Is the risk small enough to survive being wrong?'],
    rule: 'Entry comes after stop placement, never before.' },
  { n: 5, title: 'Why would the other side be trapped?', color: '#e07b2f', soft: '#fdf2e8', border: '#f6dcc1', shadow: 'rgba(224,123,47,0.3)', rail: 'Liquidity', short: 'Traps',
    lead: 'Every move needs a loser. Find who is offside and where their stops sit — that is the fuel for your move.',
    hl: ['needs a loser', 'who is offside', 'their stops sit', 'the fuel'],
    caption: 'Price swept the stops above resistance, trapped the late longs, then reversed — their forced exits are the fuel.',
    ask: ['Who is wrong if price pushes up?', 'Who is wrong if price pushes down?', 'Where are their stops stacked?'],
    rule: 'Trade where trapped traders are forced to exit.' },
];

// ─── Stepper mini-icons (verbatim from handoff 15 planStepper) ────────────────
const G = '#c4c1b9', G2 = '#d8d5cd';
const ICON_SVG_PROPS = { width: 46, height: 30, viewBox: '0 0 130 48', fill: 'none', preserveAspectRatio: 'none' as const, style: { flex: '0 0 auto' as const } };
const STEPPER_ICONS = [
  <svg key={0} {...ICON_SVG_PROPS}>
    <line x1={4} y1={9} x2={126} y2={9} stroke={G2} strokeWidth={2.6} strokeDasharray="6 4" strokeLinecap="round" />
    <line x1={4} y1={40} x2={126} y2={40} stroke={G} strokeWidth={2.6} strokeLinecap="round" />
    <polyline points="6,20 34,27 58,23 84,34 110,39 122,39" stroke={G} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={122} cy={39} r={4.5} fill={G} />
  </svg>,
  <svg key={1} {...ICON_SVG_PROPS}>
    <polyline points="4,40 28,31 52,34 80,18 106,11 126,5" stroke={G} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key={2} {...ICON_SVG_PROPS}>
    <line x1={4} y1={30} x2={126} y2={30} stroke={G2} strokeWidth={2.4} strokeDasharray="5 4" strokeLinecap="round" />
    <line x1={65} y1={44} x2={65} y2={11} stroke={G} strokeWidth={3} strokeLinecap="round" />
    <polyline points="54,21 65,9 76,21" stroke={G} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key={3} {...ICON_SVG_PROPS}>
    <polyline points="6,12 32,22 60,37 88,25 122,13" stroke={G} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    <line x1={44} y1={45} x2={78} y2={45} stroke={G2} strokeWidth={3} strokeLinecap="round" />
  </svg>,
  <svg key={4} {...ICON_SVG_PROPS}>
    <line x1={4} y1={30} x2={126} y2={30} stroke={G2} strokeWidth={2.4} strokeDasharray="5 4" strokeLinecap="round" />
    <circle cx={58} cy={22} r={1.8} fill={G} />
    <circle cx={68} cy={22} r={1.8} fill={G} />
    <circle cx={78} cy={22} r={1.8} fill={G} />
    <polyline points="14,40 46,32 68,12 82,32 116,42" stroke={G} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
];

const pad2 = (n: number) => ('0' + n).slice(-2);

// Big lead paragraph with purple-highlighted keywords (planLeadEl / _leadRich).
function LeadText({ lead, hl }: { lead: string; hl: string[] }) {
  const base: CSSProperties = { margin: 0, fontWeight: 700, fontSize: 27, lineHeight: 1.3, letterSpacing: '-0.025em', color: '#1a1813' };
  if (!hl.length) return <p style={base}>{lead}</p>;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + hl.map(esc).join('|') + ')', 'gi');
  const parts: ReactNode[] = [];
  let last = 0, m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(lead))) {
    if (m.index > last) parts.push(lead.slice(last, m.index));
    parts.push(<span key={m.index} style={{ color: '#7c5cff', fontWeight: 800, fontSize: '1.34em', letterSpacing: '-0.015em' }}>{m[0]}</span>);
    last = m.index + m[0].length;
  }
  if (last < lead.length) parts.push(lead.slice(last));
  return <p style={base}>{parts}</p>;
}

// Pre-flight checks as a full-width chevron/arrow connected strip (planChecksVEl):
// arrow-shaped cells with a green connector gradient that fills as checks confirm.
function ChecksStrip({ step, ask, checks, toggle }: { step: number; ask: string[]; checks: Record<string, boolean>; toggle: (k: string) => void }) {
  const n = ask.length, aw = 20, gap = 5, bw = 24, N0 = '#e7e5dd', G0 = '#2fa862';
  const done = ask.map((_, i) => !!checks[`${step}-${i}`]);
  const doneCount = done.filter(Boolean).length;
  const cw = `(100% - ${(n - 1) * gap}px)/${n}`;
  let stops = `${N0} 0px`;
  for (let gi = 0; gi < n - 1; gi++) {
    const gc = done[gi] ? G0 : N0;
    const goff = gi * gap + gap / 2;
    const ga = `calc(${gi + 1}*${cw} + ${goff - bw}px)`;
    const gb = `calc(${gi + 1}*${cw} + ${goff + bw}px)`;
    stops += `, ${N0} ${ga}, ${gc} ${ga}, ${gc} ${gb}, ${N0} ${gb}`;
  }
  stops += `, ${N0} 100%`;
  const ratio = n ? doneCount / n : 0;
  const border = doneCount === 0 ? '#e6e4dc' : `oklch(${0.92 - ratio * 0.22} ${0.02 + ratio * 0.13} 150)`;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap, borderRadius: 16, overflow: 'hidden', border: `1px solid ${border}`, background: `linear-gradient(90deg, ${stops})`, transition: 'border-color .25s ease' }}>
      {ask.map((text, i) => {
        const f = i === 0, l = i === n - 1, dn = done[i];
        const clip = f
          ? `polygon(0 0, calc(100% - ${aw}px) 0, 100% 50%, calc(100% - ${aw}px) 100%, 0 100%)`
          : l
            ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${aw}px 50%)`
            : `polygon(0 0, calc(100% - ${aw}px) 0, 100% 50%, calc(100% - ${aw}px) 100%, 0 100%, ${aw}px 50%)`;
        return (
          <div key={i} onClick={() => toggle(`${step}-${i}`)} style={{ flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: `calc((100% - ${(n - 1) * gap}px)/${n})`, minWidth: 0, boxSizing: 'border-box', cursor: 'pointer', paddingTop: 17, paddingBottom: 17, paddingLeft: f ? 20 : aw + 18, paddingRight: l ? 20 : aw + 14, clipPath: clip, background: '#fff', display: 'flex', flexDirection: 'column', gap: 10, transition: 'background .2s ease' }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: dn ? '#1c8f4d' : '#fff', border: dn ? 'none' : '1.5px solid #d6d4cc', boxShadow: dn ? '0 2px 6px -1px rgba(28,143,77,0.45)' : 'none', fontWeight: 800, fontSize: 11, color: dn ? '#fff' : '#a8a69b', transition: 'all .2s ease' }}>{dn ? <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> : i + 1}</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: dn ? '#16703c' : '#56544b', lineHeight: 1.4 }}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PlanPage() {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsTab, setNewsTab] = useState<'upcoming' | 'released'>('upcoming');
  const [showAll, setShowAll] = useState(false);
  const [newsQuery, setNewsQuery] = useState('');

  // Restore persisted progress
  useEffect(() => {
    try {
      const s = localStorage.getItem('tdplan_step');
      const f = localStorage.getItem('tdplan_fin');
      const c = localStorage.getItem('tdplan_checks_v2');
      if (s !== null) setStep(Math.max(0, Math.min(4, +s)));
      if (f !== null) setFinished(f === '1');
      if (c !== null) setChecks(JSON.parse(c) || {});
    } catch { /* ignore */ }
  }, []);

  const persistPlan = (s: number, f: boolean) => {
    try { localStorage.setItem('tdplan_step', String(s)); localStorage.setItem('tdplan_fin', f ? '1' : '0'); } catch { /* ignore */ }
  };
  const persistChecks = (c: Record<string, boolean>) => {
    try { localStorage.setItem('tdplan_checks_v2', JSON.stringify(c)); } catch { /* ignore */ }
  };

  const goStep = (s: number) => { const ns = Math.max(0, Math.min(4, s)); persistPlan(ns, finished); setStep(ns); };
  const toggleCheck = (k: string) => {
    setChecks((prev) => { const nc = { ...prev, [k]: !prev[k] }; persistChecks(nc); return nc; });
  };
  const reset = () => { persistPlan(0, false); persistChecks({}); setStep(0); setFinished(false); setChecks({}); };

  const meta = PLAN_META[step];
  const doneCount = meta.ask.filter((_, i) => checks[`${step}-${i}`]).length;
  const allClear = doneCount === meta.ask.length && meta.ask.length > 0;

  // ─── Economic calendar ──────────────────────────────────────────────────────
  // Feed is fast (cards render immediately); insights (reaction + prints) load
  // separately and merge in — those rows show skeletons until they arrive.
  const { data: calRaw } = useCalendar();
  const { data: insightMap } = useCalendarInsights();
  const { data: defMap } = useCalendarDefinitions();
  const { data: releasedMap } = useCalendarReleased();
  const { data: archiveAll } = useCalendarArchive();
  const releasedLoading = releasedMap === undefined;
  const insightsLoading = insightMap === undefined;
  const now = new Date();
  const calLoading = calRaw === undefined;
  const upcomingHigh = (Array.isArray(calRaw) ? calRaw : [])
    .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => ({ ...e, insight: insightMap?.[eventKey(e)] }));
  const stripEvents = upcomingHigh.slice(0, 4);
  const nextEvent = upcomingHigh[0];

  // All BTC-relevant events this week (the feed is already week-scoped). Used
  // for the header's "This week" legend + "View all" total so they stay
  // meaningful even after every release has fired.
  const weekHigh = (Array.isArray(calRaw) ? calRaw : []).filter(isBtcRelevant);
  // Header legend uses our own tiers (US Macro / Central Bank) over this week's
  // relevant events — we don't surface generic High/Med/Low.
  const tierCounts = {
    usMacro: weekHigh.filter((e) => e.country === 'USD').length,
    centralBank: weekHigh.filter((e) => e.country !== 'USD').length,
  };
  // Progress bar = imminence over a fixed 24h window (the countdown gives the
  // exact time; the bar is the at-a-glance "how soon"). >24h away → ~5% (a
  // sliver, never empty), 12h → ~50%, at release → 100%.
  let newsProgress = 5;
  if (nextEvent) {
    const WINDOW = 24 * 3600_000;
    const msUntil = new Date(nextEvent.date).getTime() - now.getTime();
    newsProgress = Math.max(5, Math.min(100, ((WINDOW - msUntil) / WINDOW) * 100));
  }

  // Released (already-fired) relevant events this week, most-recent first.
  // Show ALL of them — the Released tab must match the header's week-wide count
  // (capping at 4 hid earlier same-day events, e.g. the FOMC Statement/rate when
  // the press conf + BoE were more recent). Enrichment may lag for the oldest.
  const releasedEvents = (Array.isArray(calRaw) ? calRaw : [])
    .filter((e) => isBtcRelevant(e) && new Date(e.date).getTime() < now.getTime())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  // Drawer search: match on event title or currency.
  const q = newsQuery.trim().toLowerCase();
  const matchQ = (e: CalendarEvent) => !q || e.title.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
  const releasedFiltered = releasedEvents.filter(matchQ);
  // "All" toggle: every archived released event, all weeks, newest-first. Build a
  // synthetic CalendarEvent (date at noon to keep the weekday tz-stable) + carry
  // the stored ReleasedInfo straight onto the card.
  const archiveCards = (archiveAll || [])
    .map((a) => ({ e: { country: a.country, title: a.title, date: a.date.length <= 10 ? a.date + 'T12:00:00' : a.date, impact: 'High' } as CalendarEvent, info: a.info }))
    .filter(({ e }) => matchQ(e));
  const newsGroups: { key: number; label: string; events: CalendarEvent[] }[] = [];
  for (const e of upcomingHigh) {
    if (!matchQ(e)) continue;
    const k = dayDiff(e.date, now);
    let g = newsGroups.find((x) => x.key === k);
    if (!g) { g = { key: k, label: dayHeader(e.date, now), events: [] }; newsGroups.push(g); }
    g.events.push(e);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', fontFamily: FONT }}>
      <style>{`
        @keyframes pkDraw{to{stroke-dashoffset:0;}}
        @keyframes pkPop{from{opacity:0;transform:scale(.3);}to{opacity:1;transform:scale(1);}}
        @keyframes pkUp{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pkZone{from{opacity:0;}to{opacity:1;}}
        @keyframes pkPulse{0%{transform:scale(.5);opacity:.45;}70%{opacity:0;}100%{transform:scale(1.9);opacity:0;}}
        @keyframes pkGrowX{from{transform:scaleX(0);}to{transform:scaleX(1);}}
        @keyframes pkFade{from{opacity:0;}to{opacity:1;}}
        @keyframes pkSlideIn{from{transform:translateX(100%);}to{transform:translateX(0);}}
        @keyframes plPulse{0%,100%{opacity:1;}50%{opacity:.45;}}
      `}</style>

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', padding: '6px 2px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c5cff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cff' }} />Pre-trade workbook
          </span>
          <span style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.025em', color: '#1a1813', lineHeight: 1.08 }}>Plan the trade before you take it.</span>
          <span style={{ fontWeight: 500, fontSize: 14.5, color: '#897f70', lineHeight: 1.5, maxWidth: 580 }}>A short routine that keeps you out of bad setups. Work it top to bottom — each step has to pass before the next one matters.</span>
        </div>
      </div>

      {/* market news */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {calLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #efedea', borderRadius: 14, padding: '16px 18px', fontWeight: 700, fontSize: 13, color: '#897f70', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
            Loading economic calendar…
          </div>
        ) : (
          <NewsHeader next={nextEvent ?? null} progressPct={newsProgress} counts={tierCounts} total={weekHigh.length} onViewAll={() => setNewsOpen(true)} />
        )}
        {/* strip cards — hidden entirely when there are no upcoming events
            (the empty banner above already says so) */}
        {(calLoading || stripEvents.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {calLoading
              ? [0, 1, 2, 3].map((i) => <div key={i} style={{ height: 150, background: '#fff', border: '1px solid #f0efec', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }} />)
              : stripEvents.map((e, i) => <StripCard key={i} e={e} loading={insightsLoading} def={defMap?.[e.title]} />)}
          </div>
        )}
      </div>

      {/* news drawer */}
      {newsOpen && (
        <>
          <div onClick={() => setNewsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,12,0.35)', zIndex: 60, animation: 'pkFade .2s both' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, maxWidth: '92vw', background: '#fbfaf8', zIndex: 61, boxShadow: '-12px 0 40px rgba(20,20,12,0.16)', display: 'flex', flexDirection: 'column', animation: 'pkSlideIn .28s cubic-bezier(.2,.8,.3,1) both', fontFamily: FONT }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid #efedea', background: '#fff', flex: '0 0 auto' }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: '#fbe7cb', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9821f" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#bba074' }}>Economic calendar · ForexFactory</span>
                <HoverTip tip={FILTER_TIP} width={290}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#1a1813', letterSpacing: '-0.015em', borderBottom: '1px dashed #cfccc4' }}>This week’s high-impact</span>
                </HoverTip>
              </div>
              <button onClick={() => setNewsOpen(false)} style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 9, border: '1px solid #e8e6e0', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#8c8a81', fontSize: 17, lineHeight: 1, fontFamily: 'inherit' }}>×</button>
            </div>
            {/* Search + Upcoming/Released toggle + an "All" switch, one row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '14px 22px 2px', flex: '0 0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, background: '#f4f3f0', border: '1px solid #ece9e3', borderRadius: 10, padding: '8px 11px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8a69b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  value={newsQuery}
                  onChange={(ev) => setNewsQuery(ev.target.value)}
                  placeholder="Search…"
                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#1a1813' }}
                />
                {newsQuery && (
                  <button onClick={() => setNewsQuery('')} style={{ flex: '0 0 auto', width: 17, height: 17, borderRadius: '50%', border: 'none', background: '#e2dfd8', color: '#6b6457', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 10, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#efece6', border: '1px solid #e7e3da', borderRadius: 10, padding: 3, gap: 3, flex: '0 0 auto' }}>
                {(['upcoming', 'released'] as const).map((t) => {
                  // All on ⇒ Released reads active (it's the superset). Clicking
                  // Released keeps All on; only Upcoming turns it off.
                  const active = newsTab === t;
                  return (
                    <button key={t} onClick={() => { setNewsTab(t); if (t === 'upcoming') setShowAll(false); }} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, letterSpacing: '-0.005em', background: active ? '#fff' : 'transparent', color: active ? '#1a1813' : '#8c8a81', boxShadow: active ? '0 1px 2px rgba(20,20,12,0.08)' : 'none', transition: 'all .18s' }}>
                      {t === 'upcoming' ? 'Upcoming' : 'Released'}
                    </button>
                  );
                })}
              </div>
              {/* All-time switch — every released event, any week, newest-first */}
              <button onClick={() => { const next = !showAll; setShowAll(next); if (next) setNewsTab('released'); }} title="Show every released event across all weeks" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 7px', borderRadius: 9, border: '1px solid ' + (showAll ? '#c9b6ff' : '#e7e3da'), background: showAll ? '#7c5cff' : '#fff', cursor: 'pointer', fontFamily: 'inherit', flex: '0 0 auto', transition: 'all .18s' }}>
                <span style={{ position: 'relative', width: 24, height: 14, borderRadius: 99, background: showAll ? 'rgba(255,255,255,0.4)' : '#dcd9d1', transition: 'background .18s', flex: '0 0 auto' }}>
                  <span style={{ position: 'absolute', top: 2, left: showAll ? 12 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left .18s' }} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 11, color: showAll ? '#fff' : '#8c8a81' }}>All</span>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 18px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              {showAll ? (
                archiveCards.length === 0 ? (
                  q ? <NewsEmpty query={newsQuery.trim()} /> : (
                    <NewsZero
                      title="No archived events yet"
                      sub="Every released high-impact event is kept here across all weeks."
                      icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>}
                    />
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a69b' }}>All released · newest first</span>
                      <span style={{ flex: 1, height: 1, background: '#efedea' }} />
                      <span style={{ fontWeight: 700, fontSize: 9.5, color: '#bba074' }}>{archiveCards.length}</span>
                    </div>
                    {archiveCards.map(({ e, info }, i) => <ReleasedCard key={i} e={e} info={info} />)}
                  </div>
                )
              ) : newsTab === 'released' ? (
                releasedFiltered.length === 0 ? (
                  q ? <NewsEmpty query={newsQuery.trim()} /> : (
                    <NewsZero
                      title="Nothing released yet"
                      sub="High-impact events show up here once they've fired this week."
                      icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>}
                    />
                  )
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a69b' }}>Earlier this week</span>
                      <span style={{ flex: 1, height: 1, background: '#efedea' }} />
                      {releasedLoading && <span style={{ fontWeight: 600, fontSize: 9.5, color: '#bba074' }}>confirming actuals…</span>}
                    </div>
                    {releasedFiltered.map((e, i) => <ReleasedCard key={i} e={e} info={releasedMap?.[eventKey(e)]} loading={releasedLoading} />)}
                  </div>
                )
              ) : newsGroups.length === 0 ? (
                q ? <NewsEmpty query={newsQuery.trim()} /> : (
                  <NewsZero
                    title="All clear"
                    sub="No high-impact events left this week — nothing scheduled to trade around."
                    icon={<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#b3b0a6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /><path d="m9 16 2 2 4-4" /></svg>}
                  />
                )
              ) : newsGroups.map((g) => (
                <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a69b' }}>{g.label}</span>
                    <span style={{ flex: 1, height: 1, background: '#efedea' }} />
                  </div>
                  {g.events.map((e, i) => <NewsCard key={i} e={e} loading={insightsLoading} def={defMap?.[e.title]} />)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* top stepper */}
      <div style={{ background: '#fff', border: '1px solid #f0efec', borderRadius: 16, padding: '8px 12px', boxShadow: '0 1px 2px rgba(20,20,12,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {PLAN_META.map((m, i) => (
            <span key={m.n} style={{ display: 'contents' }}>
              <button onClick={() => goStep(i)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', fontFamily: FONT, border: 'none', background: i === step ? '#f4f3f0' : 'transparent', borderRadius: 11, padding: '9px 14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: i === step ? '#a8a69b' : '#c4c2b8' }}>Step {m.n}</span>
                  <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', color: i === step ? '#1a1813' : '#a8a69b', lineHeight: 1 }}>{m.short}</span>
                </div>
                {STEPPER_ICONS[i]}
              </button>
              {i < 4 && <span style={{ flex: '0 0 auto', alignSelf: 'center', color: '#d4d2c9', fontSize: 17, padding: '0 10px' }}>›</span>}
            </span>
          ))}
        </div>
      </div>

      {/* step card */}
      <div style={{ background: '#ffffff', border: '1px solid #efedf3', borderRadius: 22, boxShadow: '0 1px 2px rgba(20,20,12,0.03)', overflow: 'hidden' }}>
        {/* header block */}
        <div style={{ borderBottom: '1px solid #f4f3f0' }}>
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <div style={{ flex: '0 0 auto', width: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
              <span style={{ fontWeight: 800, fontSize: 44, letterSpacing: '-0.03em', color: '#7c5cff', lineHeight: 1 }}>{meta.n}</span>
            </div>
            <div style={{ flex: '0 0 auto', width: 1, background: '#eceae5' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '18px 30px', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a8a69b' }}>Step {meta.n} · {meta.rail}</span>
                <span style={{ fontWeight: 800, fontSize: 23, letterSpacing: '-0.015em', color: '#1a1813', lineHeight: 1.05 }}>{meta.title}</span>
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#1a1813', letterSpacing: '-0.01em' }}>{pad2(meta.n)}</span>
                    <span style={{ fontWeight: 700, fontSize: 11, color: '#c4c2b8' }}>/ 05</span>
                  </div>
                  <div style={{ width: 84, height: 5, borderRadius: 99, background: '#eceae5', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(meta.n / 5) * 100}%`, background: '#7c5cff', borderRadius: 99, transition: 'width .3s ease' }} />
                  </div>
                </div>
                <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: 'none', padding: '0 1px', fontWeight: 700, fontSize: 11.5, color: '#b0aea3' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>Reset
                </button>
              </div>
            </div>
          </div>
          <div style={{ height: 1, background: '#f4f3f0' }} />
          <div style={{ display: 'flex', alignItems: 'stretch', background: '#faf8ff' }}>
            <div style={{ flex: '0 0 auto', width: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
              <span style={{ fontWeight: 800, fontSize: 9.5, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#7c5cff' }}>The rule</span>
            </div>
            <div style={{ flex: '0 0 auto', width: 1, background: '#eceae5' }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, padding: '12px 30px', minWidth: 0 }}>
              <span style={{ flex: '0 0 auto', width: 5, height: 5, borderRadius: '50%', background: '#7c5cff' }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: '#2a2342', letterSpacing: '-0.005em' }}>{meta.rule}</span>
            </div>
          </div>
        </div>

        {/* body: diagram (wider) | big lead */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 1.4, minWidth: 0, padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
            <StepDiagram key={step} step={step} />
            <span style={{ fontWeight: 600, fontSize: 13, color: '#897f70', lineHeight: 1.5, padding: '0 2px' }}>{meta.caption}</span>
          </div>
          <div style={{ flex: '0 0 auto', width: 1, background: '#f4f3f0' }} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 30px' }}>
            <LeadText lead={meta.lead} hl={meta.hl} />
          </div>
        </div>
        {/* pre-flight checks — full-width chevron strip */}
        <div style={{ padding: '6px 30px 20px' }}>
          <ChecksStrip step={step} ask={meta.ask} checks={checks} toggle={toggleCheck} />
        </div>

        {/* footer nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 30px', borderTop: '1px solid #f4f3f0', background: '#fcfcfb', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 46 }}>
            {step > 0 && (
              <span onClick={() => goStep(step - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: '#faf9f7', border: '1px solid #efedea', borderRadius: 12, padding: '8px 18px 8px 9px' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', border: '1px solid #e8e6e0', display: 'grid', placeItems: 'center', color: '#8c8a81', fontSize: 15 }}>←</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b0aea3' }}>Back</span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1813' }}>{PLAN_META[step - 1].rail}</span>
                </span>
              </span>
            )}
          </div>
          {step < 4 ? (
            allClear ? (
              <span onClick={() => goStep(step + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: '#f3f0ff', border: '1px solid #e6ddfb', borderRadius: 12, padding: '8px 9px 8px 18px' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#a99cd0' }}>Next step</span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#1a1813', letterSpacing: '-0.01em' }}>{PLAN_META[step + 1].rail}</span>
                </span>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', border: '1px solid #e6ddfb', display: 'grid', placeItems: 'center', color: '#7c5cff', fontSize: 15 }}>→</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11, cursor: 'not-allowed', background: '#f7f6f3', border: '1px solid #efedea', borderRadius: 12, padding: '6px 6px 6px 16px' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4c2b8' }}>Next step</span>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#b0aea3', letterSpacing: '-0.01em' }}>{PLAN_META[step + 1].rail}</span>
                </span>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: '#eceae5', display: 'grid', placeItems: 'center', color: '#c4c2b8', fontSize: 15 }}>→</span>
              </span>
            )
          ) : allClear ? (
            <span onClick={() => { persistPlan(step, true); setFinished(true); planActions.setView('editor'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 13, cursor: 'pointer', background: '#7c5cff', border: 'none', borderRadius: 12, padding: '8px 9px 8px 18px', boxShadow: '0 4px 14px -4px rgba(124,92,255,0.5)' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.72)' }}>Done exploring?</span>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#fff', letterSpacing: '-0.01em' }}>Plan this trade</span>
              </span>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 15 }}>→</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 11, cursor: 'not-allowed', background: '#f7f6f3', border: '1px solid #efedea', borderRadius: 12, padding: '6px 6px 6px 16px' }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#b0aea3' }}>Clear all checks</span>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: '#eceae5', display: 'grid', placeItems: 'center', color: '#c4c2b8', fontSize: 15 }}>✓</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
