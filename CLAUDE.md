@AGENTS.md

# Project: Gate.io Trading Dashboard

Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · SWR

## Critical security rules (never break these)
- `GATE_API_KEY` and `GATE_API_SECRET` live only in `.env.local` — never in source
- All Gate.io API calls MUST go through `/api/gate/*` server-side routes
- Never import or reference `process.env.GATE_API_KEY` / `GATE_API_SECRET` in any client component or hook
- `ANTHROPIC_API_KEY` (used by `lib/event-insight.ts` for calendar reaction lines) is likewise server-only — never reference it in a client component or hook
- `APIFY_TOKEN` (used by `/api/heatmap` for the liquidation heatmap Actor) is likewise server-only — never `NEXT_PUBLIC_`, never in a client component/hook

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
    api/heatmap/route.ts              # Apify coinglass-liquidation-heatmap Actor proxy (server-only APIFY_TOKEN)
    api/heatmap/metrics/route.ts      # daily TLL/LCG snapshot store (Supabase) for the strip's trend
    api/calendar/route.ts             # ForexFactory feed proxy + insight/prints enrichment
  components/
    layout/Topbar.tsx                 # Sticky nav; Dashboard/Plan toggle; scroll-tab; global Heatmap launcher button
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
    heatmap/
      HeatmapPage.tsx                 # Liquidation heatmap: themed canvas + zoom/pan/crosshair + profile + strip (handoff 32)
      HeatmapOverlay.tsx              # full-screen launcher wrapper (reads heatmap-launch store)
      HeatmapLaunchCard.tsx           # launch card — 'card' variant (Step 5) / 'row' variant (editor Levels)
      HeatMatrixIcon.tsx              # unified green→red heat-matrix glyph (header btn + both launch cards)
  hooks/
    useAccount.ts · usePositions.ts · usePositionHistory.ts
    useAccountBook.ts · useTrades.ts · useCalendar.ts · useHeatmap.ts
  lib/
    gate-client.ts                    # HMAC signing + fetch wrapper
    trade-stats.ts                    # computeTradeStats, buildEquityData
    apify-heatmap.ts                  # shared Apify Actor fetch (used by /api/heatmap + daily capture)
    heatmap-metrics.ts                # liquidation magnets / strongest wall / center-of-gravity (absolute USD)
    heatmap-capture.ts                # captureDailyHeatmapMetrics() — pull+compute+upsert (cron + on-load)
    heatmap-launch.ts                 # tiny store to open the heatmap overlay (from Step 5 / editor)
    event-insight.ts                  # Claude (web-search) event insights + Gate BTC "2 prints" %
    formatters.ts
  types/gate.ts
```

## Formatting conventions
- Negative dollar amounts: always `-$85,347` not `$-85,347`
  Pattern: `{n >= 0 ? '+$' : '-$'}${Math.abs(n).toLocaleString(...)}`
- Positive with explicit sign: `+$85,347`
- Leverage display: `parseFloat(lev) > 0 ? `${n}x` : 'Cross'`

## Interaction conventions
- **No hover-lift / `translateY` on cards or buttons.** Hover affordance is a subtle
  shadow deepen + border-color shift ONLY (transition `box-shadow`/`border-color`, never
  `transform`). Don't add `translateY(-1px)`-style lifts. (Standing rule, handoff 32.)

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
(2-way `PAGES` toggle in `Topbar.tsx`). The **liquidation heatmap is NOT a top-level page** —
it's a full-screen overlay (`<HeatmapOverlay/>`, always mounted in `page.tsx`) launched on
demand from the workbook Step 5 card and the plan editor's Levels card via
`heatmapLaunch.open(symbol)` (`lib/heatmap-launch.ts`). Closing it (back button) reveals the
page underneath unchanged. (It used to be a 3rd toggle pill — removed; it's market context,
not a workflow.)
```
Plan (default) → PlanFunnel  (Topbar tabs: Workbook / Plans / Journal — ALL live)
   view switcher (lib/plan-store `view`): workbook → PlanPage · editor → Editor ·
   board → Board · journal → Journal; PlanDrawer overlays any view. Plans tab shows
   a count badge (plans), Journal tab a count badge (total closed trades).
Dashboard:
  #overview   → Hero, EquityChart, HighlightCards, RealizedPerformance, KpiStrip
  #positions  → PositionsTable
  #reports    → KeyMetricsRow
  #history    → PositionHistoryTable
Liquidation heatmap → full-screen overlay, launched from workbook Step 5 / editor Levels
```

---

## Session handover — current UI state (updated 2026-06-21, through handoff 26)

This is the source of truth for component-level styling decisions that aren't
obvious from the code. Keep it current; delete entries once they're plainly
encoded in the component and no longer surprising.

### Plan funnel — handoff 40 (expected dates, kebab, resizable drawers)
- **Model** (`lib/plan-model.ts`): `PlanDraft`/`Plan` gained `tradeDate` (ISO yyyy-mm-dd);
  `PlanDraft` also `trailPeriod`/`bankPct`/`bankTarget` (the management-rule slots). `TP_BLANK`
  defaults `tradeDate: todayISO()`, `bankPct:'70'`, `bankTarget:'100k'`, `trailPeriod:''`.
  New shared helpers: `todayISO` · `dateToISO` · `isoToDate` · `relDateLabel(iso)` →
  `{label,sub}` (Today/Tomorrow/weekday/`Jun 30, 2026`) · `composeNote(pct,period,target)`
  (the "Trail with Donchian(…, 3) … Bank N% when reward hits $X …" sentence).
- **Editor** (`Editor.tsx`): the Target/exit thesis cell is now a **management-rule strip**
  (`TargetRule`/`MgmtChip`) — tappable colored slots: period (purple), % (amber), $target
  (green), each with presets; editing any slot recomposes `targetNote` via `composeNote`.
  The other 3 thesis fields have **Tab-to-autofill** (Tab on an empty field accepts its
  placeholder). The name row carries an **Expected-date dropdown** (`ExpectedDate`, defaults
  today) — a relative popover over the shared `MiniCalendar` (fits inside the card, no portal).
- **Shared calendar** (`MiniCalendar.tsx`): presentational month grid (`MiniCalendar`),
  the `CalIcon`, and **`PlanDateModal`** — a centered modal (title row + calendar) for
  editing a saved plan's date. ⚠️ `PlanDateModal` is **`createPortal`'d to `document.body`**
  — the board lanes / drawer panels carry transforms that would otherwise contain & clip a
  `position:fixed` modal (same reason `HoverTip` portals). The editor popover is `absolute`
  inside its card so it doesn't need the portal.
- **Board cards** (`Board.tsx`): direction bookmark moved to a **top-left triangle**
  (`polygon(0 0,100% 0,0 100%)`) to free the top-right corner for a **date trigger** (relative
  label, purple when set / dashed "Date" when empty) under a **3-dot kebab** (hover-revealed;
  Edit plan / Duplicate / Delete) — replaces the old hover trash button. Clicking the date
  opens `PlanDateModal`. Name row right-pad bumped 42→58 for the corner.
- **Auto-promote** (`plan-store.ts` `autoArmToday`): a plan whose `tradeDate` is today and
  `status==='idea'` is promoted to `armed` on hydrate + after `syncRemote` (remote promotions
  re-POST). `planActions.setPlanDate(id, iso)` sets the date (carries it into the editor
  snapshot ONLY when one already exists — never fabricates a partial draft, which would blank
  the card's math — and auto-arms if today).
- **Plan drawer** (`PlanDrawer.tsx`): title is now **single-line ellipsis** (dropped the
  l1/l2 split); pill row gained an editable **Set-date pill** → `PlanDateModal`.
- **Resizable drawers** (`DrawerResize.tsx`): `useDrawerWidth()` external store + persisted
  `tdplan_drawer_w` (default **534**, clamp 360…min(96vw,1000)); `<DrawerResizeHandle/>` is the
  drop-in left-edge grip (drags the parent fixed drawer's width directly, commits to the store
  on mouseup). Wired into the plan, open-position (`PositionsTable`), recent-trade
  (`PositionHistoryTable`), journal (`Journal`), AND the workbook **news drawer**
  (`PlanPage.tsx`, "Economic calendar") — all share one width. The plan
  drawer's companion **stage panel tracks the width** (className `tp-plan-stage`; `right`/`width`
  derived from `drawerW`, and the handle live-syncs it via `querySelector` during the drag).
- **News drawer**: Upcoming card Forecast label column widened **72→92px** (`NewsCard` in
  `PlanPage.tsx`) so "Forecast" fits one line. Strip cards stay 72px; released cards unchanged.
- **Journal drawer**: added the **Fees** row to the "Intended vs actual" spec table (was
  missing from the React port vs the dc.html). `JTrade.feeStr` is derived in `lib/journal.ts`
  `mapTrade` from the real Gate `pnl_fee` (`−$N`, or `—` when zero); planned col is `—`.

### Plan funnel — built components (handoff 22→26)
The whole Plan funnel is ported and live. Files under `components/plan/`:
- `PlanFunnel.tsx` — view switcher (workbook/editor/board/journal) + always-on `PlanDrawer`.
- `Editor.tsx` — "Plan a trade" form (thesis 2×2, chart upload, identity, levels,
  sizing 5-unit + % slider, leverage). Header **mark + equity are REAL** (live BTC
  mark from open-position `mark_price` else latest Gate daily close; equity from
  `useAccount().total`); threaded into `tpCompute(d, equity, mark)`. `CX-####` from
  the futures user id when a position is open, else omitted.
  - **Risk backdrops** (`RiskAlert`): a full-screen red radial-wash modal fires when you cross
    **above 5× leverage** ("liquor, ladies, and leverage" Munger quote → "Whoa. Past 5×.") or
    **above 50% size** in a %-mode ("first rule of compounding" → "Over half your account."),
    with a striped pulsing alert card + **Adjust to 5× / Trim to 50%** vs a dismiss button.
    Fires on CROSSING up (re-arms when back in the safe zone); blocked thresholds are 10× / 70%.
