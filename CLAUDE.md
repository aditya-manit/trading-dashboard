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
    plan/
      PlanPage.tsx                    # Pre-trade workbook (Plan page) + economic-calendar news
      planDiagrams.ts                 # 5 step SVGs, verbatim from handoff 15
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

## Session handover — current UI state (updated 2026-06-14)

This is the source of truth for component-level styling decisions that aren't
obvious from the code. Keep it current; delete entries once they're plainly
encoded in the component and no longer surprising.

### Top-level pages: Dashboard ↔ Plan (`app/page.tsx`, `layout/Topbar.tsx`)
- `page.tsx` holds `page: 'dashboard' | 'plan'` state and renders either the dashboard sections or `<PlanPage/>`. The Topbar's **Dashboard/Plan segmented toggle** (left, after the Gate.io pill) drives it — active = white text on `#23211b` (Dashboard) / `#7c5cff` (Plan).
- On the Plan page the center nav tabs become **Workbook / Plans / Journal** (only Workbook is live; Plans/Journal are inert placeholders at `#c3c1b8`). Scroll-spy section nav is disabled while on Plan.

### Plan page — Pre-trade workbook (`plan/PlanPage.tsx`) — matches handoff-15 "fresh redesign"
- 5-step trading checklist: header → market-news strip (4 cards) + "View all" → news drawer → top stepper → step card → footer nav. The workbook itself is educational content (no API); the news strip/drawer is **live data**.
- **Market news = real economic calendar.** `useCalendar()` → `/api/calendar` proxies ForexFactory's free FairEconomy feed (`nfs.faireconomy.media/ff_calendar_thisweek.json`, no key, route caches 6h). Filtered to `impact: 'High'`, upcoming only, sorted; strip shows next 4, drawer groups by day. Times render in the **viewer's local timezone** (feed carries a US-Eastern offset). The feed has no `actual` field and no editorial interpretation — cards show forecast/previous only (the design's "→ BTC↓" arrow line was dropped as non-derivable).
- **Step diagrams** (`planDiagrams.ts`) are extracted **verbatim** from `Trading Dashboard (purple).dc.html` and rendered via `dangerouslySetInnerHTML` for pixel fidelity. They animate via the `pk*` keyframes injected by `PlanPage`; the diagram replays on step change because its container is keyed by `step`.
- **Ignore the leftover `pkChart`/`pkWalk`/`pkCard`/`planRail`/`planFinalCheck` functions in the dc.html** — they're from an earlier iteration. The shipped template uses the bespoke per-step SVGs + `planStepper` only.
- Progress (`tdplan_step`, `tdplan_fin`) and per-step checks (`tdplan_checks_v2`) persist to **localStorage**. Check keys are `${step}-${idx}`. `toggleCheck` uses a functional updater — required, since clicking two boxes before re-render would otherwise clobber via stale closure.
- Next is gated on all checks of the current step being cleared; on step 5 the CTA becomes a green "Mark plan complete ✓". `PLAN_META` (5 objects: title/color/rail/short/lead/caption/ask[3]/rule) is the content source.

### Open positions (`positions/PositionsTable.tsx`) — matches handoff-14 spec
- Card: white bg, `1px solid #e3d8f8`, `borderRadius:20`, soft box-shadow, `overflow:hidden`
- Header strip: `#f1ecfb` bg with `border-bottom:1px solid #e7dffa`, padding `16px 26px`
- Dot: 9px `#7c5cff`, **pulsing** (`posLivePulse` keyframe, purple glow ring, 1.8s) — the pulse is intended; the user only objected to it being *green*
- Title `#2a2342` weight 800 · solid purple LIVE badge (`#7c5cff` bg, white text, `0.08em`)
- Right side: `#8b80b3` labels, a real 1px `#d7d0ea` divider element (not a "|" char), uPnL value weight 800 (green/red)
- **No sparkline.** The design shows one, but `usePositions` is a point-in-time snapshot — there is no historical open-uPnL series to plot. Deliberately omitted; don't re-add a fake one.

### Best & worst + Win rate (`stats/KeyMetricsRow.tsx`)
- Best/worst are two-row cards: header (icon + BTC/USDT.P + BEST/WORST badge + date) + stats strip (Side / **Leverage** / Return / P&L). Clickable → `TradeDetailDrawer`.
- **Hover technique (important):** CSS can't transition `background-image` (gradients), so the gradient lives in an absolutely-positioned overlay `<span>` whose `opacity` animates 0→1 over `.2s`, in sync with `border-color` + inset `box-shadow`. Card content sits at `zIndex:1` above the `zIndex:0` overlay; resting bg stays flat. Best green `#f1faf4→#d7eee0`, worst red `#fcf0ed→#f6ddd4`, gloss `0.6`.
- This hover is intentionally **softer** than the gallery `TradeCard` (which uses gloss `0.68` and a deeper `#cee9d9` end + gradient-at-rest). User compared them and preferred the softer version — do not "match" them.
- Grid `alignItems:stretch` so both cards are equal height. Win rate card: `flex:1` spacer + win/loss split bar anchored at bottom.

### Max Drawdown chart (`KeyMetricsRow.tsx` → `DrawdownChart`)
- Fill is *above* the line (fillUp: `${line} L${X(n-1)},0 L${X(0)},0 Z`)
- Vertical gradient `ddGrad`: 0 opacity at y=0, very slow ease-in (≈0.015 at 3%, 0.04 at 8%, 0.08 at 15%) then exponential to 1.0 at the trough — faint even at shallow dips, dark at the trough
- Horizontal mask `ddGrad-mx`: fades 4% on the left and 4% on the right (96→100%), opaque in between

### Other current patterns
- **Calendar month summary** (`positions-history/PositionHistoryTable.tsx`): nav header = Month/Year stacked · divider · trend circle + net P&L + trade count · divider · win/loss bar (92px, 5px) + W·L counts, all from `monthPositions` (visible y/m). Calendar is the default view (not gallery).
- **Gallery `TradeCard` hover** (same file): the canonical card hover — gloss `0.68` + deepening gradient + darker border + `inset 0 1px 0 rgba(255,255,255,0.9)`, transitioned `.18s`.
- **Definition tooltips** (`DefLabel` / `LabelWithTooltip` / `CellLabel`): `cursor:help`, dashed underline, color shift on hover, dark popup (`#1a1813`, 186px, `bottom:calc(100%+9px)`). In `RealizedPerformance.tsx`, `KpiStrip.tsx`, `KeyMetricsRow.tsx`.

### Workflow
- **Design zips** land in `/Users/aditya/Downloads/Trading Dashboard-handoff (N).zip`. Extract to `/tmp/trading-handoff-N/`, then read the numbered `screenshots/*.png` in order (highest number = final pick — the design iterates within one zip). The exact CSS is in `project/Trading Dashboard (purple).dc.html` — grep it for pixel-accurate values rather than eyeballing screenshots.
- Read the current component before editing. After changes, screenshot with Playwright (installed in repo) and read the PNG back:
  ```
  node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setViewportSize({width:1400,height:900});await p.goto('http://localhost:3000/#SECTION',{waitUntil:'networkidle'});await p.waitForTimeout(2500);await p.evaluate(()=>{const el=document.getElementById('SECTION');if(el)window.scrollTo({top:el.offsetTop-80})});await p.waitForTimeout(700);await p.screenshot({path:'/tmp/check.png'});await b.close();})()"
  ```
  To inspect one element, locate it via `getBoundingClientRect()` and pass a `clip`. For hover states, `page.mouse.move()` onto it first.
- Dev server is kept running at `http://localhost:3000` by the user.
- Commit + push after each logical unit (the user routinely asks "commit and push"). Co-author trailer reflects the active model.
