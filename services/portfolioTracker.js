const { calculateRSI } = require('./signalEngine');

const WHALE_WALLETS = [
  { name: 'Mega Whale Fund', strategy: 'momentum', risk: 'moderate' },
  { name: 'Alpha Quant LP', strategy: 'momentum', risk: 'high' },
  { name: 'Crypto Valley VC', strategy: 'growth', risk: 'moderate' },
  { name: 'Smart Money DAO', strategy: 'value', risk: 'low' },
  { name: 'DeFi Whale Alliance', strategy: 'yield', risk: 'moderate' },
  { name: 'Arbitrage King Fund', strategy: 'momentum', risk: 'high' },
  { name: 'Satellite Portfolio', strategy: 'value', risk: 'low' },
  { name: 'Whale Shark Capital', strategy: 'growth', risk: 'high' },
];

function determineAction(priceChange24h, priceChange7d, rsi, strategy) {
  let action = 'hold', confidence = 0, reason = '';
  if (strategy === 'momentum') {
    if (priceChange24h > 4 && rsi < 60) { action = 'buy'; confidence = 0.75; reason = 'Momentum building'; }
    else if (priceChange24h > 0 && priceChange7d > 8 && rsi < 55) { action = 'buy'; confidence = 0.7; reason = 'Uptrend momentum'; }
    else if (priceChange24h < -3 && rsi > 60) { action = 'sell'; confidence = 0.65; reason = 'Momentum fading'; }
  } else if (strategy === 'value') {
    if (priceChange7d < -5 && rsi < 40) { action = 'buy'; confidence = 0.8; reason = 'Oversold value'; }
    else if (priceChange24h > 5 && priceChange7d > 10 && rsi > 60) { action = 'sell'; confidence = 0.7; reason = 'Value profit take'; }
    else if (priceChange7d < -2 && rsi < 45) { action = 'buy'; confidence = 0.6; reason = 'Dip accumulation'; }
  } else if (strategy === 'growth') {
    if (priceChange24h > 2 && priceChange7d > 5 && rsi < 60) { action = 'buy'; confidence = 0.7; reason = 'Growth continuing'; }
    else if (priceChange7d > 15 && rsi > 65) { action = 'sell'; confidence = 0.65; reason = 'Growth profit take'; }
  } else if (strategy === 'yield') {
    if (priceChange7d < -3 && rsi < 45) { action = 'buy'; confidence = 0.65; reason = 'Yield on dip'; }
    else if (priceChange24h > 6 && rsi > 60) { action = 'sell'; confidence = 0.6; reason = 'Yield harvest'; }
  }
  return { action, confidence, reason };
}

function simulateHoldings(topCoins) {
  const valid = topCoins.filter(c => c && c.current_price > 0);
  if (!valid.length) return { holdings: [], totalValue: 0, pnl24h: 0, pnl7d: 0 };
  const numHoldings = Math.min(valid.length, 4 + Math.floor(Math.random() * 4));
  const shuffled = [...valid].sort(() => Math.random() - 0.5);
  const holdings = shuffled.slice(0, numHoldings).map(coin => {
    const allocated = Math.random() * 800000 + 50000;
    return {
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      amount: allocated / coin.current_price,
      valueUsd: allocated,
      allocation: 0,
    };
  });
  const totalValue = holdings.reduce((sum, h) => sum + h.valueUsd, 0) || 1;
  holdings.forEach(h => { h.allocation = (h.valueUsd / totalValue) * 100; });
  holdings.sort((a, b) => b.allocation - a.allocation);
  const pnl = (Math.random() - 0.35) * 50;
  return { holdings, totalValue, pnl24h: pnl, pnl7d: pnl * 4 };
}

function getWhaleTrades(portfolios, topCoins) {
  const trades = [];
  for (const p of portfolios) {
    const wallet = WHALE_WALLETS.find(w => w.name === p.name);
    if (!wallet) continue;
    for (const holding of p.holdings) {
      const coin = topCoins.find(c => c.id === holding.coinId);
      if (!coin) continue;
      const priceChange24h = coin.price_change_24h || 0;
      const priceChange7d = coin.price_change_7d || 0;
      const rsi = calculateRSI(coin.sparkline);
      const { action, confidence, reason } = determineAction(priceChange24h, priceChange7d, rsi, wallet.strategy);
      if (action !== 'hold') {
        trades.push({
          walletName: wallet.name,
          strategy: wallet.strategy,
          coinId: holding.coinId,
          coinName: holding.name,
          coinSymbol: holding.symbol,
          action,
          confidence: Math.round(confidence * 100),
          reason,
          priceAtSignal: coin.current_price,
          allocationPercent: holding.allocation,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
  return trades;
}

function getWhalePortfolios(topCoins) {
  const portfolios = WHALE_WALLETS.map(w => {
    const data = simulateHoldings(topCoins);
    return {
      id: w.name.toLowerCase().replace(/\s+/g, '_'),
      name: w.name,
      strategy: w.strategy,
      risk: w.risk,
      totalValue: data.totalValue,
      pnl24h: data.pnl24h,
      pnl7d: data.pnl7d,
      holdings: data.holdings,
      lastUpdate: new Date().toISOString(),
    };
  });
  portfolios.sort((a, b) => b.totalValue - a.totalValue);
  return portfolios;
}

module.exports = { getWhalePortfolios, getWhaleTrades, WHALE_WALLETS };
