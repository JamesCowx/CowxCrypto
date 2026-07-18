function calculateRSI(prices) {
  if (!prices || prices.length < 15) return 50;
  const changes = [];
  for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
  let avgGain = 0, avgLoss = 0;
  const period = 14;
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) avgGain += changes[i]; else avgLoss -= changes[i];
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] >= 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? -changes[i] : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateMACD(prices) {
  if (!prices || prices.length < 26) return null;
  const k12 = 2 / 13, k26 = 2 / 27;
  let ema12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let ema26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 12; i < prices.length; i++) ema12 = prices[i] * k12 + ema12 * (1 - k12);
  for (let i = 26; i < prices.length; i++) ema26 = prices[i] * k26 + ema26 * (1 - k26);
  return ema12 - ema26;
}

function calcVolatility(prices) {
  if (!prices || prices.length < 10) return null;
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  if (!returns.length) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

function calcSupportResistance(prices) {
  if (!prices || prices.length < 20) return { support: null, resistance: null };
  const recent = prices.slice(-10);
  return {
    support: Math.min(...recent),
    resistance: Math.max(...recent),
  };
}

function calcTrend(prices) {
  if (!prices || prices.length < 20) return 'sideways';
  const short = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const medium = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (short > medium * 1.02) return 'uptrend';
  if (short < medium * 0.98) return 'downtrend';
  return 'sideways';
}

function roundPrice(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 1000) / 1000;
  if (n >= 0.01) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1e6) / 1e6;
}

function generateSignals(topCoins) {
  const signals = [];
  for (const coin of topCoins) {
    if (!coin || !coin.current_price) continue;
    const prices = coin.sparkline;
    const rsi = calculateRSI(prices);
    const macd = calculateMACD(prices);
    const volatility = calcVolatility(prices);
    const sr = calcSupportResistance(prices);
    const trend = calcTrend(prices);
    let signalType = 'neutral';
    let signalStrength = 0;
    const reasons = [];
    const p24 = coin.price_change_24h;

    if (p24 !== null && p24 !== undefined && !isNaN(p24)) {
      if (p24 < -5) { signalStrength += 2; reasons.push(`24h drop ${p24.toFixed(1)}%`); }
      else if (p24 > 15) { signalStrength -= 1; reasons.push(`24h surge ${p24.toFixed(1)}%`); }
    }
    if (rsi < 30) { signalStrength += 3; reasons.push(`RSI ${rsi.toFixed(1)} oversold`); }
    else if (rsi > 70) { signalStrength -= 2; reasons.push(`RSI ${rsi.toFixed(1)} overbought`); }
    if (macd !== null) {
      signalStrength += macd > 0 ? 1 : -1;
      reasons.push(macd > 0 ? 'MACD bullish' : 'MACD bearish');
    }
    if (coin.total_volume && coin.market_cap && coin.market_cap > 0) {
      const vmr = coin.total_volume / coin.market_cap;
      if (vmr > 0.2) { signalStrength += 1; reasons.push('High volume ratio'); }
    }
    if (trend === 'uptrend') { signalStrength += 1; reasons.push('Uptrend'); }
    else if (trend === 'downtrend') { signalStrength -= 1; reasons.push('Downtrend'); }

    if (signalStrength >= 3) signalType = 'strong_buy';
    else if (signalStrength >= 1) signalType = 'buy';
    else if (signalStrength <= -2) signalType = 'sell';
    else if (signalStrength <= -1) signalType = 'weak_sell';

    let holdDuration = '-';
    let estimatedReturn = null;
    let confidence = 50;
    if (signalType === 'strong_buy' || signalType === 'buy') {
      const base = signalType === 'strong_buy' ? 12 : 7;
      const rb = rsi < 20 ? 5 : rsi < 30 ? 3 : rsi < 40 ? 1 : 0;
      const db = p24 != null && p24 < -5 ? 3 : p24 != null && p24 < -2 ? 1 : 0;
      const mb = macd != null && macd > 0 ? 1 : 0;
      const tb = trend === 'uptrend' ? 1 : 0;
      estimatedReturn = Math.min(25, Math.round((base + rb + db + mb + tb) * 10) / 10);
      holdDuration = rsi < 20 ? '10-14 days' : rsi < 30 ? '7-10 days' : rsi < 40 ? '5-7 days' : '3-5 days';
      confidence = Math.min(95, 55 + Math.round(signalStrength * 7));
    } else if (signalType === 'sell' || signalType === 'weak_sell') {
      const rp = rsi > 70 ? 6 : rsi > 60 ? 3 : 1;
      const sp = p24 != null && p24 > 10 ? 4 : p24 != null && p24 > 5 ? 2 : 0;
      estimatedReturn = -Math.min(15, Math.round((rp + sp) * 10) / 10);
      holdDuration = signalType === 'sell' ? 'Sell now' : 'Sell in 1-2 days';
      confidence = Math.min(90, 50 + Math.round(Math.abs(signalStrength) * 8));
    } else {
      confidence = 30 + Math.round(Math.abs(signalStrength) * 5);
    }

    const currentPrice = coin.current_price;
    let stopLoss = sr.support != null && sr.support < currentPrice
      ? sr.support * 0.98
      : currentPrice * 0.92;
    let takeProfit = sr.resistance != null && sr.resistance > currentPrice
      ? sr.resistance * 1.02
      : currentPrice * (1 + (estimatedReturn != null ? Math.abs(estimatedReturn) : 5) / 100);
    if (signalType === 'sell' || signalType === 'weak_sell') {
      takeProfit = currentPrice * 0.95;
      stopLoss = currentPrice * 1.05;
    }

    signals.push({
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      currentPrice,
      priceChange24h: coin.price_change_24h,
      priceChange7d: coin.price_change_7d,
      marketCapRank: coin.market_cap_rank,
      signalType,
      signalStrength,
      rsi: Math.round(rsi * 10) / 10,
      reasons: reasons.slice(0, 5),
      sparkline: prices || null,
      holdDuration,
      estimatedReturn,
      confidence,
      stopLoss: roundPrice(stopLoss),
      takeProfit: roundPrice(takeProfit),
      trend,
      volatility: volatility != null ? Math.round(volatility * 100) / 100 : null,
      updatedAt: new Date().toISOString(),
    });
  }
  signals.sort((a, b) => b.signalStrength - a.signalStrength);
  return signals;
}

module.exports = { generateSignals, calculateRSI };
