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
const notificationBtn = document.getElementById('notification-btn');
const positionsContainer = document.getElementById('positions-container');
const noPositionsEl = document.getElementById('no-positions');
const positionsCountEl = document.getElementById('positions-count');
const clearPositionsBtn = document.getElementById('clear-positions-btn');

// State
let currentFilter = 'all';
let allSignals = [];
let previousSignalSymbols = new Set(); // Track previous signals to detect new ones
let refreshInterval = null;
let notificationsEnabled = false;
let serviceWorkerRegistration = null;
let deferredInstallPrompt = null;
let watchedPositions = []; // Positions user is tracking for exit signals
let notifiedStocks = new Set(); // Track stocks already notified for 3% increase (to avoid duplicates)

// Exit threshold (percentage above entry price to trigger exit warning)
const EXIT_THRESHOLD = 1.5;

// Minimum price change threshold to trigger buy notification
const BUY_THRESHOLD = 3;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  loadPositions();
  clearDailyNotifications(); // Reset notified stocks at start of each trading day
  fetchSignals();
  setupEventListeners();
  setupAutoRefresh();
  setupNotifications();
  setupInstallPrompt();
});

// ==================== POSITION TRACKING ====================

function loadPositions() {
  try {
    const saved = localStorage.getItem('watchedPositions');
    if (saved) {
      watchedPositions = JSON.parse(saved);
    }
    // Load notified stocks to avoid duplicate notifications
    const savedNotified = localStorage.getItem('notifiedStocks');
    if (savedNotified) {
      notifiedStocks = new Set(JSON.parse(savedNotified));
    }
  } catch (error) {
    console.error('Error loading positions:', error);
    watchedPositions = [];
    notifiedStocks = new Set();
  }
  updatePositionsCount();
}

function savePositions() {
  try {
    localStorage.setItem('watchedPositions', JSON.stringify(watchedPositions));
    localStorage.setItem('notifiedStocks', JSON.stringify([...notifiedStocks]));
  } catch (error) {
    console.error('Error saving positions:', error);
  }
  updatePositionsCount();
}

function updatePositionsCount() {
  if (positionsCountEl) {
    positionsCountEl.textContent = watchedPositions.length;
  }
}

function addToWatch(signal) {
  // Check if already watching
  if (watchedPositions.some(p => p.symbol === signal.symbol)) {
    alert(`${signal.symbol} is already in your watchlist`);
    return;
  }

  // Use open price from signal (backend provides it as 'open')
  const openPrice = signal.open || signal.entryPrice;

  // Add position with entry details
  const position = {
    symbol: signal.symbol,
    companyName: signal.companyName,
    entryPrice: signal.entryPrice,
    openPrice: openPrice,
    exitPrice: signal.entryPrice * (1 + EXIT_THRESHOLD / 100), // Exit level = entry + 1.5%
    stopLoss: signal.stopLoss,
    target1: signal.target1,
    target2: signal.target2,
    atr: signal.atr,
    addedAt: new Date().toISOString(),
    changePercent: signal.changePercent,
    peakPrice: signal.entryPrice, // Start tracking peak from entry price
    exitWarningShown: false
  };

  watchedPositions.push(position);
  savePositions();
  renderPositions();

  // Show confirmation
  showNotification('Added to Buy List', `${signal.symbol} added at ${formatPrice(position.entryPrice)}.\nWill notify when price falls toward ${formatPrice(position.exitPrice)}`, 'info');
}

function removeFromWatch(symbol) {
  watchedPositions = watchedPositions.filter(p => p.symbol !== symbol);
  savePositions();
  renderPositions();
}

function clearAllPositions() {
  if (confirm('Remove all stocks from your watchlist?')) {
    watchedPositions = [];
    savePositions();
    renderPositions();
  }
}

function renderPositions() {
  if (!positionsContainer) return;

  positionsContainer.innerHTML = '';

  if (watchedPositions.length === 0) {
    if (noPositionsEl) noPositionsEl.style.display = 'block';
    return;
  }

  if (noPositionsEl) noPositionsEl.style.display = 'none';

  watchedPositions.forEach(position => {
    const card = createPositionCard(position);
    positionsContainer.appendChild(card);
  });
}

