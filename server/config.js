module.exports = {
  // Stock universe to scan
  STOCK_INDEX: process.env.STOCK_INDEX || 'NIFTY 500',

  // Minimum price % change to trigger a signal
  MIN_PRICE_CHANGE: parseFloat(process.env.MIN_PRICE_CHANGE) || 3,

  // ATR calculation period (number of candles)
  ATR_PERIOD: parseInt(process.env.ATR_PERIOD) || 14,

  // Stop loss multiplier (SL = Entry - ATR * multiplier)
  ATR_SL_MULTIPLIER: parseFloat(process.env.ATR_SL_MULTIPLIER) || 1.5,

  // Target multipliers [Target1, Target2]
  ATR_TARGET_MULTIPLIERS: [2, 3],

  // Data refresh interval in milliseconds (5 minutes)
  REFRESH_INTERVAL: parseInt(process.env.REFRESH_INTERVAL) || 300000,

  // Server port (use PORT env var for cloud deployment)
  PORT: parseInt(process.env.PORT) || 3000,

  // NSE API base URL
  NSE_BASE_URL: 'https://www.nseindia.com',

  // Request headers for NSE API
  NSE_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.nseindia.com/',
    'Connection': 'keep-alive'
  }
};
