const fetch = require('node-fetch');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINCAP_BASE = 'https://api.coincap.io/v2';
const MIN_REQUEST_INTERVAL = 4000;
let lastRequestTime = 0;
let usingCoinCap = false;
let coinCapSwitchTime = 0;
const COINCAP_COOLDOWN = 300000;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestTime = Date.now();
  const res = await fetch(url, { timeout: 15000 });
  if (res.status === 429) {
    lastRequestTime = Date.now() + 60000;
    usingCoinCap = true;
    coinCapSwitchTime = Date.now();
    throw new Error('Rate limited by CoinGecko');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function generateSyntheticSparkline(currentPrice, change24h) {
  if (!currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) return null;
  const points = 168;
  let changeFraction = change24h != null ? change24h / 100 : 0;
  changeFraction = Math.max(-0.95, Math.min(0.95, changeFraction));
  const startPrice = currentPrice / (1 + changeFraction);
  if (!isFinite(startPrice) || startPrice <= 0) return null;
  let drift = changeFraction / points;
  const vol = Math.abs(changeFraction) * 0.3 + 0.002;
  let price = startPrice;
  const sparkline = [];
  for (let i = 0; i < points; i++) {
    const noise = (Math.random() - 0.5) * vol * price;
    const trend = drift * price;
    price = price + trend + noise;
    if (!isFinite(price) || price < 0) price = 0.0001;
    sparkline.push(price);
  }
  const lastVal = sparkline[sparkline.length - 1];
  if (lastVal !== currentPrice && isFinite(lastVal) && lastVal > 0) {
    const ratio = currentPrice / lastVal;
    if (isFinite(ratio) && ratio > 0) {
      for (let i = 0; i < sparkline.length; i++) {
        sparkline[i] *= Math.pow(ratio, i / (sparkline.length - 1));
      }
    }
  }
  const allFinite = sparkline.every(v => isFinite(v));
  return allFinite ? sparkline : null;
}

async function tryCoinGecko(action) {
  if (usingCoinCap) {
    if (Date.now() - coinCapSwitchTime > COINCAP_COOLDOWN) {
      usingCoinCap = false;
    } else {
      throw new Error('Using CoinCap fallback');
    }
  }
  try {
    return await action();
  } catch (err) {
    if (err.message === 'Rate limited by CoinGecko') {
      throw err;
    }
    if (!usingCoinCap) {
      usingCoinCap = true;
      coinCapSwitchTime = Date.now();
    }
    throw err;
  }
}

function coinCapToCoin(c) {
  return {
    id: c.id, symbol: c.symbol.toLowerCase(), name: c.name, image: null,
    current_price: parseFloat(c.priceUsd) || 0,
    market_cap: parseFloat(c.marketCapUsd) || 0,
    market_cap_rank: parseInt(c.rank) || 999,
    total_volume: parseFloat(c.volumeUsd24Hr) || 0,
    price_change_1h: null,
    price_change_24h: parseFloat(c.changePercent24Hr) || 0,
    price_change_7d: null,
    sparkline: null,
    ath: null, ath_change_percentage: null,
    circulating_supply: parseFloat(c.supply) || 0,
  };
}

async function getTopCoins(limit = 50) {
  return await tryCoinGecko(async () => {
    const raw = await rateLimitedFetch(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d`
    );
    if (!Array.isArray(raw)) throw new Error('Invalid CoinGecko response');
    return raw.map(coin => ({
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
  }).catch(async () => {
    const coinCapRes = await fetch(`${COINCAP_BASE}/assets?limit=${Math.min(limit, 100)}`, { timeout: 20000 });
    if (!coinCapRes.ok) throw new Error(`CoinCap HTTP ${coinCapRes.status}`);
    const body = await coinCapRes.json();
    const list = Array.isArray(body?.data) ? body.data : [];
    if (!list.length) throw new Error('CoinCap empty data');
    return list.map(c => {
      const coin = coinCapToCoin(c);
      coin.image = `https://assets.coincap.io/assets/icons/${(c.symbol||'').toLowerCase()}@2x.png`;
      coin.price_change_7d = null;
      coin.sparkline = generateSyntheticSparkline(coin.current_price, coin.price_change_24h);
      return coin;
    });
  });
}