function createPositionCard(position) {
  const card = document.createElement('div');
  card.className = 'signal-card position-card bullish';

  // Find current price from allSignals if available
  const currentSignal = allSignals.find(s => s.symbol === position.symbol);
  const currentPrice = currentSignal ? currentSignal.entryPrice : position.entryPrice;

  // Calculate P&L from entry
  const pnlPercent = ((currentPrice - position.entryPrice) / position.entryPrice * 100);
  const isProfit = pnlPercent >= 0;

  // Calculate exit warning level (entry + 1.5%)
  const exitWarningLevel = position.entryPrice * (1 + EXIT_THRESHOLD / 100);

  // Check if near exit
  const isNearExit = currentPrice <= exitWarningLevel * 1.02; // Within 2% of exit

  // Peak price info
  const peakPrice = position.peakPrice || position.entryPrice;
  const dropFromPeak = peakPrice > currentPrice ? ((peakPrice - currentPrice) / peakPrice * 100).toFixed(2) : 0;

  card.innerHTML = `
    <div class="card-header">
      <div class="stock-info">
        <h3>${position.symbol}</h3>
        <p class="company-name" title="${position.companyName}">${position.companyName}</p>
      </div>
      <button class="remove-btn" onclick="removeFromWatch('${position.symbol}')" title="Remove from watch">×</button>
    </div>

    <div class="price-section">
      <span class="current-price">${formatPrice(currentPrice)}</span>
      <span class="change ${isProfit ? 'positive' : 'negative'}">
        ${isProfit ? '+' : ''}${pnlPercent.toFixed(2)}% P&L
      </span>
    </div>

    <div class="levels-section">
      <h4>Position Levels</h4>
      <div class="level-row">
        <span class="level-label">Entry Price</span>
        <span class="level-value">${formatPrice(position.entryPrice)}</span>
      </div>
      <div class="level-row peak-row">
        <span class="level-label">Peak Price</span>
        <span class="level-value peak-price">${formatPrice(peakPrice)} ${dropFromPeak > 0 ? `<small class="negative">(-${dropFromPeak}%)</small>` : ''}</span>
      </div>
      <div class="level-row ${isNearExit ? 'warning' : ''}">
        <span class="level-label">Exit Alert At</span>
        <span class="level-value exit-level">${formatPrice(exitWarningLevel)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">Stop Loss</span>
        <span class="level-value stop-loss">${formatPrice(position.stopLoss)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">Target 1</span>
        <span class="level-value target">${formatPrice(position.target1)}</span>
      </div>
      <div class="level-row">
        <span class="level-label">Target 2</span>
        <span class="level-value target">${formatPrice(position.target2)}</span>
      </div>
    </div>

    <div class="card-footer">
      <span class="added-time">Added: ${formatTime(position.addedAt)}</span>
    </div>
  `;

  return card;
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function checkExitSignals(signals) {
  if (watchedPositions.length === 0) return;

  let positionsUpdated = false;

  watchedPositions.forEach(position => {
    const currentSignal = signals.find(s => s.symbol === position.symbol);
    if (!currentSignal) return;

    const currentPrice = currentSignal.entryPrice;

    // Update peak price if current price is higher
    if (!position.peakPrice || currentPrice > position.peakPrice) {
      position.peakPrice = currentPrice;
      position.exitWarningShown = false; // Reset warning when new peak is set
      positionsUpdated = true;
    }

    // Calculate exit warning level (entry price + 1.5%)
    const exitWarningLevel = position.entryPrice * (1 + EXIT_THRESHOLD / 100);

    // Check if price is falling from peak and approaching exit warning level
    // Notify when price drops below peak and is within 2% of exit warning level
    const isNearExitLevel = currentPrice <= exitWarningLevel * 1.02;
    const hasFallenFromPeak = position.peakPrice && currentPrice < position.peakPrice;

    if (hasFallenFromPeak && isNearExitLevel && !position.exitWarningShown) {
      const profitFromEntry = ((currentPrice - position.entryPrice) / position.entryPrice * 100).toFixed(2);
      const dropFromPeak = ((position.peakPrice - currentPrice) / position.peakPrice * 100).toFixed(2);

      showNotification(
        `⚠️ EXIT WARNING: ${position.symbol}`,
        `Price falling! Now: ${formatPrice(currentPrice)}\nPeak was: ${formatPrice(position.peakPrice)} (down ${dropFromPeak}%)\nEntry: ${formatPrice(position.entryPrice)} (${profitFromEntry}% profit)\nConsider exiting soon!`,
        'signal'
      );
      position.exitWarningShown = true;
      positionsUpdated = true;
    }

    // Check if price has fallen to or below exit level
    if (currentPrice <= exitWarningLevel) {
      showNotification(
        `🚨 EXIT NOW: ${position.symbol}`,
        `Price at exit level: ${formatPrice(currentPrice)}\nExit level: ${formatPrice(exitWarningLevel)}\nExit your position now!`,
        'signal'
      );
    }

    // Also warn if stop loss is hit
    if (currentPrice <= position.stopLoss) {
      showNotification(
        `🛑 STOP LOSS HIT: ${position.symbol}`,
        `Price: ${formatPrice(currentPrice)} hit Stop Loss: ${formatPrice(position.stopLoss)}`,
        'signal'
      );
    }
  });

  // Save updated peak prices
  if (positionsUpdated) {
    savePositions();
  }

  // Update position cards with latest prices
  renderPositions();
}

function isPositionWatched(symbol) {
  return watchedPositions.some(p => p.symbol === symbol);
}

// Check for stocks that hit 3% increase from open and send notification
function checkBuyOpportunities(signals) {
  signals.forEach(signal => {
    // Only check BUY signals (stocks that increased)
    if (signal.signalType !== 'BUY') return;

    // Skip if already in buy list or already notified today
    if (isPositionWatched(signal.symbol)) return;
    if (notifiedStocks.has(signal.symbol)) return;

    // Check if stock has increased 3% or more from open
    if (signal.changePercent >= BUY_THRESHOLD) {
      const openPrice = signal.open || signal.entryPrice / (1 + signal.changePercent / 100);

      // Mark as notified to avoid duplicate notifications
      notifiedStocks.add(signal.symbol);
      savePositions();

      // Send notification about the buy opportunity (user can manually add to buy list)
      showNotification(
        `📈 BUY Signal: ${signal.symbol}`,
        `Up ${signal.changePercent.toFixed(2)}% from open!\nPrice: ${formatPrice(signal.entryPrice)}\nOpen: ${formatPrice(openPrice)}\nAdd to buy list to track exit`,
        'signal'
      );

      console.log(`BUY signal: ${signal.symbol} - up ${signal.changePercent.toFixed(2)}%`);
    }
  });
}

// Clear notified stocks at the start of each trading day
function clearDailyNotifications() {
  const now = new Date();
  const lastClear = localStorage.getItem('lastNotificationClear');

  if (lastClear) {
    const lastClearDate = new Date(lastClear);
    // If it's a new day, clear the notified stocks
    if (now.toDateString() !== lastClearDate.toDateString()) {
      notifiedStocks.clear();
      localStorage.setItem('notifiedStocks', JSON.stringify([]));
      localStorage.setItem('lastNotificationClear', now.toISOString());
    }
  } else {
    localStorage.setItem('lastNotificationClear', now.toISOString());
  }
}

// ==================== END POSITION TRACKING ====================

// ==================== PWA SERVICE WORKER ====================

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registered:', serviceWorkerRegistration.scope);

      // Listen for updates
      serviceWorkerRegistration.addEventListener('updatefound', () => {
        const newWorker = serviceWorkerRegistration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            showUpdateAvailable();
          }
        });
      });

      // Request periodic background sync (if supported)
      if ('periodicSync' in serviceWorkerRegistration) {
        try {
          await serviceWorkerRegistration.periodicSync.register('check-signals-periodic', {
            minInterval: 5 * 60 * 1000 // 5 minutes
          });
          console.log('Periodic background sync registered');
        } catch (error) {
          console.log('Periodic sync not available:', error);
        }
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

function showUpdateAvailable() {
  // Show a notification that a new version is available
  const updateBanner = document.createElement('div');
  updateBanner.className = 'update-banner';
  updateBanner.innerHTML = `
    <span>New version available!</span>
    <button onclick="updateApp()">Update</button>
  `;
  document.body.prepend(updateBanner);
}

function updateApp() {
  if (serviceWorkerRegistration && serviceWorkerRegistration.waiting) {
    serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  window.location.reload();
}

// ==================== PWA INSTALL PROMPT ====================

function setupInstallPrompt() {
  // Capture the install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallButton();
  });

  // Handle successful install
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    hideInstallButton();
    deferredInstallPrompt = null;
  });
}

