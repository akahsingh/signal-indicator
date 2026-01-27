const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const stocksRouter = require('./routes/stocks');

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
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
