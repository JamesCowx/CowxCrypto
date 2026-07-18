const fetch = require('node-fetch');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const MIN_REQUEST_INTERVAL = 4000;
let lastRequestTime = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestTime = Date.now();
  const res = await fetch(url, { timeout: 15000 });
  if (res.status === 429) {
    lastRequestTime = Date.now() + 60000;
    throw new Error('Rate limited by CoinGecko');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getTopCoins(limit = 50) {
  const data = await rateLimitedFetch(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d`
  );
  return data.map(coin => ({
    id: coin.id, symbol: coin.symbol, name: coin.name, image: coin.image,
    current_price: coin.current_price, market_cap: coin.market_cap,
    market_cap_rank: coin.market_cap_rank, total_volume: coin.total_volume,
    price_change_1h: coin.price_change_percentage_1h_in_currency,
    price_change_24h: coin.price_change_percentage_24h_in_currency,
    price_change_7d: coin.price_change_percentage_7d_in_currency,
    sparkline: coin.sparkline_in_7d?.price,
    ath: coin.ath, ath_change_percentage: coin.ath_change_percentage,
    circulating_supply: coin.circulating_supply,
  }));
}

async function getTrendingCoins() {
  const data = await rateLimitedFetch(`${COINGECKO_BASE}/search/trending`);
  return data.coins.slice(0, 10).map(c => ({
    id: c.item.id, name: c.item.name, symbol: c.item.symbol,
    market_cap_rank: c.item.market_cap_rank, score: c.item.score,
  }));
}

async function getGlobalData() {
  const data = await rateLimitedFetch(`${COINGECKO_BASE}/global`);
  const d = data.data;
  return {
    active_cryptocurrencies: d.active_cryptocurrencies,
    total_market_cap: d.total_market_cap?.usd || 0,
    total_volume: d.total_volume?.usd || 0,
    market_cap_percentage: d.market_cap_percentage,
    market_cap_change_percentage_24h: d.market_cap_change_percentage_24h_usd || 0,
  };
}

async function getSimplePrices(ids) {
  if (!ids || ids.length === 0) return {};
  const data = await rateLimitedFetch(
    `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
  );
  return data;
}

module.exports = { getTopCoins, getTrendingCoins, getGlobalData, getSimplePrices };
