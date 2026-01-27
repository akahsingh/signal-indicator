// DOM Elements
const signalsContainer = document.getElementById('signals-container');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const noSignalsEl = document.getElementById('no-signals');
const lastUpdatedEl = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-btn');
const filterBtns = document.querySelectorAll('.filter-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const historyContainer = document.getElementById('history-container');
const loadHistoryBtn = document.getElementById('load-history-btn');
const historyDaysSelect = document.getElementById('history-days');
const historyTypeSelect = document.getElementById('history-type');

// State
let currentFilter = 'all';
let allSignals = [];
let refreshInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchSignals();
  setupEventListeners();
  setupAutoRefresh();
});

function setupEventListeners() {
  // Tab buttons
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderSignals();
    });
  });

  // Refresh button
  refreshBtn.addEventListener('click', () => {
    fetchSignals(true);
  });

  // History button
  if (loadHistoryBtn) {
    loadHistoryBtn.addEventListener('click', fetchHistory);
  }
}

function switchTab(tabName) {
  // Update tab buttons
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load data for the tab
  if (tabName === 'history') {
    fetchHistory();
  } else if (tabName === 'stats') {
    fetchStats();
  }
}

function setupAutoRefresh() {
  // Refresh every 5 minutes during market hours
  refreshInterval = setInterval(() => {
    if (isMarketHours()) {
      fetchSignals();
    }
  }, 300000); // 5 minutes
}

function isMarketHours() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;

  // Market hours: 9:15 AM to 3:30 PM IST
  const marketOpen = 9 * 60 + 15;  // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM

  // Check if it's a weekday
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  return time >= marketOpen && time <= marketClose;
}

async function fetchSignals(forceRefresh = false) {
  showLoading(true);
  hideError();
  hideNoSignals();

  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Loading...';

  try {
    const endpoint = forceRefresh ? '/api/refresh' : '/api/signals';
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.success) {
      allSignals = data.signals || [];
      updateLastUpdated(data.lastUpdated);
      renderSignals();

      if (allSignals.length === 0) {
        showNoSignals();
      }
    } else {
      throw new Error(data.message || 'Failed to fetch signals');
    }
  } catch (error) {
    console.error('Error fetching signals:', error);
    showError();
  } finally {
    showLoading(false);
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Refresh';
  }
}

async function fetchHistory() {
  if (!historyContainer) return;

  const days = historyDaysSelect?.value || 7;
  const type = historyTypeSelect?.value || '';

  historyContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading history...</p></div>';

  try {
    let url = `/api/history?days=${days}`;
    if (type) url += `&type=${type}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      renderHistory(data.signals);
    } else {
      throw new Error(data.message || 'Failed to fetch history');
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    historyContainer.innerHTML = '<div class="error"><p>Failed to load history. Please try again.</p></div>';
  }
}

function renderHistory(signals) {
  historyContainer.innerHTML = '';

  if (signals.length === 0) {
    historyContainer.innerHTML = '<div class="no-signals"><p>No historical signals found for the selected period.</p></div>';
    return;
  }

  signals.forEach(signal => {
    const card = createSignalCard(signal, true);
    historyContainer.appendChild(card);
  });
}

async function fetchStats() {
  try {
    const response = await fetch('/api/stats');
    const data = await response.json();

    if (data.success) {
      document.getElementById('stat-total').textContent = data.stats.totalSignals;
      document.getElementById('stat-buy').textContent = data.stats.buySignals;
      document.getElementById('stat-sell').textContent = data.stats.sellSignals;
      document.getElementById('stat-stocks').textContent = data.stats.uniqueStocks;
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
  }
}

function renderSignals() {
  const filteredSignals = filterSignals(allSignals);
  signalsContainer.innerHTML = '';

  if (filteredSignals.length === 0) {
    if (allSignals.length > 0) {
      signalsContainer.innerHTML = `
        <div class="no-signals">
          <p>No ${currentFilter === 'bullish' ? 'bullish' : 'bearish'} signals found.</p>
        </div>
      `;
    }
    return;
  }

  filteredSignals.forEach(signal => {
    const card = createSignalCard(signal);
    signalsContainer.appendChild(card);
  });
}

function filterSignals(signals) {
  if (currentFilter === 'all') return signals;
  if (currentFilter === 'bullish') return signals.filter(s => s.signalType === 'BUY');
  if (currentFilter === 'bearish') return signals.filter(s => s.signalType === 'SELL');
  return signals;
}

function createSignalCard(signal, showDate = false) {
  const card = document.createElement('div');
  const isBullish = signal.signalType === 'BUY';

  card.className = `signal-card ${isBullish ? 'bullish' : 'bearish'}`;

  const dateHtml = showDate && signal.date ? `<p class="signal-date">${formatDate(signal.date)}</p>` : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="stock-info">
        <h3>${signal.symbol}</h3>
        <p class="company-name" title="${signal.companyName}">${signal.companyName}</p>
        ${dateHtml}
      </div>
      <span class="signal-badge ${isBullish ? 'buy' : 'sell'}">${signal.signalType}</span>
    </div>

    <div class="price-section">
      <span class="current-price">${formatPrice(signal.entryPrice)}</span>
      <span class="change ${signal.changePercent >= 0 ? 'positive' : 'negative'}">
        ${signal.changePercent >= 0 ? '+' : ''}${signal.changePercent.toFixed(2)}%
      </span>
    </div>

    <div class="levels-section">
      <h4>Trading Levels</h4>
      <div class="level-row">
        <span class="level-label">Stop Loss</span>
        <span class="level-value stop-loss">${formatPrice(signal.stopLoss)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">Target 1</span>
        <span class="level-value target">${formatPrice(signal.target1)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">Target 2</span>
        <span class="level-value target">${formatPrice(signal.target2)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">ATR (14)</span>
        <span class="level-value atr">${formatPrice(signal.atr)}</span>
      </div>
    </div>

    <div class="card-footer">
      <div class="risk-reward">
        R:R (T1): <span>${signal.riskReward1}</span>
      </div>
      <div class="risk-reward">
        R:R (T2): <span>${signal.riskReward2}</span>
      </div>
    </div>
  `;

  return card;
}

function formatPrice(price) {
  if (price === undefined || price === null) return '--';
  return '₹' + price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function updateLastUpdated(timestamp) {
  if (!timestamp) return;
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  lastUpdatedEl.textContent = `Last updated: ${timeStr}`;
}

function showLoading(show) {
  loadingEl.style.display = show ? 'block' : 'none';
  signalsContainer.style.display = show ? 'none' : 'grid';
}

function showError() {
  errorEl.style.display = 'block';
  signalsContainer.style.display = 'none';
}

function hideError() {
  errorEl.style.display = 'none';
}

function showNoSignals() {
  noSignalsEl.style.display = 'block';
}

function hideNoSignals() {
  noSignalsEl.style.display = 'none';
}