- `Board.tsx` — Plans board: `ac` cards (margin donut + coin/name/dir/lev +
  **conviction dots** + entry + risk/reward + split bar). Cursor: `pointer` at rest,
  `grabbing` while dragging. Lanes have colored **glow haloes** (no box) + **number-led
  headers**; **modern empty states** (icon chip on dashed tinted card; the Ideas chip
  opens the editor). Soft `#f1ecff` "New plan" pill. `StatsBar` sits on a `z-index:2`
  layer so glows don't bleed onto it.
- `StatsBar.tsx` — board stats band: direction/plans donuts, conviction split,
  avg risk/reward/R:R, leverage + margin histograms. **Risk-ramp colors** (≤5×/≤50%
  green → amber `#ffa31a` → red → dark `#b5341f`); margin in fixed bands (≤50/50-65/
  65-80/>80), each its own bar; conviction High green / Med amber / Low grey.
- `Journal.tsx` — post-trade review vs REAL Gate trades. **Filter bar = connected flow
  diagram** (All Trades › Planned[All·Followed·Off-plan·Wrong dir] / Unplanned[No plan]
  › Queue › Reviewed[All·A·B·C·D], chevron-joined, no box). Drawer has an **unlink**
  (minus) button + adherence recomputes live. Opening a plan from the drawer closes
  the journal drawer first (so the plan comes to front). **Re-clicking the active grade
  clears it** (no separate "clear" button): if the row has a **note**, only the grade is
  dropped (`setJournalField(pid,{grade:undefined})` → POST omits grade → DB sets it null,
  note + reviewed kept); if there's **no note**, the whole row is removed
  (`planActions.clearJournal(pid)` → `DELETE /api/journal?pid=…`) so no empty reviewed
  entry is left, and the trade returns to the Queue.
- `PlanDrawer.tsx` — plan detail (desktop stage ≥900px: R/R map + chart; body spec/
  risk/position/thesis). Real equity + mark threaded in. Chart = the plan's Storage URL.
- `PlanLinkCell.tsx` — trade↔plan link picker. `linkSet` auto-moves the linked plan to
  **Triggered**. Plan **delete cascades** → its links + chart Storage folder removed.
- Math/model in `lib/plan-model.ts` (`tpCompute`, `planToDraft`); store in
  `lib/plan-store.ts`; journal logic in `lib/journal.ts`.

### Liquidation Heatmap (handoff 32 — redesign + full-screen launcher)
`HeatmapPage` was rewritten from `project/Liquidation Heatmap (light).dc.html`. It is now a
**full-screen overlay** (`HeatmapOverlay`, `height:100vh`, `z-index:120`), launched from the
workbook Step 5 card, the plan editor Levels card, AND a **global Topbar "Heatmap" button**
(handoff 34, slim pill left of the Read-only/Synced pill — access from any view), all via
`heatmapLaunch.open(symbol)`. NOT a top-level page. **All three entry points share the
`HeatMatrixIcon`** (green→red 4×4 grid). Launch-card variants: `card` (Step 5, "Shorts vs longs"
eyebrow) · `row` (editor Levels, borderless top-divider row, "Liquidation heatmap" eyebrow). Its own header carries a **Back** button (`onClose` → `heatmapLaunch.close()`),
the LIVE·SYMBOL/USDT eyebrow + title, **refresh** + **theme toggle**, and the **spec-table nav**
(Symbol/Model/Interval bordered cell group). New vs the old version:
- **Light/dark theme toggle** (persisted to `localStorage` `lh_theme`). Themed via CSS vars on a
  `.lhx` wrapper (`--bg/--panel/--ink/--border/...`), `[data-theme=dark]` override. Canvas
  colors come from a per-theme `palette()` (plot gradient, candle up/down, magma `ramp`, etc.).
- **TradingView-style zoom/pan/crosshair.** A `view` ref `{x0,x1 (0..1 time frac), p0,p1 (price)}`;
  wheel = time zoom, **shift+wheel** or **price-axis wheel** = price zoom, **drag** = pan,
  **double-click** = reset (+ a reset-zoom pill when zoomed). `clampView` bounds it.
  ⚠️ The view is a mutable ref; zoom/pan handlers mutate it then call `drawRef.current()` directly
  AND `bump()` (a `tick` state in the draw effect deps) — without the direct draw the canvas grid
  wouldn't redraw (only the React-rendered axes would). Keep both.
- **Marker lines come from REAL metrics** (`computeHeatmapMetrics`), not hardcoded: CoG=`lcg`,
  MAG↑=`nearestAbove.peakPrice` (green), MAG↓=`nearestBelow.peakPrice` (theme-aware pink/magenta),
  WALL=`strongest.peakPrice` (blue) — thick dashed lines + rounded pill labels; price-axis pills too.
- **Liquidation-map profile panel** (right, 220px): the **standing book = the latest time column**
  (`computeProfile`), per-price bars + cumulative curves split shorts (above price, green) / longs
  (below, red), PEAK label, hover row highlight + crosshair, SHORTS/LONGS totals legend.
  Hover shows a **price chip (left) + Liq-value chip (right)** at the crosshair; the title + readout
  carry a strong triple-halo `text-shadow` so they stay legible over bright bars (handoff 37).
- **5-cell stats strip** (Center of gravity / Nearest magnet ↑ / ↓ / Strongest wall / Leverage load·σ)
  — each label carries a **dot tinted to match its chart marker line** (CoG purple / MAG↑ green / MAG↓
  theme-aware pink / WALL blue; Leverage load has none, it has no marker).
  keeps the day-over-day Δ + 14d sparkline on the CoG + Leverage-load cells (the daily store/cron from
  handoff 31 still feeds it). Crosshair tooltip shows the cell's liquidation-leverage value.
The data/route/metrics/daily-store from handoff 31 are unchanged (see below).
- **Band-pass colorbar (handoff 35):** the colorbar IS the control — drag the lo/hi handle knobs to
  set a band `[lo,hi]` (fraction of max liquidation intensity). Cells with `value/max` outside the band
  are **hidden** in `drawHeat`; the colorbar dims the excluded top/bottom; each handle shows its `%` +
  leverage value (label hidden at the 0%/100% extremes). State `band {lo,hi}`, default **50–100%**.
  On load / refresh / handle-release, **`fitToBand` auto-zooms the PRICE axis** to exactly the levels
  still visible (full 0–100% fits back to the whole range); drag-while-holding just filters, fit on release.
  **Whole-band drag (handoff 36):** the lit area between the handles is a grab region (`cbarBandDown`) —
  drag it to slide the whole band (both handles together, width fixed, clamped 0/1), fit-to-band on release.
  Cursor split: band-drag = grab/grabbing (`lh-dragging`), handle resize = ns-resize (`lh-dragging-ns`).
  Colorbar gradient is now **theme-aware** via the `--cbar` CSS var (light magenta→cream / dark cream→dark).
  The old footer (legend + Apify caption) was **removed** — chart + profile run full height.
