# Trading Dashboard

A personal trading dashboard for Gate.io BTC/USDT perpetual futures. Displays live account balance, open positions, closed trade history, and performance analytics — all fetched read-only from the Gate.io Futures API.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui
- **SWR** for data fetching with auto-refresh
- **Gate.io Futures API v4** — HMAC-SHA512 signed, server-side only

## Features

- Live account balance with unrealized PnL badge
- Milestone tracker toward $10M
- Account equity chart (up to 180 days)
- Open positions table with allocation bars and row hover
- KPI strip: net P&L, win rate, profit factor, Sharpe ratio, max drawdown, avg R:R — each with a mini sparkline
- Highlight cards: best month, win streak, most traded, avg daily P&L
- Closed trade history paginated with color-coded outcome cards
- Key metrics: win rate donut, best/worst trade, risk profile (Sortino, volatility, expectancy)

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

**Never commit `.env.local`.** API keys are only used in Next.js server-side API routes and are never exposed to the browser.

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `GATE_API_KEY` and `GATE_API_SECRET` under **Settings → Environment Variables**
4. Deploy — every push to `main` redeploys automatically

## Security

All Gate.io API calls go through Next.js API routes (`/api/gate/*`). The browser never touches the Gate.io API directly or sees the API credentials.
