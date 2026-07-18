function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '--';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K';
  if (n >= 1) return '$' + n.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2});
  if (n >= 0.01) return '$' + n.toFixed(4);
  if (n > 0) return '$' + n.toFixed(6);
  return '$0.00';
}
function fmtCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return '--';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2)+'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2)+'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2)+'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2)+'K';
  return '$' + n.toFixed(2);
}
function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '--';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function chColor(n) {
  if (n === null || n === undefined || isNaN(n)) return 'var(--text-muted)';
  return n >= 0 ? 'var(--green)' : 'var(--red)';
}
function rsiColor(n) {
  if (n === null || n === undefined) return 'var(--text-muted)';
  if (n < 30) return 'var(--green)'; if (n > 70) return 'var(--red)';
  if (n < 40) return 'var(--green)'; if (n > 60) return 'var(--yellow)';
  return 'var(--text-muted)';
}
function sigLabel(t) { return {strong_buy:'STRONG BUY',buy:'BUY',sell:'SELL',weak_sell:'WEAK SELL',neutral:'NEUTRAL'}[t]||t; }
function sigBadge(t) { return {strong_buy:'badge-strong-buy',buy:'badge-buy',sell:'badge-sell',weak_sell:'badge-weak-sell',neutral:'badge-neutral'}[t]||'badge-neutral'; }

function sparklineHTML(prices, color) {
  if (!prices || prices.length < 2) return '';
  const w=64, h=24, pad=2;
  const mn=Math.min(...prices), mx=Math.max(...prices), r=mx-mn||1;
  const pts = prices.map((v,i)=>`${pad+(i/(prices.length-1))*(w-2*pad)},${pad+(1-(v-mn)/r)*(h-2*pad)}`).join(' ');
  return `<svg class="sparkline-svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="spark-grad-${pts.length}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="0.1"/><stop offset="100%" stop-color="${color}" stop-opacity="0.4"/></linearGradient></defs><polyline fill="none" stroke="url(#spark-grad-${pts.length})" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/></svg>`;
}

function coinImg(src, alt) {
  return `<div class="coin-image-wrapper"><img class="coin-image" src="${src}" alt="${alt}" loading="lazy" onerror="this.parentElement.innerHTML='<span style=font-size:16px>🪙</span>'"></div>`;
}

function confidenceHTML(val) {
  const c = val || 0;
  const color = c >= 70 ? 'var(--green)' : c >= 50 ? 'var(--yellow)' : c >= 30 ? 'var(--blue)' : 'var(--red)';
  return `<div class="confidence-bar"><div class="confidence-fill" style="width:${c}%;background:${color}"></div></div>`;
}

function holdHTML(c) {
  if (!c.holdDuration || c.holdDuration === '-') return '';
  const retColor = c.estimatedReturn >= 0 ? 'var(--green)' : 'var(--red)';
  return `<div class="hold-info">
    <span>Hold: <strong>${c.holdDuration}</strong></span>
    <span style="color:${retColor};font-weight:700">${fmtPct(c.estimatedReturn)}</span>
    ${c.stopLoss ? `<span>SL: <strong style="color:var(--red)">${fmt(c.stopLoss)}</strong></span>` : ''}
    ${c.takeProfit ? `<span>TP: <strong style="color:var(--green)">${fmt(c.takeProfit)}</strong></span>` : ''}
  </div>`;
}