function showInstallButton() {
  // Create install button if it doesn't exist
  let installBtn = document.getElementById('install-btn');
  if (!installBtn) {
    installBtn = document.createElement('button');
    installBtn.id = 'install-btn';
    installBtn.className = 'install-btn';
    installBtn.textContent = 'Install App';
    installBtn.addEventListener('click', installApp);

    // Add to refresh group
    const refreshGroup = document.querySelector('.refresh-group');
    if (refreshGroup) {
      refreshGroup.insertBefore(installBtn, refreshGroup.firstChild);
    }
  }
  installBtn.style.display = 'inline-block';
}

function hideInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
}

async function installApp() {
  if (!deferredInstallPrompt) {
    console.log('Install prompt not available');
    return;
  }

  // Show the install prompt
  deferredInstallPrompt.prompt();

  // Wait for user choice
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log('User install choice:', outcome);

  // Clear the deferred prompt
  deferredInstallPrompt = null;
  hideInstallButton();
}

// ==================== END PWA ====================

// ==================== NOTIFICATION SYSTEM ====================

function setupNotifications() {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return;
  }

  // Check current permission status
  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
    updateNotificationButton(true);
  } else if (Notification.permission === 'denied') {
    updateNotificationButton(false, true);
  }

  // Setup notification button click
  if (notificationBtn) {
    notificationBtn.addEventListener('click', requestNotificationPermission);
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Your browser does not support notifications');
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      notificationsEnabled = true;
      updateNotificationButton(true);
      showNotification('Notifications Enabled', 'You will now receive alerts for new trading signals!', 'info');
    } else {
      notificationsEnabled = false;
      updateNotificationButton(false, permission === 'denied');
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

function updateNotificationButton(enabled, denied = false) {
  if (!notificationBtn) return;

  if (denied) {
    notificationBtn.textContent = 'Notifications Blocked';
    notificationBtn.classList.add('disabled');
    notificationBtn.title = 'Please enable notifications in browser settings';
  } else if (enabled) {
    notificationBtn.textContent = 'Notifications ON';
    notificationBtn.classList.add('active');
    notificationBtn.classList.remove('disabled');
  } else {
    notificationBtn.textContent = 'Enable Notifications';
    notificationBtn.classList.remove('active', 'disabled');
  }
}

function showNotification(title, body, type = 'signal') {
  if (!notificationsEnabled || Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body: body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: type === 'signal' ? 'signal-' + Date.now() : 'info',
    requireInteraction: type === 'signal', // Keep signal notifications until user dismisses
    silent: false,
    vibrate: [100, 50, 100]
  };

  // Use service worker for notifications (better mobile support)
  if (serviceWorkerRegistration && serviceWorkerRegistration.active) {
    serviceWorkerRegistration.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: title,
      body: body,
      tag: options.tag
    });
    return;
  }

  // Fallback to regular notifications
  try {
    const notification = new Notification(title, options);

    // Click notification to focus the app
    notification.onclick = function() {
      window.focus();
      notification.close();
    };

    // Auto-close info notifications after 5 seconds
    if (type === 'info') {
      setTimeout(() => notification.close(), 5000);
    }
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

function checkForNewSignals(newSignals) {
  if (!notificationsEnabled || newSignals.length === 0) {
    return;
  }

  const newSignalSymbols = new Set(newSignals.map(s => s.symbol));

  // Find signals that weren't in the previous fetch
  const brandNewSignals = newSignals.filter(s => !previousSignalSymbols.has(s.symbol));

  // Show notification for each new signal
  brandNewSignals.forEach(signal => {
    const title = `${signal.signalType} Signal: ${signal.symbol}`;
    const body = `Price: ${formatPrice(signal.entryPrice)} | Change: ${signal.changePercent.toFixed(2)}%\nSL: ${formatPrice(signal.stopLoss)} | Target: ${formatPrice(signal.target1)}`;
    showNotification(title, body, 'signal');
  });

  // Update previous signals set
  previousSignalSymbols = newSignalSymbols;
}

// Play sound for new signals (optional)
function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 200);
  } catch (error) {
    console.log('Could not play sound:', error);
  }
}