- **TODO (idea, deferred — needs accumulated daily history):** overlay the **CoG trajectory** on the
  heatmap instead of today's single flat line. Plan:
  - **One canonical daily CoG series** (the 24h-window `lcg`, already captured into `heatmap_metrics_daily`
    via cron + page-load; `useHeatmapHistory`). Do NOT capture per-interval — that'd be 5× the Actor runs/day.
  - **Overlay = clip that series to the chart's visible x-window**, map each day's CoG to its x-fraction by
    timestamp, connect as a line. This degrades gracefully across ALL intervals with ONE code path:
    on **24h** only ~1 point falls in-window → renders as today's flat line (current behavior); on
    **1w/2w/1mo/3mo** many points fall in → a trajectory showing the gravity migrating up/down over time.
  - History retention raised to `DAYS=100` in `/api/heatmap/metrics` (covers the 3mo interval + buffer);
    rows persist forever in Postgres regardless — this only caps the read.
  - Revisit once the daily capture has enough points (started 2026-06-23, ~1/day).
- **Resilience:** `fetchHeatmapData` retries transient upstream failures up to 3× (1.2s backoff) —
  the CoinGlass Actor intermittently returns 400 / 502 / run-failed / empty; a retry usually
  succeeds. Validation errors (bad symbol/model/interval) are NOT retried.
- **Data = Apify Actor `api_merge/coinglass-liquidation-heatmap`** via `/api/heatmap`
  (`requireOwner`-gated server route; `APIFY_TOKEN` server-only). It POSTs
  `run-sync-get-dataset-items?token=…` with `{symbol,model,interval}` and returns the
  single dataset item: `y_axis:number[]` (price levels), `liquidation_leverage_data:[xi,yi,val][]`,
  `price_candlesticks:[tsSec,o,h,l,c,v][]` (strings), `updateTime`. **Graceful**: no
  token → `501 {configured:false}` → the page shows an "Apify not connected" overlay
  (set `APIFY_TOKEN` in `.env.local` + Vercel to enable). Hook: `useHeatmap(symbol,model,interval)`.
- **Controls** (`Seg`): Symbol BTC/ETH/SOL · Model model1/2/3 · Interval 12h/24h/48h/3d/1w/2w/1mo/3mo
  (state in `HeatmapPage`). **Cache-first** (`useHeatmap`: `revalidateIfStale:false` +
  focus/reconnect off): a given symbol/model/interval runs the Actor ONCE then serves cached —
  reopening the tab does NOT refetch (Actor runs cost Apify units). Fresh data is on-demand only:
  changing a control (new key → one fetch) or the manual **Refresh** button (`mutate()`).
- **Canvas render is ported verbatim** from the dc.html (the `magma` colormap + draw loop):
  cells colored by `val/max` magma; green/red candlesticks; faint price gridlines; dashed
  last-price line. X = candlestick count, Y = `y_axis.length`, `max` = peak liquidation value
  (also the colorbar top label). Redraws on data change + container resize (`ResizeObserver`),
  DPR-aware. Axes are derived from the data (not hardcoded like the sample): price ticks via
  `niceStep`, time ticks from candlestick timestamps (viewer-local), right-axis last-price pill.
  Hover maps mouse → price/time-slot, looks up the liquidation value in a `Map` keyed
  `xi*100000+yi`, and shows the light tooltip (date · Price · Liquidation Leverage).
- The dc.html's `sampleData()`/`rngFn` are **only the design's mock generator** — NOT ported;
  real CoinGlass data has the identical shape, so `prepare()` consumes it directly.
