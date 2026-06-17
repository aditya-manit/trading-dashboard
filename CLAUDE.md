@AGENTS.md

# Project: Gate.io Trading Dashboard

Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · SWR

## Critical security rules (never break these)
- `GATE_API_KEY` and `GATE_API_SECRET` live only in `.env.local` — never in source
- All Gate.io API calls MUST go through `/api/gate/*` server-side routes
- Never import or reference `process.env.GATE_API_KEY` / `GATE_API_SECRET` in any client component or hook
- `ANTHROPIC_API_KEY` (used by `lib/event-insight.ts` for calendar reaction lines) is likewise server-only — never reference it in a client component or hook

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
    page.tsx                          # Holds page state (Dashboard|Plan); Plan is default
    api/gate/
      account/route.ts
      positions/route.ts
      position-history/route.ts       # 179-day window, offset pagination
      account-book/route.ts           # 6×30d windows
      trades/route.ts
      btc-candles/route.ts            # Gate spot 1d candles (also used for "2 prints" %)
    api/calendar/route.ts             # ForexFactory feed proxy + insight/prints enrichment
  components/
    layout/Topbar.tsx                 # Sticky nav; Dashboard/Plan toggle; scroll-tab (dashboard only)
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
      PlanPage.tsx                    # Pre-trade workbook (Plan page) + economic-calendar news strip/drawer
      planDiagrams.ts                 # 5 step SVGs, verbatim from handoff 15
  hooks/
    useAccount.ts · usePositions.ts · usePositionHistory.ts
    useAccountBook.ts · useTrades.ts · useCalendar.ts
  lib/
    gate-client.ts                    # HMAC signing + fetch wrapper
    trade-stats.ts                    # computeTradeStats, buildEquityData
    event-insight.ts                  # Claude (web-search) event insights + Gate BTC "2 prints" %
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

## Pages & tab sections
Top-level `page` state in `page.tsx` toggles between **Plan (default)** and **Dashboard**
via the Topbar's Dashboard/Plan segmented control. Plan → `<PlanPage/>`; Dashboard →
the scroll-nav sections below (scroll-spy active only on Dashboard).
```
Plan (default) → PlanPage  (Topbar tabs: Workbook* / Plans / Journal — only Workbook live)
Dashboard:
  #overview   → Hero, EquityChart, HighlightCards, RealizedPerformance, KpiStrip
  #positions  → PositionsTable
  #reports    → KeyMetricsRow
  #history    → PositionHistoryTable
```

---

## Session handover — current UI state (updated 2026-06-17, through handoff 16)

This is the source of truth for component-level styling decisions that aren't
obvious from the code. Keep it current; delete entries once they're plainly
encoded in the component and no longer surprising.

### Top-level pages: Dashboard ↔ Plan (`app/page.tsx`, `layout/Topbar.tsx`)
- `page.tsx` holds `page: 'dashboard' | 'plan'` state and renders either the dashboard sections or `<PlanPage/>`. The Topbar's **Dashboard/Plan segmented toggle** (left, after the Gate.io pill) drives it — active = white text on `#23211b` (Dashboard) / `#7c5cff` (Plan).
- On the Plan page the center nav tabs become **Workbook / Plans / Journal** (only Workbook is live; Plans/Journal are inert placeholders at `#c3c1b8`). Scroll-spy section nav is disabled while on Plan.

