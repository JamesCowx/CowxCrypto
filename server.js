const express = require('express');
const path = require('path');
const marketService = require('./services/marketService');
const { generateSignals } = require('./services/signalEngine');
const { getWhalePortfolios, getWhaleTrades } = require('./services/portfolioTracker');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const EMPTY_CACHE = {
  topCoins: [], trending: [], global: {
    active_cryptocurrencies: 0, total_market_cap: 0, total_volume: 0,
    market_cap_percentage: {}, market_cap_change_percentage_24h: null,
  }, signals: [], portfolios: [], trades: [],
};

let cachedData = { ...EMPTY_CACHE };
let cacheTimestamp = Date.now();
const CACHE_TTL = 180000;
let rateLimited = false;
let refreshing = false;
let cacheReady = false;

function incorporateWhaleSignals(signals, trades) {
  for (const signal of signals) {
    const whaleBuys = trades.filter(w => w.coinId === signal.coinId && w.action === 'buy');
    const whaleSells = trades.filter(w => w.coinId === signal.coinId && w.action === 'sell');
    if (whaleBuys.length > 0) {
      signal.signalStrength += 2;
      if (!signal.reasons.includes(`${whaleBuys.length} whale(s) buying`)) {
        signal.reasons.push(`${whaleBuys.length} whale(s) buying`);
      }
      if (signal.signalStrength >= 3) signal.signalType = 'strong_buy';
      else if (signal.signalStrength >= 1) signal.signalType = 'buy';
      if (signal.estimatedReturn != null && signal.estimatedReturn > 0) {
        signal.estimatedReturn = Math.min(25, signal.estimatedReturn + 1);
      }
      signal.confidence = Math.min(95, (signal.confidence || 50) + 5);
    }
    if (whaleSells.length > 0) {
      signal.signalStrength -= 2;
      if (!signal.reasons.includes(`${whaleSells.length} whale(s) selling`)) {
        signal.reasons.push(`${whaleSells.length} whale(s) selling`);
      }
      if (signal.signalStrength <= -2) signal.signalType = 'sell';
      else if (signal.signalStrength <= -1) signal.signalType = 'weak_sell';
      signal.confidence = Math.min(90, (signal.confidence || 50) + 5);
    }
  }
  signals.sort((a, b) => b.signalStrength - a.signalStrength);
  return signals;
}

async function refreshCache(isRetry = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    let topCoins = [], trending = [], global = null, signals = [], portfolios = [], trades = [];

    try { topCoins = await marketService.getTopCoins(100); } catch (e) { console.error('topCoins fail:', e.message); }
    if (!topCoins.length) { throw new Error('No coin data from any provider'); }

    const top30 = topCoins.slice(0, 30);
    try { signals = generateSignals(top30); } catch (e) { console.error('signals fail:', e.message); }
    try { portfolios = getWhalePortfolios(top30); } catch (e) { console.error('portfolios fail:', e.message); }
    try { trades = getWhaleTrades(portfolios, top30); } catch (e) { console.error('trades fail:', e.message); }

    if (signals.length) {
      try { signals = incorporateWhaleSignals(signals, trades); } catch (e) { console.error('whale signals fail:', e.message); }
    }

    try { trending = await marketService.getTrendingCoins(); } catch (e) { console.error('trending fail:', e.message); }
    try { global = await marketService.getGlobalData(); } catch (e) { console.error('global fail:', e.message); }

    const enrichedTrending = trending.map(t => {
      let match = topCoins.find(c => c.id === t.id);
      if (!match) match = topCoins.find(c => c.symbol.toLowerCase() === (t.symbol || '').toLowerCase());
      if (!match) match = topCoins.find(c => c.name?.toLowerCase() === (t.name || '').toLowerCase());
      if (match) {
        return { ...t, price: match.current_price, change24h: match.price_change_24h, image: match.image };
      }
      if (t.price != null) return { ...t, price: t.price, change24h: t.change24h, image: t.image };
      return { ...t };
    });

    const missingIds = enrichedTrending.filter(t => t.price == null).map(t => t.id).filter(Boolean);
    if (missingIds.length > 0) {
      try {
        const prices = await marketService.getSimplePrices(missingIds);
        for (const t of enrichedTrending) {
          const p = prices[t.id];
          if (t.price == null && p && p.usd != null) {
            t.price = p.usd;
            t.change24h = p.usd_24h_change;
          }
        }
      } catch (_) {}
    }

    cachedData = { topCoins, trending: enrichedTrending, global, signals, portfolios, trades };
    cacheTimestamp = Date.now();
    cacheReady = true;
    rateLimited = false;
    const prov = marketService.isUsingCoinCap() ? 'coincap' : 'coingecko';
    console.log(`[${prov}] Cache OK: ${signals.length} signals, ${portfolios.length} portfolios, ${trades.length} trades`);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (msg.includes('Rate limited')) {
      rateLimited = true;
      console.log('Rate limited - retry in 60s');
      setTimeout(() => refreshCache(true), 60000);
    } else {
      console.error('Cache error:', msg, '- retry in 15s');
      setTimeout(() => refreshCache(true), 15000);
    }
  } finally {
    refreshing = false;
  }
}

app.get('/api/dashboard', (req, res) => {
  if (!cachedData) {
    return res.json({ loading: true, rateLimited, message: 'Initializing...' });
  }
  const sigs = cachedData.signals || [];
  const coins = cachedData.topCoins || [];
  const buys = sigs.filter(s => s.signalType === 'strong_buy' || s.signalType === 'buy').slice(0, 15);
  const sells = sigs.filter(s => s.signalType === 'sell' || s.signalType === 'weak_sell').slice(0, 15);
  const sorted24h = [...coins]
    .filter(c => c.price_change_24h != null)
    .sort((a, b) => (b.price_change_24h || 0) - (a.price_change_24h || 0));
  res.json({
    market: {
      topCoins: coins.slice(0, 50),
      trending: cachedData.trending || [],
      global: cachedData.global || {},
      gainers: sorted24h.slice(0, 5),
      losers: sorted24h.slice(-5).reverse(),
    },
    signals: { buys, sells, all: sigs.slice(0, 30) },
    whales: { portfolios: cachedData.portfolios || [], recentTrades: cachedData.trades || [] },
    updatedAt: new Date(cacheTimestamp).toISOString(),
    rateLimited,
    cacheReady,
    provider: marketService.isUsingCoinCap() ? 'coincap' : 'coingecko',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, cacheReady, rateLimited, updatedAt: new Date(cacheTimestamp).toISOString() });
});

refreshCache();
setInterval(refreshCache, CACHE_TTL);

process.on('uncaughtException', (e) => console.error(e.message));
process.on('unhandledRejection', (e) => console.error(e && e.message ? e.message : e));

const server = app.listen(PORT, () => console.log(`CowxCrypto on http://localhost:${PORT}`));
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} in use. Set PORT env or free the port.`);
    process.exit(1);
  }
  throw err;
});
