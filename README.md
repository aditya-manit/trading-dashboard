# Trading Dashboard

A personal trading dashboard for Gate.io BTC/USDT perpetual futures. Displays live account balance, open positions, closed trade history, and performance analytics — all fetched read-only from the Gate.io Futures API. A top-level **Dashboard / Plan** toggle switches between the analytics dashboard and a pre-trade workbook.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui
- **SWR** — client-side data fetching with 30s auto-refresh
- **Gate.io Futures API v4** — HMAC-SHA512 signed, all calls server-side only

## Features

### Overview
- Hero card: live account balance, unrealized PnL badge, margin usage, open position count
- Milestone progress tracker toward $10M with a slide-out drawer showing all milestones and proportional bar widths
- Account equity chart: up to 180 days, green/red based on period direction, range picker (1M/3M/6M/1Y/ALL), hover crosshair tooltip
- Highlight cards: best month P&L, best win streak, most traded instrument, avg daily P&L (trailing 90d)
- KPI strip: net P&L, win rate, profit factor, Sharpe ratio, max drawdown, avg R:R — each tile includes a mini trend sparkline

### Positions
- Open positions table with allocation bars, unrealized PnL, hover highlight
- **Details drawer** per position: uPnL hero + ROE% since entry, direction, leverage, size in BTC, notional value, margin used, entry/mark/liquidation price, hold duration

### Reports
- Win rate donut with wins/losses/total breakdown and a win/loss split bar
- Best & worst trade cards (side / leverage / return / P&L) — click to open the trade detail drawer
- Risk & efficiency: Max Drawdown area chart, Sortino/Sharpe/Calmar gauges, risk of ruin, annualised volatility

### History
- Two views: **calendar** (default) — per-day P&L cells with a live month summary bar (net P&L, trade count, win/loss split) — and **gallery** — color-coded closed-trade cards with leverage badge and return on margin %
- **Details drawer** per trade: realized PnL hero, return on margin, direction, leverage, position size, notional, entry/exit price, trading fees, hold duration

### Plan (pre-trade workbook)
- A 5-step routine to vet a setup before entry: levels → trend → confirmation → stop → liquidity, each with an animated diagram, a one-line rule, and pre-flight checks
- Each step gates the next — you can only advance once its checks are cleared; progress and checks persist in localStorage
- Sample market-news strip (high-impact economic events) with a slide-out calendar drawer

## API Routes

All Gate.io calls are proxied through Next.js server-side routes — credentials never reach the browser.

| Route | Gate.io endpoint |
|---|---|
| `/api/gate/account` | `GET /futures/usdt/accounts` |
| `/api/gate/positions` | `GET /futures/usdt/positions` |
| `/api/gate/position-history` | `GET /futures/usdt/position_close` (180-day window, paginated) |
| `/api/gate/account-book` | `GET /futures/usdt/account_book?type=pnl` (6×30d windows) |
| `/api/gate/trades` | `GET /futures/usdt/my_trades` |

## Contract Maths

Gate.io BTC_USDT perpetual: **1 contract = 0.0001 BTC**

- `notional (USDT) = contracts × 0.0001 × price`
- `return on margin = PnL ÷ (notional ÷ leverage)`

## Setup

1. Clone and install:
   ```bash
   git clone git@github.com:aditya-manit/trading-dashboard.git
   cd trading-dashboard
   npm install
   ```

2. Create `.env.local` in the project root:
   ```
   GATE_API_KEY=your_api_key
   GATE_API_SECRET=your_api_secret
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `GATE_API_KEY` | Gate.io API key (read-only permissions sufficient) |
| `GATE_API_SECRET` | Gate.io API secret |

**Never commit `.env.local`.** It is gitignored by default.

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `GATE_API_KEY` and `GATE_API_SECRET` under **Settings → Environment Variables**
4. Deploy — every push to `main` redeploys automatically

## Security

All Gate.io API calls go through Next.js API routes (`/api/gate/*`). The browser never touches the Gate.io API directly or sees the raw credentials.
