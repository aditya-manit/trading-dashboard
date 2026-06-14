@AGENTS.md

# Project: Gate.io Trading Dashboard

Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · SWR

## Critical security rules (never break these)
- `GATE_API_KEY` and `GATE_API_SECRET` live only in `.env.local` — never in source
- All Gate.io API calls MUST go through `/api/gate/*` server-side routes
- Never import or reference `process.env.GATE_API_KEY` / `GATE_API_SECRET` in any client component or hook

## Gate.io API constraints
- `position_close` and `account_book`: `from` cannot be more than 180 days before NOW (absolute, not relative to `to`)
- `account_book` is fetched in 6 × 30-day windows (MAX_WINDOWS = 6) to stay within the 180-day limit
- `position_close` is paginated by offset within a single 179-day window (limit 1000, up to 50 pages)
- HMAC-SHA512 sign string: `{METHOD}\n{PATH}\n{QUERY}\n{HEX(SHA512(BODY))}\n{TIMESTAMP}` — PATH must include `/api/v4` prefix

## Contract maths (BTC_USDT perpetual)
- 1 contract = 0.0001 BTC  (`BTC_CONTRACT_SIZE = 0.0001`)
- `notional_USDT = contracts × 0.0001 × price`
- `return_on_margin = PnL ÷ (notional ÷ leverage)`
- Gate.io's `value` field on open positions already contains notional in USDT — use it directly

## Key files
```
src/
  app/
    page.tsx                          # Section layout with IDs for scroll-nav
    api/gate/
      account/route.ts
      positions/route.ts
      position-history/route.ts       # 179-day window, offset pagination
      account-book/route.ts           # 6×30d windows
      trades/route.ts
  components/
    layout/Topbar.tsx                 # Sticky nav, scroll-based active tab, Gate.io logo
    hero/
      Hero.tsx                        # Balance, uPnL badge, milestone progress button
      MilestoneDrawer.tsx             # Slide-out $10M roadmap drawer
    charts/EquityChart.tsx            # SVG chart, green/red by period, hover tooltip
    stats/
      HighlightCards.tsx              # 4 gradient cards with SVG motifs
      KpiStrip.tsx                    # 6-cell strip with Catmull-Rom sparklines
      KeyMetricsRow.tsx               # Win rate donut, best/worst, risk profile
      RealizedPerformance.tsx
    positions/PositionsTable.tsx      # Row hover, Details → PositionDetailDrawer
    positions-history/
      PositionHistoryTable.tsx        # Trade cards, leverage badge, Details → TradeDetailDrawer
  hooks/
    useAccount.ts · usePositions.ts · usePositionHistory.ts
    useAccountBook.ts · useTrades.ts
  lib/
    gate-client.ts                    # HMAC signing + fetch wrapper
    trade-stats.ts                    # computeTradeStats, buildEquityData
    formatters.ts
  types/gate.ts
```

## Formatting conventions
- Negative dollar amounts: always `-$85,347` not `$-85,347`
  Pattern: `{n >= 0 ? '+$' : '-$'}${Math.abs(n).toLocaleString(...)}`
- Positive with explicit sign: `+$85,347`
- Leverage display: `parseFloat(lev) > 0 ? `${n}x` : 'Cross'`

## Design tokens
| Token | Value |
|---|---|
| Background | `#e9e8e4` |
| Card bg | `#ffffff` |
| Card border | `1px solid #f0efec` |
| Primary text | `#1a1813` |
| Secondary text | `#8c8a81` / `#9b988d` |
| Green (profit) | `#1f9d55` text · `#2faa63` indicator · `#e9f6ee` pill bg |
| Red (loss) | `#df5338` text · `#fbeae6` pill bg |
| Coral accent | `#c25a33` / `#ef5f33` |
| Font | Plus Jakarta Sans (Google Fonts, weights 400–800) |

## Drawer pattern (both drawers follow this)
- Fixed `right:0`, `width:434px`, `z-index:91`
- Backdrop at `z-index:90` with `rgba(20,18,12,0.34)` + `backdropFilter:blur(2px)`
- Animation: `drawerIn` keyframe `translateX(100%) → translateX(0)`, 280ms cubic-bezier
- Detail rows table: `border:1px solid #f0efec; border-radius:14px; overflow:hidden`
  Each row: `padding:13px 16px; border-bottom:1px solid #f5f4f1`