function renderSigList(list, elId, countId) {
  const el = document.getElementById(elId);
  if (countId) document.getElementById(countId).textContent = list.length;
  if (!list.length) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No signals</div>'; return; }
  el.innerHTML = list.map((c, i) => {
    const sp = c.priceChange24h ?? 0;
    const color = sp >= 0 ? '#22d07a' : '#f14550';
    const glow = c.signalType === 'strong_buy' ? ' glow-strong-buy' : '';
    return `<div class="coin-row${glow}" style="animation-delay:${i*0.035}s">
      ${coinImg(c.image, c.name)}
      <div class="coin-info">
        <div class="coin-name">${c.name}</div>
        <div class="coin-symbol">${c.symbol.toUpperCase()} ${c.rsi !== null && c.rsi !== undefined ? `<span style="color:${rsiColor(c.rsi)}">RSI ${c.rsi.toFixed(1)}</span>` : ''} ${c.trend ? `<span style="color:var(--text-muted);font-size:10px">${c.trend}</span>` : ''}</div>
        ${holdHTML(c)}
        ${c.confidence ? confidenceHTML(c.confidence) : ''}
      </div>
      ${c.sparkline ? sparklineHTML(c.sparkline, color) : ''}
      <div class="coin-price-col">
        <div class="price" style="color:${chColor(sp)}">${fmtPct(sp)}</div>
        <div class="change" style="color:var(--text-muted)">${fmt(c.currentPrice)}</div>
      </div>
      <span class="badge ${sigBadge(c.signalType)}">${sigLabel(c.signalType)}</span>
    </div>
    ${c.reasons ? `<div style="margin:-4px 0 2px 42px" class="signal-reasons">${c.reasons.map(r => `<span class="reason-tag">${r}</span>`).join('')}</div>` : ''}`;
  }).join('');
}

