const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// File paths for persistent storage
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const NOTIFIED_SIGNALS_FILE = path.join(DATA_DIR, 'notified-signals.json');
const TRACKED_POSITIONS_FILE = path.join(DATA_DIR, 'tracked-positions.json');

// Exit threshold: notify when price falls to entry + 1.5%
const EXIT_THRESHOLD = 1.5;
// Buy threshold: 3% increase from open
const BUY_THRESHOLD = 3;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load or generate VAPID keys
function getVapidKeys() {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const keys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      console.log('[Push] Loaded existing VAPID keys');
      return keys;
    }
  } catch (error) {
    console.log('[Push] Error loading VAPID keys, generating new ones');
  }

  // Generate new VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  console.log('[Push] Generated new VAPID keys');
  return vapidKeys;
}

// Initialize VAPID keys
const vapidKeys = getVapidKeys();

// Configure web-push
webpush.setVapidDetails(
  'mailto:signals@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Load subscriptions from file
function loadSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('[Push] Error loading subscriptions:', error);
  }
  return [];
}

// Save subscriptions to file
function saveSubscriptions(subscriptions) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (error) {
    console.error('[Push] Error saving subscriptions:', error);
  }
}

// Load notified signals (to avoid duplicate notifications)
function loadNotifiedSignals() {
  try {
    if (fs.existsSync(NOTIFIED_SIGNALS_FILE)) {
      const data = JSON.parse(fs.readFileSync(NOTIFIED_SIGNALS_FILE, 'utf8'));
      // Clean up old entries (older than 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = {};
      for (const [key, timestamp] of Object.entries(data)) {
        if (timestamp > oneDayAgo) {
          filtered[key] = timestamp;
        }
      }
      return filtered;
    }
  } catch (error) {
    console.error('[Push] Error loading notified signals:', error);
  }
  return {};
}

// Save notified signals
function saveNotifiedSignals(notified) {
  try {
    fs.writeFileSync(NOTIFIED_SIGNALS_FILE, JSON.stringify(notified, null, 2));
  } catch (error) {
    console.error('[Push] Error saving notified signals:', error);
  }
}

// Load tracked positions (stocks that hit 3%+ and are being monitored for exit)
function loadTrackedPositions() {
  try {
    if (fs.existsSync(TRACKED_POSITIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TRACKED_POSITIONS_FILE, 'utf8'));
      // Only keep today's positions
      const today = new Date().toDateString();
      const filtered = {};
      for (const [symbol, position] of Object.entries(data)) {
        if (position.date === today) {
          filtered[symbol] = position;
        }
      }
      return filtered;
    }
  } catch (error) {
    console.error('[Push] Error loading tracked positions:', error);
  }
  return {};
}

// Save tracked positions
function saveTrackedPositions(positions) {
  try {
    fs.writeFileSync(TRACKED_POSITIONS_FILE, JSON.stringify(positions, null, 2));
  } catch (error) {
    console.error('[Push] Error saving tracked positions:', error);
  }
}

// In-memory data
let subscriptions = loadSubscriptions();
let notifiedSignals = loadNotifiedSignals();
let trackedPositions = loadTrackedPositions();

// Get public VAPID key for frontend
function getPublicKey() {
  return vapidKeys.publicKey;
}

// Add a new subscription
function addSubscription(subscription) {
  // Check if subscription already exists
  const exists = subscriptions.some(
    sub => sub.endpoint === subscription.endpoint
  );

  if (!exists) {
    subscriptions.push({
      ...subscription,
      createdAt: new Date().toISOString()
    });
    saveSubscriptions(subscriptions);
    console.log('[Push] New subscription added. Total:', subscriptions.length);
  }
  return true;
}

// Remove a subscription
function removeSubscription(endpoint) {
  const initialLength = subscriptions.length;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);

  if (subscriptions.length !== initialLength) {
    saveSubscriptions(subscriptions);
    console.log('[Push] Subscription removed. Total:', subscriptions.length);
    return true;
  }
  return false;
}

// Send notification to all subscribers
async function sendNotificationToAll(title, body, data = {}) {
  if (subscriptions.length === 0) {
    console.log('[Push] No subscribers to notify');
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: data.tag || 'signal-' + Date.now(),
    soundType: data.soundType || 'signal',
    url: data.url || '/',
    ...data
  });

  let sent = 0;
  let failed = 0;
  const failedEndpoints = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription, payload);
      sent++;
    } catch (error) {
      failed++;
      console.error('[Push] Failed to send to subscription:', error.message);

      // Remove invalid subscriptions (410 Gone or 404 Not Found)
      if (error.statusCode === 410 || error.statusCode === 404) {
        failedEndpoints.push(subscription.endpoint);
      }
    }
  }

  // Clean up invalid subscriptions
  if (failedEndpoints.length > 0) {
    subscriptions = subscriptions.filter(
      sub => !failedEndpoints.includes(sub.endpoint)
    );
    saveSubscriptions(subscriptions);
    console.log('[Push] Removed', failedEndpoints.length, 'invalid subscriptions');
  }

  console.log(`[Push] Sent: ${sent}, Failed: ${failed}`);
  return { sent, failed };
}