### Plan page — Pre-trade workbook (`plan/PlanPage.tsx`) — matches handoff-15 "fresh redesign"
- 5-step trading checklist: header → market-news strip (4 cards) + "View all" → news drawer → top stepper → step card → footer nav. The workbook itself is educational content (no API); the news strip/drawer is **live data**.
- **Progressive load (split endpoints).** `useCalendar()` → `/api/calendar` returns the **raw feed only** (fast, ~100ms) so cards render immediately (header, time, countdown, forecast, tag). `useCalendarInsights()` → `/api/calendar/insights` returns the **slow** enrichment map (`currency|title → insight`); the reaction + BTC-prints rows show shimmer skeletons (`Skel`, `plPulse` keyframe) until it resolves, then merge in. No more whole-strip "Loading…". The banner's "Next: …" comes from the feed, so it's instant too.
- **Market news = real economic calendar.** The feed proxies ForexFactory's free FairEconomy feed (`nfs.faireconomy.media/ff_calendar_thisweek.json`, no key, route caches 6h). Filtered by **`isBtcRelevant`** (`lib/calendar-filter.ts`, shared by route + `PlanPage`): `impact==='High' && (country==='USD' || central-bank-decision)`. So USD high-impact (the real BTC macro movers) + non-USD **central-bank decisions** (BoJ/ECB/BoE/SNB — global liquidity); minor-currency *data* (NZD GDP, GBP Claimant Count, …) is dropped. CB detection is specific phrases (`policy rate`, `bank rate`, `monetary policy`, `FOMC|SNB|BOJ|…`, etc.) — deliberately NOT a bare "rate" so "Unemployment Rate" doesn't leak in. Upcoming only, sorted; strip shows next 4 (each with a live `Countdown` ticking 1s, shown only on the strip variant), drawer groups by day. Times render in the **viewer's local timezone** (feed carries a US-Eastern offset). No `actual` field — cards show forecast/previous.
- **News header = V5 "departure board"** (`NewsHeader`, handoff 17): pulsing green dot + MARKET NEWS / **LIVE FEED** (not "sample" — it's the real feed) · NEXT RELEASE (event + currency·impact) · big seconds-ticking `CountdownFull` + UNTIL RELEASE · **progress bar = imminence over a fixed 24h window** (`(24h − timeUntil)/24h`, min 5% so it's never empty; the countdown gives the exact time, the bar the gut-feel) · THIS WEEK legend showing **our tiers** (US Macro green / Central bank purple counts — not generic High/Med/Low, which we don't surface) · View all. Replaces the old bell banner.
- **Drawer has an Upcoming / Released toggle** (`newsTab`). Released ("Earlier this week") shows already-fired relevant events in `ReleasedCard`: same white card styling as upcoming, 4-col spec table — Forecast | value | Actual | value — then If-`<condition>` | reaction | Reaction | **the realized reaction**. The **Actual is coloured by the figure vs its FORECAST** (`surprise`, INDEPENDENT of BTC): Hot (higher/stronger) → red ▲, Soft (lower) → green ▼, In-line (equals forecast) → grey `=`. A hold at the expected rate is In-line (grey), NOT Hot — a client guard forces In-line when actual==forecast. But a real surprise with no feed forecast still earns Hot — e.g. the FOMC **dot-plot revision** (3.4%→3.8%) is the genuine hawkish event and reads red, while the rate hold reads grey (give the right event the credit). The **Reaction row shows what BTC actually did** (`reaction`), kept SEPARATE — a hawkish event where BTC is flat/up is visible, never forced to match. **Actual is numeric only for numeric events** (rate → single rate `3.75%`, data → `0.4%`); non-numeric events (statement, press conf, speech, minutes) get a short qualitative outcome (`Hawkish hold`) — the prompt forbids inventing a number/range (e.g. `3.625%`) for those, and carries worked examples (hold = in-line, dot plot = hot, a divergence case) for consistency. The `If <condition>` label is forced to a single word.
- **Tags, not HIGH, everywhere.** The released cards, the strip/drawer cards, AND the header's "Next release" line all show our tier tag (`US Macro` green / `Central bank` purple via `relevanceTag`) — never a generic HIGH badge. (Don't reintroduce HIGH.)
- **Released Actual carries an optional hover note** (`ReleasedInfo.note`, Claude-generated): a short context line (vs forecast/previous, the notable move, what stood out) shown via `HoverTip` only when present — the Actual gets a dashed underline when there's a note. Empty/absent otherwise. Data via `useCalendarReleased` → `/api/calendar/released` → `enrichReleased` (Claude **web search** for the real actual figure + how BTC/stocks actually moved; verified — unconfirmed actuals aren't cached; bounded to the 4 most-recent). **Persistence is two-tier:** a transient `.cache/` entry while the event is still settling, then — once it's ≥4h past release (reaction final) — its outcome is promoted to a **permanent committed archive `data/released-archive.json`**, keyed PER-OCCURRENCE (`currency|title|YYYY-MM-DD`) so a new FOMC never overwrites the old, and archived events are **never re-fetched**. Commit `data/released-archive.json` to keep history forever (serverless FS is read-only, so the committed file is the durable store).
- **Strip cards are rich** (`StripCard`, matches handoff-16): header (currency/HIGH + title + time + live `CountdownLabel`) over a Forecast / If-`<condition>` / **BTC 2 prints** table. Drawer cards stay compact (`NewsCard`: forecast + reaction line, no countdown/prints).
- **Insight enrichment is two-tier** (`lib/event-insight.ts`, model `claude-haiku-4-5-20251001`, `fetch` to Messages API — no SDK dep), both cached in-process by `currency|title`:
  - **`enrichReactions`** — condition + assets ("if hawkish → BTC↓ · USD↑ · SPX↓"). Cheap, **one batched call, NO web search**. Run for **ALL relevant events**, so every card (strip *and* drawer) gets the reaction row.
  - **`enrichPrints`** — the 2 most recent *completed* occurrence dates (STRICTLY before today; the prompt + a route guard exclude today's/upcoming meeting, else you'd get only 1 usable print). **Per-event `web_search` server tool** (capped 5 concurrent), verified. Run **only for the strip's 4 cards** (the expensive bit). The route fills each date's `%` from the Gate candle map (`btcDailyMoves`, cached 1h, recomputed per request).
  - Caching is **persisted to disk** (`.cache/event-insight.json`, gitignored) and loaded on startup, so prints/reactions **don't change on reload or restart** (this was a bug — in-memory-only cache reshuffled the dates every restart). Calls use **`temperature: 0`** for deterministic re-enrichment. Web search only fires for an event missing from the cache (warm `/api/calendar` ≈ 20ms; cold ≈ 10–35s). To force a refresh, delete the cache file. Without `ANTHROPIC_API_KEY` both tiers are skipped → forecast only. (Note: serverless FS is often read-only, so the write no-ops there and it falls back to per-instance in-memory.)