function renderMarket(coins) {
  const el = document.getElementById('marketList');
  if (!coins || !coins.length) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No data</div>'; return; }
  el.innerHTML = coins.map((c, i) => {
    const sp = c.price_change_24h || 0;
    return `<div class="coin-row" style="animation-delay:${i*0.02}s">
      <span class="coin-rank">#${c.market_cap_rank || '-'}</span>
      ${coinImg(c.image, c.name)}
      <div class="coin-info"><div class="coin-name">${c.name}</div><div class="coin-symbol">${c.symbol.toUpperCase()}</div></div>
      ${c.sparkline ? sparklineHTML(c.sparkline, sp >= 0 ? '#22d07a' : '#f14550') : ''}
      <div class="coin-price-col">
        <div class="price">${fmt(c.current_price)}</div>
        <div class="change" style="color:${chColor(sp)}">${fmtPct(sp)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTrending(list) {
  const el = document.getElementById('trendingList');
  if (!list || !list.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No trending data</div>'; return; }
  el.innerHTML = list.map((c, i) => {
    const rankClass = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    const sp = c.change24h;
    return `<div class="coin-row" style="animation-delay:${i*0.04}s">
      <span class="trending-rank ${rankClass}">#${i+1}</span>
      ${c.image ? coinImg(c.image, c.name) : `<div class="coin-image-wrapper"><span style="font-size:16px">🔥</span></div>`}
      <div class="coin-info">
        <div class="coin-name">${c.name}</div>
        <div class="coin-symbol">${c.symbol.toUpperCase()} ${c.score !== undefined ? `<span style="color:var(--text-muted);font-size:10px">score ${c.score}</span>` : ''}</div>
      </div>
      <div class="coin-price-col">
        ${c.price ? `<div class="price">${fmt(c.price)}</div>` : ''}
        ${sp !== undefined && sp !== null ? `<div class="change" style="color:${chColor(sp)}">${fmtPct(sp)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderGainersLosers(gainers, losers) {
  const gEl = document.getElementById('gainersList');
  const lEl = document.getElementById('losersList');
  if (gainers && gainers.length) {
    gEl.innerHTML = gainers.map((c, i) => `<div class="coin-row" style="animation-delay:${i*0.04}s">
      ${coinImg(c.image, c.name)}
      <div class="coin-info"><div class="coin-name">${c.name}</div><div class="coin-symbol">${c.symbol.toUpperCase()}</div></div>
      <div class="coin-price-col"><div class="price" style="color:var(--green)">+${(c.price_change_24h||0).toFixed(2)}%</div></div>
    </div>`).join('');
  }
  if (losers && losers.length) {
    lEl.innerHTML = losers.map((c, i) => `<div class="coin-row" style="animation-delay:${i*0.04}s">
      ${coinImg(c.image, c.name)}
      <div class="coin-info"><div class="coin-name">${c.name}</div><div class="coin-symbol">${c.symbol.toUpperCase()}</div></div>
      <div class="coin-price-col"><div class="price" style="color:var(--red)">${(c.price_change_24h||0).toFixed(2)}%</div></div>
    </div>`).join('');
  }
}

function renderDominance(global) {
  const el = document.getElementById('dominanceSection');
  if (!global || !global.market_cap_percentage) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">No data</div>'; return; }
  const p = global.market_cap_percentage;
  const btc = p.btc || 0, eth = p.eth || 0, usdt = p.usdt || 0, bnb = p.bnb || 0;
  const other = Math.max(0, 100 - btc - eth - usdt - bnb);
  const items = [
    {key:'btc', label:'BTC', pct:btc, cls:'dom-btc'}, {key:'eth', label:'ETH', pct:eth, cls:'dom-eth'},
    {key:'usdt', label:'USDT', pct:usdt, cls:'dom-usdt'}, {key:'bnb', label:'BNB', pct:bnb, cls:'dom-bnb'},
    {key:'other', label:'Other', pct:other, cls:'dom-other'},
  ];
  const colors = {btc:'#f7931a', eth:'#627eea', usdt:'#26a17b', bnb:'#f3ba2f', other:'#4f5a6e'};
  el.innerHTML = `<div class="dom-bar">${items.map(i => `<div class="dom-seg ${i.cls}" style="width:${i.pct}%">${i.pct > 8 ? i.label : ''}</div>`).join('')}</div>
    <div class="dom-labels">${items.filter(i => i.pct > 0).map(i => `<span class="dom-label"><span class="dom-dot" style="background:${colors[i.key]}"></span>${i.label} ${i.pct.toFixed(1)}%</span>`).join('')}</div>`;
}

function renderWhales(portfolios) {
  const el = document.getElementById('whalesList');
  if (!portfolios || !portfolios.length) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No data</div>'; return; }
  el.innerHTML = portfolios.map((w, i) => {
    const maxAlloc = Math.max(...w.holdings.map(h=>h.allocation||0), 1);
    return `<div class="whale-card" style="animation-delay:${i*0.05}s">
      <div class="whale-header">
        <div class="whale-name">${w.name}</div>
        <span class="whale-strategy">${w.strategy} · ${w.risk}</span>
      </div>
      <div class="whale-value">${fmtCompact(w.totalValue)} <span style="color:${chColor(w.pnl24h)};font-weight:600">${fmtPct(w.pnl24h)}</span> <span style="color:var(--text-muted)">24h</span> <span style="color:${chColor(w.pnl7d)};font-weight:600">${fmtPct(w.pnl7d)}</span> <span style="color:var(--text-muted)">7d</span></div>
      <div class="whale-holdings">${w.holdings.slice(0,5).map(h => `
        <div class="whale-holding">
          <div><span class="name">${h.name}</span> <span class="alloc">${(h.allocation||0).toFixed(1)}%</span></div>
          <div style="color:var(--text-primary);font-weight:500">${fmt(h.valueUsd)}</div>
        </div>
        <div class="alloc-bar"><div class="alloc-fill" style="width:${(h.allocation/maxAlloc)*100}%"></div></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function renderTrades(trades) {
  const el = document.getElementById('tradesList');
  if (!trades || !trades.length) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No recent trades</div>'; return; }
  const buys = trades.filter(t=>t.action==='buy').length;
  const sells = trades.filter(t=>t.action==='sell').length;
  el.innerHTML = `<div class="trade-summary">
    <div class="trade-summary-item"><div class="trade-summary-value" style="color:var(--green)">${buys}</div><div class="trade-summary-label">Buys</div></div>
    <div class="trade-summary-item"><div class="trade-summary-value" style="color:var(--red)">${sells}</div><div class="trade-summary-label">Sells</div></div>
    <div class="trade-summary-item"><div class="trade-summary-value" style="color:var(--text-primary)">${trades.length}</div><div class="trade-summary-label">Total</div></div>
  </div>` + trades.map((t, i) => `<div class="trade-row" style="animation-delay:${i*0.03}s">
    <div class="trade-wallet">${t.walletName}</div>
    <div class="trade-coin">${(t.coinSymbol||'').toUpperCase()}</div>
    <div class="trade-action ${t.action}">${t.action}</div>
    <div style="flex:1;font-size:11px;color:var(--text-secondary)">${t.reason}</div>
    <div class="trade-confidence">${t.confidence}%</div>
  </div>`).join('');
}

function renderMetrics(global) {
  if (!global) return;
  const btcDom = global.market_cap_percentage?.btc;
  document.getElementById('marketMetrics').innerHTML = `
    <div class="card metric-box">
      <div class="metric-value" id="metricMcap">${fmtCompact(global.total_market_cap)}</div>
      <div class="metric-label">Market Cap</div>
      <div class="metric-change" style="color:${chColor(global.market_cap_change_percentage_24h)}">${fmtPct(global.market_cap_change_percentage_24h)}</div>
    </div>
    <div class="card metric-box">
      <div class="metric-value" id="metricVolume">${fmtCompact(global.total_volume)}</div>
      <div class="metric-label">24h Volume</div>
    </div>
    <div class="card metric-box">
      <div class="metric-value">${(global.active_cryptocurrencies||0).toLocaleString()}</div>
      <div class="metric-label">Coins</div>
    </div>
    <div class="card metric-box">
      <div class="metric-value">${btcDom ? btcDom.toFixed(1)+'%' : '--'}</div>
      <div class="metric-label">BTC Dom</div>
    </div>`;
}

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let animId;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
function initParticles() {
  particles = [];
  const count = Math.min(40, Math.floor(window.innerWidth / 30));
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      o: Math.random() * 0.3 + 0.05,
    });
  }
}
function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(74, 140, 255, ${p.o})`;
    ctx.fill();
    p.x += p.dx; p.y += p.dy;
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
  }
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(74, 140, 255, ${0.04 * (1 - dist / 120)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
  animId = requestAnimationFrame(drawParticles);
}
window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
resizeCanvas(); initParticles(); drawParticles();

async function fetchDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (data.loading) {
      document.getElementById('errorBanner').innerHTML = '⚠ ' + (data.message||'Loading...');
      document.getElementById('errorBanner').style.display = 'flex';
      setTimeout(fetchDashboard, 5000);
      return;
    }
    if (!data.cacheReady) {
      document.getElementById('errorBanner').innerHTML = '⚠ Connecting to data sources...';
      document.getElementById('errorBanner').style.display = 'flex';
      setTimeout(fetchDashboard, 5000);
      return;
    }
    if (data.rateLimited) {
      document.getElementById('errorBanner').innerHTML = '⚠ CoinGecko rate limit hit. Retrying in 60s...';
      document.getElementById('errorBanner').style.display = 'flex';
    } else {
      document.getElementById('errorBanner').style.display = 'none';
    }
    renderMetrics(data.market.global);
    const btc = data.market.topCoins?.find(c => c.id === 'bitcoin');
    const eth = data.market.topCoins?.find(c => c.id === 'ethereum');
    document.getElementById('btcPrice').innerHTML = btc ? `${fmt(btc.current_price)} <span style="color:${chColor(btc.price_change_24h)};font-size:10px">${fmtPct(btc.price_change_24h)}</span>` : '--';
    document.getElementById('ethPrice').innerHTML = eth ? `${fmt(eth.current_price)} <span style="color:${chColor(eth.price_change_24h)};font-size:10px">${fmtPct(eth.price_change_24h)}</span>` : '--';
    document.getElementById('totalMcap').textContent = fmtCompact(data.market.global?.total_market_cap);
    document.getElementById('lastUpdateLabel').textContent = data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '--';
    renderSigList(data.signals.buys, 'buySignalsList', 'buyCount');
    renderSigList(data.signals.sells, 'sellSignalsList', 'sellCount');
    renderSigList(data.signals.all, 'allSignalsList', null);
    renderMarket(data.market.topCoins);
    renderTrending(data.market.trending);
    renderGainersLosers(data.market.gainers, data.market.losers);
    renderDominance(data.market.global);
    renderWhales(data.whales.portfolios);
    renderTrades(data.whales.recentTrades);
    const provLabel = data.provider === 'coincap' ? 'CoinCap' : 'CoinGecko';
    document.getElementById('lastUpdate').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleString() + '  ·  ' + provLabel;
  } catch (err) {
    document.getElementById('errorBanner').innerHTML = '⚠ Connection error. Retrying...';
    document.getElementById('errorBanner').style.display = 'flex';
    setTimeout(fetchDashboard, 10000);
  }
}

document.getElementById('tabBar').addEventListener('click', function(e) {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
});

fetchDashboard();
setInterval(fetchDashboard, 120000);