// Check and notify for new signals + track positions + check exit signals
async function notifyNewSignals(signals) {
  if (!signals || signals.length === 0) return { buySignals: 0, sellSignals: 0, exitWarnings: 0 };

  const today = new Date().toDateString();
  let newBuySignals = [];
  let exitWarnings = [];
  let positionsUpdated = false;

  for (const signal of signals) {
    const symbol = signal.symbol;
    const currentPrice = signal.entryPrice;
    const changePercent = signal.changePercent;

    // Check if this is a new BUY signal (3%+ increase from open)
    if (signal.signalType === 'BUY' && changePercent >= BUY_THRESHOLD) {
      const buySignalKey = `${symbol}-BUY-${today}`;

      // New BUY signal - notify and start tracking
      if (!notifiedSignals[buySignalKey]) {
        newBuySignals.push(signal);
        notifiedSignals[buySignalKey] = Date.now();

        // Start tracking this position for exit signals
        if (!trackedPositions[symbol]) {
          trackedPositions[symbol] = {
            symbol: symbol,
            companyName: signal.companyName,
            entryPrice: currentPrice, // Price when 3% threshold was hit
            openPrice: signal.open || currentPrice / (1 + changePercent / 100),
            peakPrice: currentPrice,
            exitWarningLevel: currentPrice * (1 + EXIT_THRESHOLD / 100), // Entry + 1.5%
            date: today,
            entryTime: new Date().toISOString(),
            exitWarningShown: false
          };
          positionsUpdated = true;
          console.log(`[Push] Tracking position: ${symbol} @ ${currentPrice.toFixed(2)}, exit warning at ${trackedPositions[symbol].exitWarningLevel.toFixed(2)}`);
        }
      }
    }

    // Check existing tracked positions for exit signals
    if (trackedPositions[symbol]) {
      const position = trackedPositions[symbol];

      // Update peak price if current price is higher
      if (currentPrice > position.peakPrice) {
        position.peakPrice = currentPrice;
        position.exitWarningShown = false; // Reset warning when new peak
        positionsUpdated = true;
      }

      // Check if price is falling toward exit warning level (entry + 1.5%)
      // Only warn if:
      // 1. Price has gone above exit level at some point (peakPrice > exitWarningLevel)
      // 2. Price is now falling back toward exit level
      // 3. We haven't already shown this warning
      const exitWarningLevel = position.exitWarningLevel;
      const isNearExitLevel = currentPrice <= exitWarningLevel * 1.02; // Within 2% of exit level
      const hasFallenFromPeak = position.peakPrice > exitWarningLevel && currentPrice < position.peakPrice;

      if (hasFallenFromPeak && isNearExitLevel && !position.exitWarningShown) {
        const profitFromEntry = ((currentPrice - position.entryPrice) / position.entryPrice * 100).toFixed(2);
        const dropFromPeak = ((position.peakPrice - currentPrice) / position.peakPrice * 100).toFixed(2);

        exitWarnings.push({
          symbol: symbol,
          companyName: position.companyName,
          currentPrice: currentPrice,
          entryPrice: position.entryPrice,
          peakPrice: position.peakPrice,
          exitWarningLevel: exitWarningLevel,
          profitFromEntry: profitFromEntry,
          dropFromPeak: dropFromPeak
        });

        position.exitWarningShown = true;
        positionsUpdated = true;
      }

      // Check if price has fallen to or below exit level - critical alert
      if (currentPrice <= exitWarningLevel) {
        const exitNowKey = `${symbol}-EXIT-NOW-${today}`;
        if (!notifiedSignals[exitNowKey]) {
          await sendNotificationToAll(
            `EXIT NOW: ${symbol}`,
            `Price at exit level: ${currentPrice.toFixed(2)}\nEntry: ${position.entryPrice.toFixed(2)} | Exit at: ${exitWarningLevel.toFixed(2)}`,
            { soundType: 'exit', tag: `exit-now-${symbol}` }
          );
          notifiedSignals[exitNowKey] = Date.now();
        }
      }
    }
  }

  // Send notifications for new BUY signals
  for (const signal of newBuySignals) {
    await sendNotificationToAll(
      `BUY Signal: ${signal.symbol}`,
      `Up ${signal.changePercent.toFixed(2)}% from open!\nPrice: ${signal.entryPrice.toFixed(2)} | Exit alert at: ${(signal.entryPrice * (1 + EXIT_THRESHOLD / 100)).toFixed(2)}`,
      { soundType: 'buy', tag: `buy-${signal.symbol}` }
    );
  }

  // Send exit warning notifications
  for (const warning of exitWarnings) {
    await sendNotificationToAll(
      `EXIT WARNING: ${warning.symbol}`,
      `Price falling! Now: ${warning.currentPrice.toFixed(2)}\nPeak: ${warning.peakPrice.toFixed(2)} (down ${warning.dropFromPeak}%)\nExit level: ${warning.exitWarningLevel.toFixed(2)}`,
      { soundType: 'exit', tag: `exit-warning-${warning.symbol}` }
    );
  }

  // Save updated data
  if (newBuySignals.length > 0 || exitWarnings.length > 0) {
    saveNotifiedSignals(notifiedSignals);
  }
  if (positionsUpdated) {
    saveTrackedPositions(trackedPositions);
  }

  const result = {
    buySignals: newBuySignals.length,
    sellSignals: 0,
    exitWarnings: exitWarnings.length
  };

  if (result.buySignals > 0 || result.exitWarnings > 0) {
    console.log(`[Push] Notified: ${result.buySignals} BUY, ${result.exitWarnings} EXIT warnings`);
  }

  return result;
}

// Get subscription count
function getSubscriptionCount() {
  return subscriptions.length;
}

// Get tracked positions count
function getTrackedPositionsCount() {
  return Object.keys(trackedPositions).length;
}

// Clear daily data (call at market open)
function clearDailyNotifications() {
  notifiedSignals = {};
  trackedPositions = {};
  saveNotifiedSignals(notifiedSignals);
  saveTrackedPositions(trackedPositions);
  console.log('[Push] Cleared daily notification history and tracked positions');
}

module.exports = {
  getPublicKey,
  addSubscription,
  removeSubscription,
  sendNotificationToAll,
  notifyNewSignals,
  getSubscriptionCount,
  getTrackedPositionsCount,
  clearDailyNotifications
};