async function getTrendingCoins() {
  try {
    const raw = await rateLimitedFetch(`${COINGECKO_BASE}/search/trending`);
    const coins = Array.isArray(raw?.coins) ? raw.coins : [];
    return coins.slice(0, 12).map(c => ({
      id: c.item.id, name: c.item.name, symbol: c.item.symbol,
      market_cap_rank: c.item.market_cap_rank, score: c.item.score,
    }));
  } catch (err) {
    if (usingCoinCap) {
      const coinCapRes = await fetch(`${COINCAP_BASE}/assets?limit=12`, { timeout: 20000 });
      if (!coinCapRes.ok) return [];
      const body = await coinCapRes.json();
      const list = Array.isArray(body?.data) ? body.data : [];
      return list.map((c, i) => ({
        id: c.id, name: c.name, symbol: c.symbol,
        market_cap_rank: parseInt(c.rank) || i + 1, score: list.length - i,
      }));
    }
    throw err;
  }
}

async function getGlobalData() {
  return await tryCoinGecko(async () => {
    const raw = await rateLimitedFetch(`${COINGECKO_BASE}/global`);
    const d = raw?.data;
    if (!d) throw new Error('Invalid CoinGecko global response');
    return {
      active_cryptocurrencies: d.active_cryptocurrencies || 0,
      total_market_cap: d.total_market_cap?.usd || 0,
      total_volume: d.total_volume?.usd || 0,
      market_cap_percentage: d.market_cap_percentage || {},
      market_cap_change_percentage_24h: d.market_cap_change_percentage_24h_usd || null,
    };
  }).catch(async () => {
    const coinCapRes = await fetch(`${COINCAP_BASE}/assets?limit=100`, { timeout: 20000 });
    if (!coinCapRes.ok) throw new Error(`CoinCap HTTP ${coinCapRes.status}`);
    const body = await coinCapRes.json();
    const list = Array.isArray(body?.data) ? body.data : [];
    if (!list.length) throw new Error('CoinCap empty data for global');
    let totalVolume = 0, totalMcap = 0;
    let btcMcap = 0, ethMcap = 0, usdtMcap = 0, bnbMcap = 0;
    for (const c of list) {
      const mcap = parseFloat(c.marketCapUsd) || 0;
      totalMcap += mcap;
      totalVolume += parseFloat(c.volumeUsd24Hr) || 0;
      if (c.id === 'bitcoin') btcMcap = mcap;
      if (c.id === 'ethereum') ethMcap = mcap;
      if (c.id === 'tether') usdtMcap = mcap;
      if (c.id === 'binance-coin') bnbMcap = mcap;
    }
    return {
      active_cryptocurrencies: list.length,
      total_market_cap: totalMcap || 0,
      total_volume: totalVolume || 0,
      market_cap_percentage: {
        btc: totalMcap > 0 ? (btcMcap / totalMcap) * 100 : 0,
        eth: totalMcap > 0 ? (ethMcap / totalMcap) * 100 : 0,
        usdt: totalMcap > 0 ? (usdtMcap / totalMcap) * 100 : 0,
        bnb: totalMcap > 0 ? (bnbMcap / totalMcap) * 100 : 0,
      },
      market_cap_change_percentage_24h: null,
    };
  });
}

async function getSimplePrices(ids) {
  if (!ids || ids.length === 0) return {};
  try {
    return await tryCoinGecko(async () => {
      const raw = await rateLimitedFetch(
        `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );
      return raw || {};
    });
  } catch {
    const result = {};
    try {
      const coinCapRes = await fetch(`${COINCAP_BASE}/assets?limit=2000`, { timeout: 20000 });
      if (coinCapRes.ok) {
        const body = await coinCapRes.json();
        const allAssets = Array.isArray(body?.data) ? body.data : [];
        for (const id of ids) {
          const match = allAssets.find(a =>
            a.id === id ||
            a.symbol.toLowerCase() === id.toLowerCase() ||
            a.name.toLowerCase() === id.replace(/-/g, ' ')
          );
          if (match) {
            result[id] = {
              usd: parseFloat(match.priceUsd) || 0,
              usd_24h_change: parseFloat(match.changePercent24Hr) || 0,
            };
          }
        }
      }
    } catch {}
    return result;
  }
}

function isUsingCoinCap() { return usingCoinCap; }

module.exports = { getTopCoins, getTrendingCoins, getGlobalData, getSimplePrices, isUsingCoinCap };