## Tab sections (scroll-nav)
```
#overview   → Hero, EquityChart, HighlightCards, RealizedPerformance, KpiStrip
#positions  → PositionsTable
#reports    → KeyMetricsRow
#history    → PositionHistoryTable
```

---

## Handover for Opus — current state as of 2026-06-14

### What was just built / polished (last ~2 sessions)

**Open positions card (`PositionsTable.tsx`)**
- Two-section layout: solid lavender header (`#ece8ff`) + white table body, `overflow:hidden` + `borderRadius:20`
- Header: purple dot (8px, `#7c5cff`, static — no animation) · "Open positions" dark text · solid purple LIVE badge (`#7c5cff` bg, white text) · right side: "N open | uPnL ±$X" (plain text, green/red value)
- The "sparkline" idea was dropped — `usePositions` only gives a current snapshot, no historical uPnL series exists
- Purple theme tokens for this card: dot/badge `#7c5cff`, card border `#e0d5f5`, header bg `#ece8ff`

**Max Drawdown chart gradient (`KeyMetricsRow.tsx` → `DrawdownChart`)**
- Fill is *above* the line (fillUp path: `${line} L${X(n-1)},0 L${X(0)},0 Z`)
- Vertical gradient: starts at 0 opacity at y=0, slow ramp to 0.04 at 2%, 0.08 at 15%, exponential to 1.0 at 100%
- Horizontal mask: left fade 4%, right fade 4% (96%→100%), center fully opaque
- Intent: fill is always faintly visible even at shallow dips, darkens dramatically at trough

**Calendar month summary (`PositionHistoryTable.tsx`)**
- Nav header now shows: Month/Year stacked | divider | trend circle + net P&L + trade count | divider | win/loss bar (92px, 5px) + W·L counts
- All computed live from `monthPositions` (filtered by visible y/m)

**Best & worst cards + Win rate card (`KeyMetricsRow.tsx`)**
- Two-row card: header (icon + name + badge + date) + stats strip (Side / Lev / Return / P&L)
- Cards are clickable → opens `TradeDetailDrawer` (exported from `PositionHistoryTable.tsx`)
- Grid uses `alignItems: stretch` so both cards reach equal height
- Win rate card: `flex:1` spacer + win/loss split bar anchored at bottom

**Definition tooltips**
- `DefLabel` pattern: `cursor:help`, dashed underline, hover shifts color, dark tooltip popup (`#1a1813` bg, 186px wide, `bottom:calc(100%+9px)`)
- Applied in: `RealizedPerformance.tsx` (Gross profit, Gross loss, Profit factor), `KpiStrip.tsx` (`CellLabel`), `KeyMetricsRow.tsx` (`LabelWithTooltip`)

### What still needs work (user has design zips to reference)

The user works from Figma-exported design zips dropped into `/Users/aditya/Downloads/`. Each zip contains a `screenshots/` folder with numbered iterations (e.g. `openpos14.png`, `openpos15.png`, `openpos16.png`) where the highest number is the final chosen design. Always read all screenshots in sequence before implementing — the design evolves across iterations within a single zip.

Outstanding / likely next areas:
- The position history / trade history section (`#history`) may need further polish
- The overview section hero / equity chart may still have open design items
- User may share more zips for other sections

### Key workflow notes
- User shares design zips: extract to `/tmp/trading-handoff-N/`, read all `screenshots/` PNGs in order, then read the current component before touching code
- Always screenshot with Playwright after changes: `node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setViewportSize({width:1400,height:900});await p.goto('http://localhost:3000/#SECTION',{waitUntil:'networkidle'});await p.waitForTimeout(2500);await p.evaluate(()=>{document.getElementById('SECTION')?.scrollIntoView()});await p.waitForTimeout(800);await p.screenshot({path:'/tmp/check.png'});await b.close();})()"`
- Dev server runs on `http://localhost:3000` — user keeps it running
- Commit and push after each logical unit of work (user always asks "commit and push")
