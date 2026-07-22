function ema(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) val = data[i] * k + val * (1 - k);
  return val;
}

function sma(data, period) {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function stdDev(data, period, mean) {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  const sqDiffs = slice.map(v => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / period);
}

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

function calculateStochRSI(prices) {
  if (!prices || prices.length < 28) return null;
  const rsiVals = [];
  const period = 14;
  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(i - period, i + 1);
    const changes = slice.slice(1).map((v, j) => v - slice[j]);
    let avgG = 0, avgL = 0;
    for (let j = 0; j < period; j++) {
      if (changes[j] >= 0) avgG += changes[j]; else avgL -= changes[j];
    }
    avgG /= period; avgL /= period;
    for (let j = period; j < changes.length; j++) {
      avgG = (avgG * (period - 1) + (changes[j] >= 0 ? changes[j] : 0)) / period;
      avgL = (avgL * (period - 1) + (changes[j] < 0 ? -changes[j] : 0)) / period;
    }
    rsiVals.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  }
  if (rsiVals.length < 14) return null;
  const recent = rsiVals.slice(-14);
  const minR = Math.min(...recent), maxR = Math.max(...recent);
  const current = recent[recent.length - 1];
  return maxR === minR ? 50 : ((current - minR) / (maxR - minR)) * 100;
}

function calculateBollinger(prices) {
  if (!prices || prices.length < 20) return null;
  const mean = sma(prices, 20);
  if (mean == null) return null;
  const sd = stdDev(prices, 20, mean);
  if (sd == null) return null;
  const current = prices[prices.length - 1];
  return {
    upper: mean + 2 * sd,
    middle: mean,
    lower: mean - 2 * sd,
    width: (4 * sd) / mean * 100,
    position: ((current - (mean - 2 * sd)) / (4 * sd)) * 100,
  };
}

function calculateMACD(prices) {
  if (!prices || prices.length < 26) return null;
  const ema12v = ema(prices, 12);
  const ema26v = ema(prices, 26);
  if (ema12v == null || ema26v == null) return null;
  return ema12v - ema26v;
}