- **Event-name hover shows a definition** (`EventName` + `useCalendarDefinitions` → `/api/calendar/definitions`, `lib/event-definitions.ts`). Cache-first: a curated `SEED_DEFS` map (in code, no API) covers the common releases; misses are fetched once from Claude (batched, no web search) and **persisted to `.cache/event-defs.json`** (only fetched entries; seed stays in code) so a title is never re-fetched. Tooltip is **portaled to `document.body`** (not just `position:fixed`) — the drawer panel's `pkSlideIn … both` leaves a permanent `transform`, which would otherwise contain/clip a fixed descendant, so the drawer tooltips were invisible until portaled. Title gets a dashed underline + help cursor when a def exists. The portaled tooltip is the shared `HoverTip` primitive (opens above, flips below near the viewport top).
- **The drawer header "This week's high-impact" is a `HoverTip`** explaining the filter (`FILTER_TIP`, rendered as **three points**: +High-impact USD, +non-USD central-bank decisions, −minor-currency data hidden) — a plain-English `isBtcRelevant`. `HoverTip.tip` accepts a `ReactNode` so it can hold rich content.
- **Each card's tier tag REPLACES the old HIGH badge** (everything shown is high-impact, so HIGH was redundant). `relevanceTag` (`calendar-filter.ts`) → `US MACRO` in green `#1f9d55`, `CENTRAL BANK` in brand purple `#7c5cff`. Rendered by `Tag` in the badge's old text style. Mirrors the `isBtcRelevant` gate.
- **"BTC 2 prints" % is measured, not model-guessed**: `btcDailyMoves()` pulls ~1000d of Gate daily candles and the route fills each print's `pct` with BTC's real `(close-open)/open` move on that date (dates with no candle are dropped). So dates come from Claude+web-search, percentages from Gate.
- **Verification gate (accuracy over completeness):** the prompt makes Claude confirm each print date against an authoritative source and cross-check, returning `[]` when unsure; each print must come back as `{date, source}`. The parser **drops any print without a non-empty source or a valid ISO date**, and the route drops any with no Gate candle. Net: a date is shown only if web-search-confirmed AND price-measurable — otherwise the prints row is simply absent. Don't loosen this; the user explicitly wants empty over uncertain.
- **Requires `ANTHROPIC_API_KEY`** (server-only, `.env.local`); without it enrichment is skipped and cards show forecast/previous only — fully graceful. Reaction arrows render green↑/red↓/grey-flat.
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
