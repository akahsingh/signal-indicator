const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const config = require('./config');
const stocksRouter = require('./routes/stocks');
const stockAnalyzer = require('./services/stockAnalyzer');
const pushNotification = require('./services/pushNotification');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api', stocksRouter);

// Root route - serve dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Background job: Check signals and send push notifications every 5 minutes during market hours
// Market hours: 9:15 AM to 3:30 PM IST (Monday to Friday)
cron.schedule('*/5 9-15 * * 1-5', async () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Skip if outside market hours (9:15 AM to 3:30 PM)
  if (timeInMinutes < 9 * 60 + 15 || timeInMinutes > 15 * 60 + 30) {
    return;
  }

  console.log('[Cron] Checking for new signals...');
  try {
    const signals = await stockAnalyzer.analyzeStocks();
    if (signals && signals.length > 0) {
      const result = await pushNotification.notifyNewSignals(signals);
      if (result.buySignals > 0 || result.sellSignals > 0) {
        console.log(`[Cron] Sent notifications: ${result.buySignals} BUY, ${result.sellSignals} SELL`);
      }
    }
  } catch (error) {
    console.error('[Cron] Error checking signals:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Clear notification history at market open (9:15 AM IST on weekdays)
cron.schedule('15 9 * * 1-5', () => {
  console.log('[Cron] Market open - clearing daily notification history');
  pushNotification.clearDailyNotifications();
}, {
  timezone: 'Asia/Kolkata'
});

// Start server
app.listen(config.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   📈 Intraday Signal Indicator Server                      ║
║                                                            ║
║   Dashboard: http://localhost:${config.PORT}                       ║
║   API:       http://localhost:${config.PORT}/api/signals           ║
║                                                            ║
║   Configuration:                                           ║
║   • Stock Index: ${config.STOCK_INDEX.padEnd(20)}                 ║
║   • Min Price Change: ${config.MIN_PRICE_CHANGE}%                              ║
║   • ATR Period: ${config.ATR_PERIOD}                                       ║
║   • SL Multiplier: ${config.ATR_SL_MULTIPLIER}x ATR                           ║
║   • Target Multipliers: ${config.ATR_TARGET_MULTIPLIERS.join('x, ')}x ATR                   ║
║   • Push Notifications: ENABLED (every 5 min)              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