function calcEMA9(prices) {
  if (!prices || prices.length < 9) return null;
  return ema(prices, 9);
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
    if (!prices || prices.length < 28) continue;
    const rsi = calculateRSI(prices);
    const stochRsi = calculateStochRSI(prices);
    const bbands = calculateBollinger(prices);
    const macd = calculateMACD(prices);
    const ema20v = ema(prices, 20);
    const sma50v = sma(prices, Math.min(50, prices.length));
    const volatility = calcVolatility(prices);
    const sr = calcSupportResistance(prices);
    const trend = calcTrend(prices);
    let signalType = 'neutral';
    let signalStrength = 0;
    const reasons = [];
    const p24 = coin.price_change_24h;
    const p7d = coin.price_change_7d;
    const currentPrice = coin.current_price;

    const volume = coin.total_volume || 0;
    const mcap = coin.market_cap || 1;
    const volRatio = volume / mcap;
    const volPct = volRatio * 100;

    if (p24 !== null && p24 !== undefined && !isNaN(p24)) {
      if (p24 < -8) { signalStrength += 3; reasons.push(`24h crash ${p24.toFixed(1)}%`); }
      else if (p24 < -5) { signalStrength += 2; reasons.push(`24h drop ${p24.toFixed(1)}%`); }
      else if (p24 > 20) { signalStrength -= 2; reasons.push(`24h surge ${p24.toFixed(1)}%`); }
      else if (p24 > 12) { signalStrength -= 1; reasons.push(`24h up ${p24.toFixed(1)}%`); }
    }
    if (p7d !== null && p7d !== undefined && !isNaN(p7d)) {
      if (p7d < -15) { signalStrength += 2; reasons.push(`7d crash ${p7d.toFixed(1)}%`); }
      else if (p7d < -8) { signalStrength += 1; reasons.push(`7d dip ${p7d.toFixed(1)}%`); }
    }
    if (rsi < 25) { signalStrength += 4; reasons.push(`RSI ${rsi.toFixed(1)} deeply oversold`); }
    else if (rsi < 35) { signalStrength += 2; reasons.push(`RSI ${rsi.toFixed(1)} oversold`); }
    else if (rsi < 45) { signalStrength += 1; reasons.push(`RSI ${rsi.toFixed(1)} approaching oversold`); }
    else if (rsi > 80) { signalStrength -= 3; reasons.push(`RSI ${rsi.toFixed(1)} deeply overbought`); }
    else if (rsi > 70) { signalStrength -= 2; reasons.push(`RSI ${rsi.toFixed(1)} overbought`); }
    else if (rsi > 60) { signalStrength -= 1; reasons.push(`RSI ${rsi.toFixed(1)} elevated`); }

    if (stochRsi !== null) {
      if (stochRsi < 15) { signalStrength += 2; reasons.push(`StochRSI ${stochRsi.toFixed(1)} oversold`); }
      else if (stochRsi > 85) { signalStrength -= 2; reasons.push(`StochRSI ${stochRsi.toFixed(1)} overbought`); }
    }

    if (bbands !== null && currentPrice > 0) {
      if (currentPrice <= bbands.lower * 1.01) { signalStrength += 2; reasons.push('At Bollinger lower band'); }
      else if (currentPrice >= bbands.upper * 0.99) { signalStrength -= 2; reasons.push('At Bollinger upper band'); }
    }

    if (macd !== null) {
      signalStrength += macd > 0 ? 1 : -1;
      reasons.push(macd > 0 ? 'MACD bullish' : 'MACD bearish');
    }

    if (ema20v !== null && currentPrice > 0) {
      if (currentPrice > ema20v * 1.03) { signalStrength += 1; reasons.push('Above EMA20'); }
      else if (currentPrice < ema20v * 0.97) { signalStrength -= 1; reasons.push('Below EMA20'); }
    }

    if (sma50v !== null && currentPrice > 0) {
      if (currentPrice > sma50v) signalStrength += 1;
      else signalStrength -= 1;
    }

    if (volume > 0 && mcap > 0) {
      if (volPct > 15) { signalStrength += 2; reasons.push('Very high volume'); }
      else if (volPct > 8) { signalStrength += 1; reasons.push('High volume ratio'); }
      else if (volPct < 0.5) { signalStrength -= 1; reasons.push('Low volume'); }
    }

    if (trend === 'uptrend') { signalStrength += 1; reasons.push('Uptrend'); }
    else if (trend === 'downtrend') { signalStrength -= 1; reasons.push('Downtrend'); }

    if (volatility !== null) {
      if (volatility > 80) reasons.push('Extreme volatility');
      else if (volatility > 50) reasons.push('High volatility');
    }

    if (signalStrength >= 5) signalType = 'strong_buy';
    else if (signalStrength >= 2) signalType = 'buy';
    else if (signalStrength >= 0) signalType = 'neutral';
    else if (signalStrength <= -3) signalType = 'sell';
    else if (signalStrength <= -1) signalType = 'weak_sell';

    let holdDuration = '-';
    let estimatedReturn = null;
    let confidence = 50;

    if (signalType === 'strong_buy' || signalType === 'buy') {
      const base = signalType === 'strong_buy' ? 14 : 8;
      let bonus = 0;
      if (rsi < 20) bonus += 6;
      else if (rsi < 30) bonus += 4;
      else if (rsi < 40) bonus += 2;
      if (stochRsi !== null && stochRsi < 20) bonus += 2;
      if (bbands !== null && currentPrice <= bbands.lower * 1.02) bonus += 2;
      if (p24 != null && p24 < -8) bonus += 4;
      else if (p24 != null && p24 < -3) bonus += 2;
      if (macd != null && macd > 0) bonus += 1;
      if (trend === 'uptrend') bonus += 1;
      if (volPct > 8) bonus += 1;
      estimatedReturn = Math.min(30, Math.round((base + bonus) * 10) / 10);

      if (rsi < 20) holdDuration = '14-21 days';
      else if (rsi < 30) holdDuration = '10-14 days';
      else if (rsi < 40) holdDuration = '7-10 days';
      else holdDuration = '5-7 days';

      const indicators = [rsi < 35 ? 1 : 0, (stochRsi || 50) < 25 ? 1 : 0,
        bbands && currentPrice <= bbands.lower * 1.02 ? 1 : 0, macd > 0 ? 1 : 0,
        trend === 'uptrend' ? 1 : 0, p24 < 0 ? 1 : 0, volPct > 5 ? 1 : 0];
      const indicatorCount = indicators.reduce((a, b) => a + b, 0);
      confidence = Math.min(95, 45 + signalStrength * 5 + indicatorCount * 5);
    } else if (signalType === 'sell' || signalType === 'weak_sell') {
      let penalty = 0;
      if (rsi > 80) penalty += 5;
      else if (rsi > 70) penalty += 3;
      else if (rsi > 60) penalty += 1;
      if (stochRsi !== null && stochRsi > 80) penalty += 2;
      if (bbands !== null && currentPrice >= bbands.upper * 0.98) penalty += 2;
      if (p24 != null && p24 > 15) penalty += 3;
      else if (p24 != null && p24 > 8) penalty += 2;
      if (trend === 'downtrend') penalty += 1;
      estimatedReturn = -Math.min(20, Math.round(penalty * 10) / 10);
      holdDuration = signalType === 'sell' ? 'Sell now' : 'Sell in 1-3 days';
      confidence = Math.min(90, 45 + Math.abs(signalStrength) * 6);
    } else {
      confidence = 25 + Math.abs(signalStrength) * 3;
    }

    let stopLoss = currentPrice * 0.92;
    let takeProfit = currentPrice * (1 + (estimatedReturn != null && estimatedReturn > 0 ? estimatedReturn : 6) / 100);

    if (sr.support != null && sr.support < currentPrice && sr.support > currentPrice * 0.85) {
      stopLoss = sr.support * 0.97;
    }
    if (sr.resistance != null && sr.resistance > currentPrice && sr.resistance < currentPrice * 1.25) {
      takeProfit = sr.resistance * 1.01;
    }
    if (bbands !== null) {
      if (bbands.lower > currentPrice * 0.8) stopLoss = Math.max(stopLoss, bbands.lower * 0.98);
      if (bbands.upper < currentPrice * 1.3) takeProfit = Math.min(takeProfit, bbands.upper);
    }
    if (signalType === 'sell' || signalType === 'weak_sell') {
      takeProfit = currentPrice * 0.95;
      stopLoss = currentPrice * 1.05;
    }

    const bbData = bbands ? {
      upper: roundPrice(bbands.upper), middle: roundPrice(bbands.middle),
      lower: roundPrice(bbands.lower), width: Math.round(bbands.width * 100) / 100,
      position: Math.round(bbands.position * 10) / 10,
    } : null;

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
      stochRsi: stochRsi !== null ? Math.round(stochRsi * 10) / 10 : null,
      bollingerBands: bbData,
      reasons: reasons.slice(0, 6),
      sparkline: prices || null,
      holdDuration,
      estimatedReturn,
      confidence,
      stopLoss: roundPrice(stopLoss),
      takeProfit: roundPrice(takeProfit),
      trend,
      volatility: volatility != null ? Math.round(volatility * 100) / 100 : null,
      volRatio: volRatio > 0 ? Math.round(volRatio * 1000) / 1000 : null,
      updatedAt: new Date().toISOString(),
    });
  }
  signals.sort((a, b) => b.signalStrength - a.signalStrength);
  return signals;
}

module.exports = { generateSignals, calculateRSI };
