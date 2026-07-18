# CowxCrypto — Live Market Intelligence

Real-time cryptocurrency market dashboard with AI-powered buy/sell signals, whale portfolio tracking, and technical analysis.

## Features

- **Live Signals** — RSI, MACD, volatility, and trend analysis generate buy/sell signals with confidence scores, hold duration, stop-loss, and take-profit levels
- **Whale Tracking** — 8 simulated strategy-driven whale wallets (momentum, value, growth, yield) executing trades and showing real-time P&L and allocation
- **Market Overview** — Top 100 coins, trending, gainers/losers, BTC dominance bar, and global market metrics (mcap, volume, dominance)
- **Premium UI** — Dark glassmorphism theme with animated canvas particles, gradient glow effects, sparkline SVGs, skeleton loading, and fade-up animations

## Tech Stack

- **Backend** — Node.js, Express
- **Data** — CoinGecko free API (4s rate-limited, auto-retry on 429)
- **Frontend** — Vanilla JS, CSS3 (no frameworks)

## Local Dev

```bash
npm install
npm start
```

Opens at `http://localhost:3001`.

## Deploy (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect repo
3. Set start command: `node server.js`
4. Deploy — no other config needed
