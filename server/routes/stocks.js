const express = require('express');
const router = express.Router();
const stockAnalyzer = require('../services/stockAnalyzer');
const signalHistory = require('../services/signalHistory');
const pushNotification = require('../services/pushNotification');

// In-memory cache for signals
let signalsCache = {
  data: [],
  timestamp: 0
};
const CACHE_DURATION = 60000; // 1 minute

// GET /api/signals - Get all current signals
router.get('/signals', async (req, res) => {
  try {
    const { type } = req.query;

    // Check cache
    if (signalsCache.data.length > 0 && Date.now() - signalsCache.timestamp < CACHE_DURATION) {
      const filtered = stockAnalyzer.filterSignals(signalsCache.data, type);
      return res.json({
        success: true,
        count: filtered.length,
        lastUpdated: new Date(signalsCache.timestamp).toISOString(),
        signals: filtered
      });
    }

    // Fetch fresh data
    const signals = await stockAnalyzer.analyzeStocks();

    // Update cache
    signalsCache = {
      data: signals,
      timestamp: Date.now()
    };

    // Save to history
    signalHistory.saveSignals(signals);

    const filtered = stockAnalyzer.filterSignals(signals, type);

    res.json({
      success: true,
      count: filtered.length,
      lastUpdated: new Date().toISOString(),
      signals: filtered
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signals',
      message: error.message
    });
  }
});

// GET /api/stock/:symbol - Get signal for specific stock
router.get('/stock/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    // Check cache first
    if (signalsCache.data.length > 0) {
      const signal = stockAnalyzer.getSignalBySymbol(signalsCache.data, symbol);
      if (signal) {
        return res.json({
          success: true,
          signal
        });
      }
    }

    // Fetch fresh data if not in cache
    const signals = await stockAnalyzer.analyzeStocks();
    signalsCache = {
      data: signals,
      timestamp: Date.now()
    };

    const signal = stockAnalyzer.getSignalBySymbol(signals, symbol);

    if (signal) {
      res.json({
        success: true,
        signal
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No signal found for symbol: ${symbol}. Stock may not meet the ${process.env.MIN_PRICE_CHANGE || 3}% threshold.`
      });
    }
  } catch (error) {
    console.error(`Error fetching signal for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch signal',
      message: error.message
    });
  }
});

// GET /api/refresh - Force refresh signals
router.get('/refresh', async (req, res) => {
  try {
    const signals = await stockAnalyzer.analyzeStocks();

    signalsCache = {
      data: signals,
      timestamp: Date.now()
    };

    res.json({
      success: true,
      message: 'Signals refreshed successfully',
      count: signals.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing signals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh signals',
      message: error.message
    });
  }
});

// GET /api/health - Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    cacheAge: signalsCache.timestamp ? Date.now() - signalsCache.timestamp : null,
    signalsCount: signalsCache.data.length
  });
});

// GET /api/history - Get signal history
router.get('/history', (req, res) => {
  try {
    const { days = 7, symbol, type } = req.query;
    const history = signalHistory.getHistory({
      days: parseInt(days),
      symbol,
      signalType: type
    });

    res.json({
      success: true,
      count: history.length,
      signals: history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
      message: error.message
    });
  }
});

// GET /api/stats - Get signal statistics
router.get('/stats', (req, res) => {
  try {
    const stats = signalHistory.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

// GET /api/push/vapid-public-key - Get VAPID public key for push subscription
router.get('/push/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: pushNotification.getPublicKey()
  });
});

// POST /api/push/subscribe - Subscribe to push notifications
router.post('/push/subscribe', (req, res) => {
  try {
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription object'
      });
    }

    pushNotification.addSubscription(subscription);

    res.json({
      success: true,
      message: 'Subscribed to push notifications'
    });
  } catch (error) {
    console.error('Error subscribing to push:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe',
      message: error.message
    });
  }
});

// POST /api/push/unsubscribe - Unsubscribe from push notifications
router.post('/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint required'
      });
    }

    pushNotification.removeSubscription(endpoint);

    res.json({
      success: true,
      message: 'Unsubscribed from push notifications'
    });
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe',
      message: error.message
    });
  }
});

// GET /api/push/status - Get push notification status
router.get('/push/status', (req, res) => {
  res.json({
    success: true,
    subscriberCount: pushNotification.getSubscriptionCount()
  });
});

module.exports = router;