// ==================== END NOTIFICATION SYSTEM ====================

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

  // Clear positions button
  if (clearPositionsBtn) {
    clearPositionsBtn.addEventListener('click', clearAllPositions);
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
  } else if (tabName === 'positions') {
    renderPositions();
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
      const newSignals = data.signals || [];

      // Check for new signals and notify
      if (allSignals.length > 0) {
        checkForNewSignals(newSignals);
      } else {
        // First load - just store symbols without notifying
        previousSignalSymbols = new Set(newSignals.map(s => s.symbol));
      }

      allSignals = newSignals;
      updateLastUpdated(data.lastUpdated);
      renderSignals();

      // Check for stocks hitting 3% increase - auto-add to buy list
      checkBuyOpportunities(newSignals);

      // Check exit signals for watched positions
      checkExitSignals(newSignals);

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
  const isWatched = isPositionWatched(signal.symbol);

  card.className = `signal-card ${isBullish ? 'bullish' : 'bearish'}`;

  const dateHtml = showDate && signal.date ? `<p class="signal-date">${formatDate(signal.date)}</p>` : '';

  // Add watch button only for BUY signals
  const watchBtnHtml = isBullish && !showDate ? `
    <button class="watch-btn ${isWatched ? 'watched' : ''}"
            onclick="event.stopPropagation(); ${isWatched ? `removeFromWatch('${signal.symbol}')` : `addToWatchFromCard('${signal.symbol}')`}">
      ${isWatched ? 'Watching ✓' : 'Add to Watch'}
    </button>
  ` : '';

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
    ${watchBtnHtml}
  `;

  return card;
}

// Helper function to add from card click
function addToWatchFromCard(symbol) {
  const signal = allSignals.find(s => s.symbol === symbol);
  if (signal) {
    addToWatch(signal);
    renderSignals(); // Re-render to update button state
  }
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