- **Derived metrics strip** (`MetricsStrip` in `HeatmapPage`, math in `lib/heatmap-metrics.ts`,
  `computeHeatmapMetrics`) — computed from the SAME payload (no extra Actor run). Shows 5 cells:
  **Center of gravity** · **Nearest magnet ↑** · **Nearest magnet ↓** · **Strongest wall** · **Total fuel · σ**.
  Cell labels use the shared `HoverTip` (NOT native `title`), dotted underline.
  - **All metrics use ABSOLUTE USD `value`, never the color.** The heatmap color is normalized
    (`val/max`) so there's always a brightest band even on a low-fuel day — brightness is a
    within-view ranking, not a magnitude. The raw `liquidation_leverage_data` values ARE absolute
    USD notional (model-estimated, and window-dependent: a level reads ~$60M on 24h but ~$190M on
    1-week — so metrics are comparable only within one symbol+interval). The colorbar top label is
    literally that max value.
  - **Shared preprocessing:** surviving fuel per level `L(p)` = max over the last `max(3, 2% of cols)`
    columns (the "now" edge); baseline `b` = median of nonzero `L(p)` (noise floor); adjacent above-baseline
    levels merged within `0.25% × price` into runs, then each run is trimmed to its **dense core** —
    the contiguous levels ≥ `CORE_FRAC` (0.35) of the run's peak around that peak (FWHM-style). So a broad
    continuous smear collapses to its center (e.g. a 2%-wide band → ~0.5%) instead of summing the whole 2%.
    Each cluster carries `peak` (single strongest level value), `mass` (Σ over the core), `lo/hi` (core range),
    `peakPrice`. `totalFuel` (TLL) = Σ`L(p)`; `share = mass/total`.
  - **Distance scale τ = realized window volatility** (1σ of log-return moves, %), floored at 0.5% —
    fully self-tuning across 12h/24h/1w (bigger window → bigger σ → distant magnets count more), NO
    hardcoded proportion (we explicitly chose `τ = σ` over `τ = R/2` to drop the magic ÷2).
  - **Metric 1 — Nearest magnet (per side):** `score = share · exp(−dist% / τ)`, top scorer above and
    below. Chosen over ChatGPT's `liquidity/distance` because the latter diverges as distance→0 (a tiny
    cluster on top of price wins), uses dollar (non-scale-free) distance, raw window-dependent size, and
    has no horizon knob; `exp()` is bounded and τ is vol-calibrated.
    The **strip shows each magnet's `peak`** (single strongest level — matches a bright cell), NOT the
    band `mass`, so the number isn't inflated by the band width.
  - **Metric 2 — Strongest wall:** `argmax(mass)` over clusters (distance-agnostic); mass = the core-band
    sum, and the strip shows the core `[lo–hi]` range next to it. Same idea as ChatGPT but on grouped/
    core-trimmed walls, not single bins or a 2% smear.
  - **Metric 3 — Liquidation center of gravity:** `Σ(p·max(0,L(p)−b)) / Σ max(0,L(p)−b)` — the
    fuel-weighted price; baseline-subtracted so the diffuse background doesn't drag it to the y-range
    midpoint (ChatGPT's raw `Σ(p·liq)/Σliq` degenerates on flat days). `lcgGap>0 ⇒ fuel above ⇒ upward pull`.
- **TLL + center-of-gravity are trended** (a bare number isn't actionable): a daily snapshot is
  stored per `day+symbol+interval` in Supabase `heatmap_metrics_daily` (`/api/heatmap/metrics`
  GET history / POST upsert, owner-gated). **Capture = on page-load upsert** (free — reuses the
  computed payload, no extra Actor run); `useHeatmapHistory(symbol,interval)` reads ≤60d oldest→newest.
  The strip shows **Δ vs the latest prior day + a sparkline of the last 14d** (store keeps 60d for a
  future expanded chart; 2 weeks is the readable/relevant window in the strip) on the TLL cell (rising = amber
  "leverage building", falling = green) and the center-of-gravity cell (gap-drift in pp, green=up).
  Magnets/strongest are point-in-time levels → NOT trended. Comparison is within ONE interval (TLL/LCG
  are window-dependent). Graceful: no table / no history → cells show "1st pt", no sparkline, no crash.
  Requires the `heatmap_metrics_daily` table — re-run `supabase/schema.sql` (idempotent) in the SQL editor.
- **Daily auto-capture cron:** folded into `/api/keepalive` (NOT a 2nd cron — Vercel Hobby allows only one)
  via `captureDailyHeatmapMetrics()` (`lib/heatmap-capture.ts`, canonical set = BTC/model1/24h; each entry
  is one Actor run/day). Runs AFTER the keepalive ping, best-effort (an Apify `run-failed` can't break
  keepalive). So the trend fills daily even when the owner doesn't open the page. The Apify fetch is shared
  in `lib/apify-heatmap.ts` (`fetchHeatmapData`, `HeatmapFetchError`) by both `/api/heatmap` and the capture.
- NB: the Apify Actor run occasionally fails upstream (`run-failed` → our route returns 502 with detail);
  the page shows the Retry overlay. Transient CoinGlass-side issue, not our code.

### News/calendar additions (handoff 24+)
- News drawer **"All" toggle** (after Upcoming/Released): reads the full `released_archive`
  across ALL weeks, newest-first (`/api/calendar/archive` + `useCalendarArchive`). Turning
  it on sets the tab to Released; only clicking **Upcoming** untoggles it. The week-scoped
  Released tab naturally empties when the ForexFactory feed rolls to a new week.
- Header countdown rolls into days (`3d 22h`, no ticking seconds when far); strip cards
  show day-aware time (`Today/Tomorrow/Thursday 18:00`, `fmtWhen`).
- Released same-meeting reaction unified; non-numeric events show TONE not the rate (see
  the released-archive notes below).

### Workbook — editorial redesign (handoff 29, refined in handoff 30)
The step card is now an **editorial layout** (`plan/PlanPage.tsx`), replacing the
old left-numeral header + chevron `ChecksStrip` + body `LeadText`. Card has
`margin-top:-12px` to tighten the gap to the top stepper (handoff 30):
- **Header**: a giant **watermark step numeral** (`pad2(n)`, Newsreader 200px
  `#f6f4ee`, top-right, `pointer-events:none`); eyebrow row "THE WORKBOOK" · hairline
  · **`StepSeg` segment bar + "Step N of 5"** (grouped, moved here from the footer in
  handoff 30) · **Reset** button; **serif headline** (`meta.title`, Newsreader
  500/38px); muted lead `<p>` (`meta.lead`, 15.5px — no more big highlighted lead).
- **Body** (`flex gap:30`, bottom-pad 24px): diagram `flex:1.55` | **right column**
  `flex:1` with `gap:22` holding **THE RULE then the checklist** (handoff 30 moved the
  rule up here from a full-width band below the body). Rule = purple bar + "THE RULE"
  eyebrow + the rule in **Newsreader 22px** with a `linear-gradient` highlight-underline.
  Checklist = `Checklist` (vertical dotted-border rows, number→green tick on tinted card)
  under a "YOUR CHECKLIST" header with a **`CheckRing`** progress ring (18×18,
  purple→green when all clear) + mono `N / M` count.
  - **Step 5 only** (`meta.n === 5`, the Liquidity/Traps step): a `HeatmapLaunchCard`
    (shorts/longs donut gauge) sits under the checklist in the right column → opens the
    liquidation heatmap overlay. The editor's Levels card has the same card (different copy).
- **Footer** (handoff 30 simplified to just two pills, no center column): left **Back**
  pill (steps 2-5, `meta.rail` of prev); right = gradient **Next step** pill + arrow-chip
  (or "Plan this trade" on step 5, or a disabled "clear all checks" state until `allClear`).
- **Diagrams** (`planDiagrams.ts`) fully **redrawn** (handoff 29): gridded backgrounds
  (`<pattern>`), per-step `viewBox` + `preserveAspectRatio="xMinYMid meet"` +
  `max-height:380px`, animated via **`vFade`/`vDraw`/`vPulse`/`vPop`** keyframes (defined
  in PlanPage's `<style>`). JetBrains-Mono tick labels resolve through `var(--font-mono)`.
- **Fonts**: `layout.tsx` adds **Newsreader** (`--font-news`) + **JetBrains Mono**
  (`--font-mono`) via `next/font/google` (self-hosted → no CSP change). Workbook uses
  `NEWS`/`MONO` constants in `PlanPage.tsx`.
- Persistence (`tdplan_step`/`tdplan_fin`/`tdplan_checks_v2` in localStorage) + the top
  `STEPPER_ICONS` mini-icons are unchanged.

### Top-level pages: Dashboard ↔ Plan (`app/page.tsx`, `layout/Topbar.tsx`)
- `page.tsx` holds `page: 'dashboard' | 'plan'` state and renders either the dashboard sections or `<PlanPage/>`. The Topbar's **Dashboard/Plan segmented toggle** (left, after the Gate.io pill) drives it — active = white text on `#23211b` (Dashboard) / `#7c5cff` (Plan).
- On the Plan page the center nav tabs become **Workbook / Plans / Journal** (only Workbook is live; Plans/Journal are inert placeholders at `#c3c1b8`). Scroll-spy section nav is disabled while on Plan.

### Plan page — Pre-trade workbook (`plan/PlanPage.tsx`) — matches handoff-15 "fresh redesign"
- 5-step trading checklist: header → market-news strip (4 cards) + "View all" → news drawer → top stepper → step card → footer nav. The workbook itself is educational content (no API); the news strip/drawer is **live data**.
- **Progressive load (split endpoints).** `useCalendar()` → `/api/calendar` returns the **raw feed only** (fast, ~100ms) so cards render immediately (header, time, countdown, forecast, tag). `useCalendarInsights()` → `/api/calendar/insights` returns the **slow** enrichment map (`currency|title → insight`); the reaction + BTC-prints rows show shimmer skeletons (`Skel`, `plPulse` keyframe) until it resolves, then merge in. No more whole-strip "Loading…". The banner's "Next: …" comes from the feed, so it's instant too.
- **Market news = real economic calendar.** The feed proxies ForexFactory's free FairEconomy feed (`nfs.faireconomy.media/ff_calendar_thisweek.json`, no key, route caches 6h). Filtered by **`isBtcRelevant`** (`lib/calendar-filter.ts`, shared by route + `PlanPage`): `impact==='High' && (country==='USD' || (MAJOR_CB.has(country) && CB_DECISION.test(title)))`. So USD high-impact (the real BTC macro movers) + **MAJOR central-bank decisions only** — `MAJOR_CB = {JPY, EUR, GBP}` (BoJ/ECB/BoE). Minor central banks (SNB/RBA/RBNZ/BoC) AND all non-USD *data* (NZD GDP, GBP Claimant Count, …) are dropped — they don't move BTC. CB detection is specific phrases (`policy rate`, `bank rate`, `monetary policy`, `FOMC|SNB|BOJ|…`, etc.) — deliberately NOT a bare "rate" so "Unemployment Rate" doesn't leak in. Upcoming only, sorted; strip shows next 4 (each with a live `Countdown` ticking 1s, shown only on the strip variant), drawer groups by day. Times render in the **viewer's local timezone** (feed carries a US-Eastern offset). No `actual` field — cards show forecast/previous.
- **News header = V5 "departure board"** (`NewsHeader`, handoff 17): pulsing green dot + MARKET NEWS / **LIVE FEED** (not "sample" — it's the real feed) · NEXT RELEASE (event + currency·impact) · big seconds-ticking `CountdownFull` + UNTIL RELEASE · **progress bar = imminence over a fixed 24h window** (`(24h − timeUntil)/24h`, min 5% so it's never empty; the countdown gives the exact time, the bar the gut-feel) · THIS WEEK legend showing **our tiers** (US Macro green / Central bank purple counts — not generic High/Med/Low, which we don't surface) · **View all** button (handoff 20): two-line "View all" (600, dark) over "N EVENTS" (in legible amber `#c9821f` 800 — deliberately punchier than the zip's faint `#bba074` so the count doesn't recede) + a circular arrow chip. Replaces the old bell banner.
- **Drawer has a search box + Upcoming/Released toggle** (`newsQuery`, `newsTab`, handoff 19): the search (magnify icon + input + clear ×, left of the toggle) filters both tabs by event title or currency (`matchQ`); empty day-groups drop out and a no-match search shows the illustrated `NewsEmpty` state (calendar-with-X icon + "No events found / Nothing matches …"). Released ("Earlier this week") shows already-fired relevant events in `ReleasedCard`: same white card styling as upcoming, 4-col spec table — Forecast | value | Actual | value — then If-`<condition>` | reaction | Reaction | **the realized reaction**. The **Actual is coloured by the figure vs its FORECAST** (`surprise`, INDEPENDENT of BTC): Hot (higher/stronger) → red ▲, Soft (lower) → green ▼, In-line (equals forecast) → grey `=`. A hold at the expected rate is In-line (grey), NOT Hot — a client guard forces In-line when actual==forecast. But a real surprise with no feed forecast still earns Hot — e.g. the FOMC **dot-plot revision** (3.4%→3.8%) is the genuine hawkish event and reads red, while the rate hold reads grey (give the right event the credit). The **Reaction row shows what BTC actually did** (`reaction`), kept SEPARATE — a hawkish event where BTC is flat/up is visible, never forced to match. **Actual is numeric only for numeric events** (rate → single rate `3.75%`, data → `0.4%`); non-numeric events (statement, **summary**, press conf, speech, minutes) get a short qualitative outcome (`Hawkish hold`) — the prompt forbids inventing a number/range (e.g. `3.625%`) for those, and a "...Summary/Statement/Minutes/Press Conf" must give the TONE, never the policy rate (the rate belongs to the rate-decision event — give the right event the credit). **Actual must match the forecast's FORMAT**: a vote split like `1-0-8` → the actual is the same N-part split (`2-0-7`), never collapsed to `7-2`. The prompt carries worked examples (FOMC hold = in-line, dot plot = hot, a divergence case, **BoE vote split + BoE summary tone**). The `If <condition>` label is forced to a single word.
- **Tags, not HIGH, everywhere.** The released cards, the strip/drawer cards, AND the header's "Next release" line all show our tier tag (`US Macro` green / `Central bank` purple via `relevanceTag`) — never a generic HIGH badge. (Don't reintroduce HIGH.)
- **Released Actual carries an optional hover note** (`ReleasedInfo.note`, Claude-generated): a short context line (vs forecast/previous, the notable move, what stood out) shown via `HoverTip` only when present — the Actual gets a dashed underline when there's a note. Empty/absent otherwise. Data via `useCalendarReleased` → `/api/calendar/released` → `enrichReleased` (Claude **web search** for the real actual figure + how BTC/stocks actually moved; verified — an **empty actual is NEVER cached** (the gate in `fetchReleased` requires a non-empty actual, so an unconfirmed event re-pulls next load instead of freezing on a flat-guess reaction — this was the bug that left the BoE summary/votes blank). **Two-stage timing** (`event-insight.ts`): `FETCH_AFTER_MS` = **2h** — don't web-search until ≥2h past release so the first pull lands a confirmed figure (too-fresh events show `—` and wait); `SETTLE_MS` = **4h** — then promote to the archive. NB: the gate only blocks *empty* actuals, not a *confident-but-wobbly* one (e.g. the BoE summary tone flip-flopped dovish↔hawkish across pulls) — for those, anchor the tone to the objective fact (the stable vote split) and persist the agreed record straight to `data/released-archive.json`. NO cap — the whole week's released relevant events are enriched (the week-scoped feed + strict BTC filter naturally bound this to ~10-12, web search is 5-concurrent, settled events are archived) so the drawer's Released tab is always complete and matches the header's week-wide count). **Persistence is two-tier:** a transient `.cache/` entry while the event is still settling, then — once it's ≥4h past release (reaction final) — its outcome is promoted to a **permanent committed archive `data/released-archive.json`**, keyed PER-OCCURRENCE (`currency|title|YYYY-MM-DD`) so a new FOMC never overwrites the old, and archived events are **never re-fetched**. Commit `data/released-archive.json` to keep history forever (serverless FS is read-only, so the committed file is the durable store).
- **Strip cards are rich** (`StripCard`, matches handoff-16): header (currency/HIGH + title + time + live `CountdownLabel`) over a Forecast / If-`<condition>` / **BTC 2 prints** table. Drawer cards stay compact (`NewsCard`: forecast + reaction line, no countdown/prints).
- **Insight enrichment is two-tier** (`lib/event-insight.ts`, model `claude-haiku-4-5-20251001`, `fetch` to Messages API — no SDK dep), both cached in-process by `currency|title`:
  - **`enrichReactions`** — condition + assets ("if hawkish → BTC↓ · USD↑ · SPX↓"). Cheap, **one batched call, NO web search**. Run for **ALL relevant events**, so every card (strip *and* drawer) gets the reaction row.
  - **`enrichPrints`** — the 2 most recent *completed* occurrence dates (STRICTLY before today; the prompt excludes today's/upcoming meeting, else you'd get only 1 usable print). **Per-event `web_search` server tool** (capped 5 concurrent), verified. Run **only for the strip's 4 cards** (the expensive bit). **WRITE-ONCE + frozen** (fixed 2026-06-22): each print is stored whole as `{date, pct, reactPct}` (type `Print`) — the web-searched date PLUS the Gate-measured moves (`pct` = whole-day from `btcDailyMoves`, `reactPct` = 4h post-release from `btcWindowMove`). Once an event has a frozen set it is **never re-derived**; the moves are no longer recomputed live in the route. `enrichPrints` does a **read-through**: it reloads the requested keys straight from Supabase (`event_insight.prints`) each call before deciding anything, so a cold / hot-reloaded / serverless instance whose in-memory cache is empty **can't web-search a fresh (drifting) date and overwrite the stored set** — this was the real bug (the `cacheLoaded` once-per-process guard alone let a stale process clobber the DB; the dates drifted day-to-day, e.g. PCE May 29↔May 28, swapping the measured candle). **Legacy date-only rows** (pre-freeze) keep their stored DATES (no re-search) and just get their moves measured + frozen on first read. **Manual re-pull**: an always-visible faint ⟳ inline **after the event title** (`RefreshBtn` in `PlanPage.tsx`; **no hover container** — just an icon-only grey→purple color shift like the workbook Reset button; spins while re-pulling) → `POST /api/calendar/insights/refresh {country,title}` → `clearPrints()` nulls the stored set (in-memory + DB) → client `mutate('/api/calendar/insights')` revalidates → enrichPrints web-searches + re-freezes (row shimmers for the whole re-pull). It's the escape hatch for a wrong frozen date, but the re-search is **non-deterministic** (observed: same event re-pulls May 29 *or* May 28), so it's a "try again", not a guaranteed fix. No confirm dialog (single-user, owner+MFA gated). Its tooltip is the shared `HoverTip` (see below), not a native `title`.
  - Caching is **persisted to disk** (`.cache/event-insight.json`, gitignored) and loaded on startup, so prints/reactions **don't change on reload or restart** (this was a bug — in-memory-only cache reshuffled the dates every restart). Calls use **`temperature: 0`** for deterministic re-enrichment. Web search only fires for an event missing from the cache (warm `/api/calendar` ≈ 20ms; cold ≈ 10–35s). To force a refresh, delete the cache file. Without `ANTHROPIC_API_KEY` both tiers are skipped → forecast only. (Note: serverless FS is often read-only, so the write no-ops there and it falls back to per-instance in-memory.)
- **Event-name hover shows a definition** (`EventName` + `useCalendarDefinitions` → `/api/calendar/definitions`, `lib/event-definitions.ts`). Cache-first: a curated `SEED_DEFS` map (in code, no API) covers the common releases; misses are fetched once from Claude (batched, no web search) and **persisted to `.cache/event-defs.json`** (only fetched entries; seed stays in code) so a title is never re-fetched. Tooltip is **portaled to `document.body`** (not just `position:fixed`) — the drawer panel's `pkSlideIn … both` leaves a permanent `transform`, which would otherwise contain/clip a fixed descendant, so the drawer tooltips were invisible until portaled. Title gets a dashed underline + help cursor when a def exists. The portaled tooltip is the shared **`HoverTip`** primitive (opens above, flips below near the viewport top) — now extracted to `components/plan/HoverTip.tsx` and reused across PlanPage (filter, event names, prints ⟳) AND Journal (the grade buttons' "click again to clear" hint). It takes an optional `style` (so it can be a `flex:1` row item, e.g. the equal-width grade buttons) and only renders the popup when `tip` is non-empty. **Convention: use `HoverTip`, not native `title=`, for tooltips.**
- **The drawer header "This week's high-impact" is a `HoverTip`** explaining the filter (`FILTER_TIP`, rendered as **three points**: +High-impact USD, +non-USD central-bank decisions, −minor-currency data hidden) — a plain-English `isBtcRelevant`. `HoverTip.tip` accepts a `ReactNode` so it can hold rich content.
- **Each card's tier tag REPLACES the old HIGH badge** (everything shown is high-impact, so HIGH was redundant). `relevanceTag` (`calendar-filter.ts`) → `US MACRO` in green `#1f9d55`, `CENTRAL BANK` in brand purple `#7c5cff`. Rendered by `Tag` in the badge's old text style. Mirrors the `isBtcRelevant` gate.
- **"BTC 2 prints" % is measured, not model-guessed**: `btcDailyMoves()` pulls ~1000d of Gate daily candles and `pct` is BTC's real `(close-open)/open` move on that date (dates with no candle are dropped); `reactPct` is the 4h post-release move on 1h candles. So dates come from Claude+web-search, percentages from Gate — but both are **measured once and frozen** onto the stored row (write-once, see `enrichPrints` above), not recomputed each request.
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

### Market-news header empty state (`plan/PlanPage.tsx` → `NewsHeader`)
- When there are **no upcoming** relevant events, do NOT swap in a separate
  banner (that was an old handoff-21 screenshot iteration, rejected). Instead
  **keep the departure-board header** and render a quiet "No upcoming news"
  (grey dot `#cfcdc4` + `#9b988d` text) where the countdown/progress bar was —
  matching the dc.html `newsNoEvents` branch. `NewsHeader.next` is nullable.
- The **strip cards are hidden** entirely when nothing is upcoming.
- "This week" legend + "View all" total come from `weekHigh` (all relevant
  events this week, upcoming + released) so they stay populated after every
  release has fired and the drawer's Released tab still has content.

### Other current patterns
- **Calendar month summary** (`positions-history/PositionHistoryTable.tsx`): nav header = Month/Year stacked · divider · trend circle + net P&L + trade count · divider · win/loss bar (92px, 5px) + W·L counts, all from `monthPositions` (visible y/m). Calendar is the default view (not gallery).
- **Gallery `TradeCard` hover** (same file): the canonical card hover — gloss `0.68` + deepening gradient + darker border + `inset 0 1px 0 rgba(255,255,255,0.9)`, transitioned `.18s`.
- **Definition tooltips** (`DefLabel` / `LabelWithTooltip` / `CellLabel`): `cursor:help`, dashed underline, color shift on hover, dark popup (`#1a1813`, 186px, `bottom:calc(100%+9px)`). In `RealizedPerformance.tsx`, `KpiStrip.tsx`, `KeyMetricsRow.tsx`.

### Workflow
- **⚠️ ALWAYS port the version that is ACTUALLY RENDERED — run this checklist BEFORE writing a line of any component:**
  1. **Re-read the handoff `project/CLAUDE.md` paragraph for that exact component** — it states the final intent (it literally documented the drawer's `tpPlanStage` ≥900px side panel, and the `ac` board card).
  2. **Grep ALL references** in the dc.html: the render fn + where it's *bound* (`{{ … }}` / `dropZone(…, 'ac')`) + **companion fns** (`*Stage`, `*Drawer`, `*Full`) + **responsive / variant gates** (`StageOn`, `>= 900`, `TP_STAGE_MIN`, `dense`, `compact`, `variant ===`).
  3. **Write down the modes** (default · responsive · variants) and build the one shown **at desktop width** (≥900 = stage), not the fallback.
  4. **Screenshot at 1440px and compare** to the described behaviour before calling it done.
  The dc.html keeps superseded variants side-by-side (e.g. `boardCard` has `spec`/`ac`/`b`; the drawer has a `<900` fallback + a `≥900` stage). Mistakes made (now fixed): shipped the older `spec` board card and the drawer's `<900` fallback by porting the first/only code block I saw. The binding + companion fns in the dc.html are the source of truth.
- **Design zips** land in `/Users/aditya/Downloads/Trading Dashboard-handoff (N).zip`. Extract to `/tmp/trading-handoff-N/`, then read the numbered `screenshots/*.png` in order (highest number = final pick — the design iterates within one zip). The exact CSS is in `project/Trading Dashboard (purple).dc.html` — grep it for pixel-accurate values rather than eyeballing screenshots.
- Read the current component before editing. After changes, screenshot with Playwright (installed in repo) and read the PNG back:
  ```
  node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.setViewportSize({width:1400,height:900});await p.goto('http://localhost:3000/#SECTION',{waitUntil:'networkidle'});await p.waitForTimeout(2500);await p.evaluate(()=>{const el=document.getElementById('SECTION');if(el)window.scrollTo({top:el.offsetTop-80})});await p.waitForTimeout(700);await p.screenshot({path:'/tmp/check.png'});await b.close();})()"
  ```
  To inspect one element, locate it via `getBoundingClientRect()` and pass a `clip`. For hover states, `page.mouse.move()` onto it first.
- Dev server is kept running at `http://localhost:3000` by the user.
- Commit + push after each logical unit (the user routinely asks "commit and push"). Co-author trailer reflects the active model.

---

## Planned (NOT yet built): Trade planner — entry / SL / TP / liquidation

A new Plan-page section to plan a trade: input entry, SL, TP; compute exact
liquidation, R:R, and fees. Discussed + inputs verified by the user 2026-06-16.
**Build deferred until the Gate API key has WALLET read permission** (user is
adding it). Do not build until the user confirms.

### Data fetched + verified (2026-06-16)
- **Contract `BTC_USDT`** (`GET /futures/usdt/contracts/BTC_USDT`, public):
  contract size `cs = 0.0001` BTC (`quanto_multiplier`), base maintenance_rate
  0.3%, leverage 1–200, default `taker_fee_rate 0.00075`, `maker_fee_rate -0.0001`.
- **MMR is TIERED + PROGRESSIVE (tax-bracket style):** maintenance margin =
  sum across tiers up to the position notional → an open position reports a
  blended `average_maintenance_rate` (e.g. ~$5.8M position → 0.0058), NOT a
  single tier's rate. Ladder from `GET /futures/usdt/risk_limit_tiers?contract=BTC_USDT`
  (public): ≤500K→0.30% (200x), ≤1M→0.35%, ≤3M→0.50%, ≤5M→0.70%, ≤10M→0.85%,
  ≤15M→1.00%, … up to 1.5B→0.50%/1.05x (19 tiers).
- **Liquidation formula** (USDT perp, isolated; `Q`=contracts, `M`=margin):
  - Long:  `P_liq = (Q·cs·P_entry − M) / (Q·cs·(1 − MMR))`
  - Short: `P_liq = (Q·cs·P_entry + M) / (Q·cs·(1 + MMR))`
  - For exactness, add the closing taker fee to the maintenance buffer.

### Fees — BLOCKED on permission
- `GET /wallet/fee?currency_pair=BTC_USDT` → **403 "does not have wallet
  permission"**. The key has futures read but not wallet. Once wallet read is
  added, fetch `futures_taker_fee` / `futures_maker_fee` (VIP-adjusted) here.
  Until then only contract defaults (taker 0.075% / maker −0.01% rebate) are
  available — NOT VIP-adjusted.

### To build (when unblocked)
- New `/api/gate/*` server routes (per security rule): `fee` (`/wallet/fee`,
  needs wallet perm), `risk-tiers` (`/futures/usdt/risk_limit_tiers`, public),
  `contract` (`/futures/usdt/contracts/BTC_USDT`, public). Hooks: `useFee`, etc.
- Planner computes effective (blended) MMR from the ladder for the planned
  notional, then liq via the formula above; show R:R and net-of-fee TP/SL.

---

## Persistence backend — Supabase (BUILT + DEPLOYED)

**LIVE in production** (`https://trade-mocha-rho.vercel.app`) — env vars set in
Vercel, deployed, keepalive cron registered (daily 09:00 UTC). Plans / links /
journal / chart Storage / released_archive / calendar caches all read & write
Supabase in prod and locally (file/localStorage fallback only when env is unset).

### ✅ TEST DATA CLEANED UP (2026-06-22)
During the Supabase migration we created **throwaway test rows** (test plans,
links, journal grades/notes) and **test chart images in Storage** to verify each
action end-to-end. These have now been **removed from production** (2026-06-22):
- `plans` 5 demo rows → **0** (`pl_btc_reclaim`/`pl_btc_bounce`/`pl_eth_lowerhigh`/
  `pl_btc_failedbreak`/`pl_sol_hl`); `charts` Storage bucket emptied (their 2 PNGs).
- `journal_entries` test rows: `BTC/USDT.P#TESTTIME` removed. The grade-A
  `BTC/USDT.P#1781966694` row (real trade close-time, confirmed a test click by the
  user) is **pending deletion** — the auto-mode classifier blocks an agent deleting a
  real-timestamp-keyed prod row, so finish it via the Supabase SQL editor:
  `delete from public.journal_entries where trade_key = 'BTC/USDT.P#1781966694';`
- `links` was already empty.
- **Kept:** `released_archive` (10 real history rows), `event_insight`/`event_defs`
  (self-healing calendar caches — not test data; clearing only forces a re-fetch).

In **remote mode the board starts empty from Postgres** (no seed import), so it stays
clean. If demo rows ever reappear, wipe specific rows with `delete from … where id in (…)`
(NOT a blanket `truncate`, which would also drop the real `released_archive`). Always
ask before touching `released_archive`.

### Schema
`supabase/schema.sql` — 6 tables (RLS on, no policies → service_role only) + a
public `charts` Storage bucket. **Includes explicit `grant … to service_role`**
(Supabase didn't auto-grant; without it every query is `42501 permission denied`).
Re-runnable. Run it in the Supabase **SQL Editor**.

### How it's wired
- `lib/supabase/admin.ts` — server-only service_role client (`SUPABASE_SECRET_KEY`),
  null when env unset. ws polyfill for Node 20 (supabase-js realtime needs a
  global WebSocket; Node 22/Vercel has it).
- Routes (all `requireOwner`-gated, all return `{configured:false}` 501 when env
  unset): `/api/plans` (GET/POST/DELETE), `/api/plans/chart` (base64 → Storage →
  public URL), `/api/links`, `/api/journal`.
- `lib/plan-store.ts` — `syncRemote()` on hydrate pulls plans/links/journal; when
  configured Supabase is the source of truth (`remote=true`) and every mutation
  writes through the API; else localStorage. Chart base64 uploaded to Storage on
  save, swapped for the URL on the plan. **In remote mode the board starts from
  Postgres (no seed/localStorage import) — deliberately, to avoid polluting the
  real DB with demo data.**
- `released_archive` + the calendar caches (`event_insight`/`event_defs`) are
  also migrated (`lib/event-insight.ts` / `event-definitions.ts` read/write
  Supabase when configured, file fallback otherwise). The committed
  `data/released-archive.json` is kept in sync as the fallback. **Same-meeting
  reaction unification:** `enrichReleased` clusters same-currency events within
  36h (one meeting; minutes days later stay separate) and copies
  reaction/condition/ifReaction from the rate-decision event onto its commentary
  siblings (press conf / statement / summary) — per-event web-search can't see
  siblings, so without this the same meeting showed contradictory BTC reactions.
  actual/surprise/note stay per-event (a press-conf hawkish-tone surprise is
  still its own; non-numeric events show TONE, never the rate).

### ⏳ DEFERRED (user wants in a few months, NOT now) — journal entries survive Gate's window
The journal is an **overlay**: trades are fetched **live from Gate**, then joined
with stored `journal_entries` (grade/note) + `links` by `tradePid`
(`BTC/USDT.P#<closeTime>`). Gate's `position-history` is a **rolling ~179-day
(≈6mo) window**, so a trade older than that **drops out of the fetch** → its
journal entry becomes **orphaned**: still in Supabase (NOT deleted), but not
rendered because nothing in the live list matches it. It re-attaches if the trade
returns. Today `journal_entries` stores only `grade/note/reviewed` — no trade
context — so an orphaned entry can't render standalone. **Planned fix (deferred):**
snapshot a few trade fields (date, side, entry/exit, pnl, lev) into the
`journal_entries` row at write time, so the journal can show stored-but-orphaned
entries after a trade ages out of Gate's window. User said current behaviour is
fine for now; revisit in a few months.

---

## (SUPERSEDED — now Supabase) Plan funnel persistence
**Was localStorage; now Supabase-first (see "Persistence backend" above).** In
remote mode `lib/plan-store.ts` uses Supabase as the source of truth (`remote=true`)
and localStorage is only the fallback when the backend is unreachable / env unset.
The historical localStorage design (kept for the fallback path):
The whole Plan funnel (Editor draft, Plans board, position⇄plan links, Journal
grades/notes) persists to **localStorage** via `lib/plan-store.ts` (`tdplan_*`
keys: `tdplan_view`, `tdplan_tp_draft`, `tdplan_board`, `tdplan_pos_links`,
`tdplan_journal`). This is the **interim** store — the Supabase migration below
is the eventual home for plans/journal (user-authored data you can't lose). The
adherence equity basis is the **real account total** (`useAccount().total`,
falling back to `TP_EQUITY` while loading), and trade keys derive from the
contract (`contractToSym`/`tradePid` in `lib/journal.ts`, e.g. `BTC/USDT.P#<time>`)
— NOT hardcoded to BTC. Keep links + journal keyed by `tradePid(p)` so the
trade-drawer link cell and the Journal stay in sync.

**Decided backend = Supabase** (one service for everything we need to write):
Postgres for structured/persistent data, Supabase Storage for image files. Chosen
over Turso/Neon/KV/Blob because it covers BOTH entries and files in one account.
website https://supabase.com · pricing https://supabase.com/pricing

**What goes where:**
- **Postgres** → `plans`, `journal_entries`, and (migrate from the file) the
  `released_archive`. Tables, not blobs.
- **Storage** (S3-compatible, CDN URL) → trade **chart image files**; store only
  the returned **URL** in a Postgres column, never the image bytes in the DB.

**Why this exists:** Vercel's serverless FS is **read-only at runtime**, so the
current file persistence (`data/released-archive.json` + `.cache/`) can't be
written in prod (events enriched in-prod live only in per-instance memory).
Supabase is network-backed → works **identically local + prod**, and unlike the
commit-a-file workaround it's the right home for *user-authored* data (journal).

**Tables (sketch):**
```sql
plans(id, created_at, entry, sl, tp, leverage, thesis, status)        -- planned/taken/invalidated
journal_entries(id, created_at, trade_key, title, body, tags, chart_url)
released_archive(occ_key PRIMARY KEY, info JSONB)                      -- currency|title|date → ReleasedInfo
```

**Integration (fits the repo's security model — same as the Gate API):**
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in env — **server-only**, never client.
- All reads/writes go through `/api/*` server routes; client uses hooks
  (`useJournal`, `usePlans`) that `fetch()` those routes — like `usePositions`.
- Chart upload: `POST /api/journal/[id]/chart` → Supabase Storage (server-side
  key) → save returned URL in the row → `<img src={url}>` in the drawer.
- Migrate `loadArchive`/`saveArchive`/`loadCache` in `lib/event-insight.ts` to
  read/write Supabase when env is set; fall back to the file when it isn't (so
  local dev with no env is unchanged).

**Sizing / plan:** Free tier is plenty on size (500 MB Postgres = 100k+ text
entries; 1 GB Storage = thousands of chart PNGs). The real free ceiling is
**bandwidth (5 GB/mo egress)**, not storage. Start on **Free**; upgrade to **Pro
($25/mo)** when the journal holds data you can't lose — Pro's value is **daily
backups** (Free has NO auto-restore) + no pausing, not size.

**Keepalive cron (lives IN this project):** Free projects **pause after ~7 days
idle**. Prevent it with a daily ping — define it in-repo, no external service:
- `vercel.json` → `{ "crons": [{ "path": "/api/keepalive", "schedule": "0 9 * * *" }] }`
  (Vercel Hobby allows one daily cron).
- `/api/keepalive/route.ts` → one trivial query (`select 1` / fetch a row) to
  reset the inactivity timer. A READ is enough — no write+delete churn.
- NB: keepalive stops pausing but does NOT give backups — that's still the Pro
  argument for "forever" data.

**Open decision:** `journal_entries.trade_key` — link to the closed-position id
(`position-close`) or stand-alone entries? Drives whether the drawer shows an
attached journal note per trade.

**Graceful default:** gate the whole feature on the Supabase env vars; with none
set, hide the plans/journal/upload UI (local dev unaffected), mirroring the app.

### Dev auth bypass — NODE_ENV-guarded, SAFE TO KEEP (not a prod risk)
`DISABLE_AUTH=true` in `.env.local` opens the app (no OAuth/MFA) so the agent can
screenshot/verify locally past the login wall. It is **guarded to dev only** —
the check in both `src/proxy.ts` (`AUTH_DISABLED`) and `src/lib/auth-guard.ts`
(`requireOwner`) is `process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production'`.
- **Local `next dev`** → NODE_ENV=development → bypass works (app unlocked locally).
- **Every Vercel build** (production AND preview) → NODE_ENV=production → bypass
  is **physically inert**, regardless of any env var. So it CANNOT unlock a
  deployment — verified: `prod+DISABLE_AUTH=true → false`.
- It's also not a remote attack surface: env vars aren't settable via HTTP; an
  attacker would need to already own Vercel/GitHub/the machine (game-over anyway).
So this stays in permanently — no "remove before shipping." Do NOT set
`DISABLE_AUTH` in Vercel (belt+suspenders; it'd be inert regardless). The Gate
key is read-only, capping blast radius to visibility even in a worst case.
Local verify: `GET /` → 200, `GET /api/plans` → 200. Prod stays fail-closed.

### Auth — single-user Google OAuth gate ✅ BUILT

The whole app is locked to the **owner only** via Supabase Auth + Google OAuth.
Files:
- `src/proxy.ts` — **the gate** (Next 16 renamed `middleware.ts` → `proxy.ts`,
  Node runtime). Requires a Supabase session AND `user.email === OWNER_EMAIL`;
  else → redirect `/login` (pages) or `401` (`/api/*`). **FAIL CLOSED**: if the
  auth env (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` +
  `OWNER_EMAIL`) is missing/misconfigured, NOBODY is authorized — it never serves
  the dashboard unlocked (and can't be logged into either; that's intended — user
  explicitly chose locked-out over open). No bypass switch — a temporary
  `DISABLE_AUTH` dev toggle existed and was removed; don't reintroduce it. The
  client/ProfileMenu/login still no-op gracefully on missing env so a
  misconfigured deploy redirects to `/login` rather than white-screening.
- `src/lib/supabase/{client,server}.ts` — `@supabase/ssr` browser + server
  clients (publishable key + cookies). `cookies()` is async in Next 16.
- `src/app/login/page.tsx` — **unified "Opening Splash" sign-in** (handoff 39): editorial
  lavender scene (drifting aurora, faint grid, self-drawing purple price curve + pulsing live
  dot), top-right mark + PLAN·EXECUTE·REVIEW, bottom-right Charlie Munger quote, and a left
  **3-step roadmap** on a thread: ① Continue with Google → ② Authenticator code → ③ Your dashboard.
  **It hosts BOTH auth steps** (real, not the handoff mock):
  - **State-adaptive on mount** — reads the live session: no session → step ① active (real
    `signInWithOAuth('google')`); signed-in owner **AAL1 + verified factor** → step ① collapses to
    "Signed in · email ✓" (with the user's **Google avatar** before the email — `user_metadata.avatar_url`,
    `referrerPolicy="no-referrer"`, hide-on-error) and step ② expands into the 6-digit grid wired to
    **real `mfa.challenge` + `mfa.verify`** (auto-verifies on the 6th digit; wrong code rejected
    server-side, NOT "any 6 digits"); on success → step ③ "You're in" with a progress bar that fills
    over **`DONE_MS` = 600ms**, then `router.replace('/')`; AAL1 **no factor** → `/mfa/setup`; **AAL2** → `/`.
  - "Use a different account" + the `?error=unauthorized` not-authorized banner POST to `/auth/signout`.
  - **Quote** = `QUOTES` array, **random pick per page load** (not a timed rotation) — ~34 genuine,
    well-attributed Munger INVESTING/TRADING/MARKETS lines (trimmed where his original ran long, not
    invented; deliberately excludes his general life/temperament quotes).
  - Security UNCHANGED — same Google + real TOTP + owner-only + AAL2 + 24h + fail-closed gate,
    re-checked server-side per request; the splash only unifies the UI. The code step renders only
    for an AAL1 session, so a stranger never sees it.
- `src/app/auth/callback/route.ts` — `exchangeCodeForSession`.
- `src/app/auth/signout/route.ts` — POST → `signOut()` → `/login`.
- `src/components/layout/ProfileMenu.tsx` — Topbar avatar (Google
  `user_metadata.avatar_url`, `referrerPolicy="no-referrer"`, initials
  fallback) → dropdown with name/email + **Sign out**. Replaced the static "AV".
- **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (browser-safe), `OWNER_EMAIL`. Supabase's **new key names**: publishable =
  old anon, **`SUPABASE_SECRET_KEY`** = old service_role (server-only, for the
  DB/storage phase — NOT used by the gate).
- **Provider setup (one-time, in dashboards, not code):** Google Cloud OAuth web
  client → Client ID/Secret into Supabase Auth → Google; Supabase **redirect
  URLs** must include `http://localhost:3000/auth/callback` (+ prod URL); Site
  URL set. Second lock: Supabase → **disable "Allow new users to sign up"** after
  first login (blocks new accounts; the `OWNER_EMAIL` check is the authoritative
  one — Supabase's toggle doesn't gate app access, only account creation).

### 2FA / MFA — TOTP, re-prompt every 24h (built)
On top of Google login the owner must pass a **TOTP** check (authenticator app)
to reach **AAL2**, re-prompted every **24h** (`MFA_MAX_AGE_S = 24*3600`, defined
in BOTH `proxy.ts` and `auth-guard.ts` — keep them equal).
- **Enforcement:** the proxy decodes the session JWT (`aal` + `amr[].timestamp`);
  `mfaOk = aal==='aal2' && newest TOTP amr < 24h`. Owner-but-not-`mfaOk` → **`/login`**
  (the unified splash hosts the code step now — handoff 39) / `401 {mfa_required}` (api).
  `requireOwner()` re-checks the same on every `/api/gate/*` (defense in depth). Decode is
  safe — `getUser()` validated the JWT first; `getSession()` is just for the claims.
- **Pages:** the 24h re-prompt + first-login code step live on **`/login`** (the splash,
  see above). `src/app/mfa/page.tsx` is now just a `redirect('/login')`. `/mfa/setup` —
  one-time enroll (`mfa.enroll` totp → QR + secret → `challenge`+`verify`, uses
  `components/auth/AuthCard.tsx`); setup clears abandoned unverified factors before enrolling.
- **Flow:** Google callback (`exchangeCodeForSession`) → session AAL1 → proxy sends to
  **`/login`**, which detects AAL1 → shows the code step (real `mfa.verify`) → AAL2 → dashboard.
  No factor → `/mfa/setup` → enroll → AAL2. Verifying refreshes the TOTP timestamp (24h window).
- **Needs Supabase MFA/TOTP enabled** in the project (Authentication settings;
  on by default). QR is a `data:` URI — already allowed by the CSP `img-src`.

### Security hardening (built)
- **Defense in depth on the API:** the proxy gate is "optimistic" (Next's own
  caveat), so every `/api/gate/*` route also calls **`requireOwner()`**
  (`lib/auth-guard.ts`) — re-verifies the session + `OWNER_EMAIL` server-side and
  401s otherwise. **Fail closed** — if auth env is unset it 401s too (never opens).
- **Security headers** (`next.config.ts` `headers()`): CSP, HSTS,
  `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`. The **CSP** is tuned to the app's real
  sources (inline styles → `'unsafe-inline'`; Next bootstrap scripts; Google
  avatars `*.googleusercontent.com`; Supabase `*.supabase.co`; self-hosted
  `next/font`). Dev adds `'unsafe-eval'` + `ws://localhost:*` for Fast Refresh.
  If you add a new external source (image host, API, font CDN), widen the CSP or
  it'll be blocked.
- **Account security is the real perimeter:** login is Google, so 2FA/passkey on
  the owner's Google (+ Supabase/Vercel/GitHub) accounts matters most (done).
- **Backstop:** the Gate API key is read-only (no trade/withdraw), so even a full
  breach can't move funds — never grant it trade/withdraw permission.
