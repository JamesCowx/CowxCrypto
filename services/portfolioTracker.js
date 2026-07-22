const { calculateRSI } = require('./signalEngine');

const WHALE_WALLETS = [
  { name: 'Mega Whale Fund', strategy: 'momentum', risk: 'moderate', size: 'large' },
  { name: 'Alpha Quant LP', strategy: 'momentum', risk: 'high', size: 'large' },
  { name: 'Crypto Valley VC', strategy: 'growth', risk: 'moderate', size: 'large' },
  { name: 'Smart Money DAO', strategy: 'value', risk: 'low', size: 'medium' },
  { name: 'DeFi Whale Alliance', strategy: 'yield', risk: 'moderate', size: 'large' },
  { name: 'Arbitrage King Fund', strategy: 'momentum', risk: 'high', size: 'medium' },
  { name: 'Satellite Portfolio', strategy: 'value', risk: 'low', size: 'medium' },
  { name: 'Whale Shark Capital', strategy: 'growth', risk: 'high', size: 'large' },
  { name: 'Institutional Alpha Fund', strategy: 'momentum', risk: 'moderate', size: 'large' },
  { name: 'Deep Value Capital', strategy: 'value', risk: 'moderate', size: 'medium' },
  { name: 'Yield Harvest DAO', strategy: 'yield', risk: 'high', size: 'medium' },
  { name: 'Macro Trend Fund', strategy: 'trend', risk: 'low', size: 'large' },
];

function determineAction(priceChange24h, priceChange7d, rsi, stochRsi, trend, volRatio, strategy) {
  let action = 'hold', confidence = 0, reason = '';
  if (strategy === 'momentum') {
    if (priceChange24h > 5 && rsi < 55 && trend !== 'downtrend') { action = 'buy'; confidence = 0.78; reason = 'Strong momentum building'; }
    else if (priceChange24h > 1 && priceChange7d > 8 && rsi < 55) { action = 'buy'; confidence = 0.72; reason = 'Uptrend momentum'; }
    else if (priceChange24h > 0 && volRatio > 0.1 && rsi < 50) { action = 'buy'; confidence = 0.65; reason = 'Volume-backed momentum'; }
    else if (priceChange24h < -3 && rsi > 60) { action = 'sell'; confidence = 0.68; reason = 'Momentum fading'; }
    else if (priceChange7d < -8 && trend === 'downtrend') { action = 'sell'; confidence = 0.7; reason = 'Momentum reversal'; }
  } else if (strategy === 'value') {
    if (priceChange7d < -8 && rsi < 35) { action = 'buy'; confidence = 0.85; reason = 'Deep value oversold'; }
    else if (priceChange7d < -4 && rsi < 42) { action = 'buy'; confidence = 0.72; reason = 'Value accumulation zone'; }
    else if (priceChange24h > 6 && priceChange7d > 12 && rsi > 60) { action = 'sell'; confidence = 0.72; reason = 'Value profit take'; }
    else if (priceChange7d < -2 && rsi < 45 && volRatio < 0.05) { action = 'buy'; confidence = 0.6; reason = 'Low-volume dip'; }
  } else if (strategy === 'growth') {
    if (priceChange24h > 3 && priceChange7d > 6 && rsi < 58) { action = 'buy'; confidence = 0.72; reason = 'Growth accelerating'; }
    else if (priceChange7d > 20 && rsi > 65) { action = 'sell'; confidence = 0.68; reason = 'Growth profit take'; }
    else if (priceChange24h < -2 && priceChange7d < -5 && rsi < 40) { action = 'buy'; confidence = 0.65; reason = 'Growth dip buy'; }
  } else if (strategy === 'yield') {
    if (priceChange7d < -4 && rsi < 42) { action = 'buy'; confidence = 0.68; reason = 'Yield on dip'; }
    else if (priceChange24h > 7 && rsi > 62) { action = 'sell'; confidence = 0.62; reason = 'Yield harvest'; }
    else if (volRatio > 0.08 && priceChange24h > 0.5) { action = 'buy'; confidence = 0.55; reason = 'Yield volume play'; }
  } else if (strategy === 'trend') {
    if (trend === 'uptrend' && rsi < 55 && priceChange24h > 0) { action = 'buy'; confidence = 0.75; reason = 'Following uptrend'; }
    else if (trend === 'uptrend' && priceChange7d > 4 && rsi < 60) { action = 'buy'; confidence = 0.7; reason = 'Trend continuation'; }
    else if (trend === 'downtrend' && priceChange24h < 0) { action = 'sell'; confidence = 0.7; reason = 'Downtrend exit'; }
    else if (trend === 'downtrend' && rsi > 60) { action = 'sell'; confidence = 0.72; reason = 'Trend reversal signal'; }
  }
  return { action, confidence, reason };
}

function simulateHoldings(topCoins, walletSize) {
  const valid = topCoins.filter(c => c && c.current_price > 0);
  if (!valid.length) return { holdings: [], totalValue: 0, pnl24h: 0, pnl7d: 0 };
  const multiplier = walletSize === 'large' ? 3 : walletSize === 'medium' ? 2 : 1;
  const numHoldings = Math.min(valid.length, 4 + Math.floor(Math.random() * 5));
  const shuffled = [...valid].sort(() => Math.random() - 0.5);
  const holdings = shuffled.slice(0, numHoldings).map(coin => {
    const allocated = (Math.random() * 800000 + 50000) * multiplier;
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
      const prices = coin.sparkline || [];
      const trends = [];
      for (let i = 3; i < prices.length; i++) trends.push(prices[i] - prices[i - 3]);
      const trend = trends.filter(t => t > 0).length > trends.length * 0.55 ? 'uptrend'
        : trends.filter(t => t < 0).length > trends.length * 0.55 ? 'downtrend' : 'sideways';
      const volRatio = coin.total_volume && coin.market_cap ? coin.total_volume / coin.market_cap : 0;
      const { action, confidence, reason } = determineAction(
        priceChange24h, priceChange7d, rsi, null, trend, volRatio, wallet.strategy
      );
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
    const data = simulateHoldings(topCoins, w.size);
    return {
      id: w.name.toLowerCase().replace(/\s+/g, '_'),
      name: w.name,
      strategy: w.strategy,
      risk: w.risk,
      size: w.size,
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
