const axios = require('axios');

// List of NIFTY 500 stock symbols (top 100 most traded for faster loading)
const NIFTY_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'SBIN', 'BHARTIARTL',
  'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA',
  'TITAN', 'BAJFINANCE', 'ULTRACEMCO', 'WIPRO', 'NESTLEIND', 'ONGC', 'NTPC', 'POWERGRID',
  'M&M', 'TATAMOTORS', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT', 'ADANIPORTS', 'TECHM',
  'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'CIPLA', 'BAJAJFINSV', 'GRASIM', 'DIVISLAB',
  'BPCL', 'BRITANNIA', 'EICHERMOT', 'APOLLOHOSP', 'COALINDIA', 'TATACONSUM', 'HEROMOTOCO',
  'SBILIFE', 'HDFCLIFE', 'DABUR', 'PIDILITIND', 'HAVELLS', 'SIEMENS', 'GODREJCP',
  'DLF', 'INDUSTOWER', 'BANKBARODA', 'ICICIGI', 'BAJAJ-AUTO', 'AMBUJACEM', 'SHREECEM',
  'VEDL', 'JINDALSTEL', 'TRENT', 'ZOMATO', 'PAYTM', 'NYKAA', 'POLICYBZR', 'DELHIVERY',
  'IRCTC', 'HAL', 'BEL', 'BHEL', 'GAIL', 'IOC', 'RECLTD', 'PFC', 'NHPC', 'SJVN',
  'TATAPOWER', 'ADANIGREEN', 'ADANIPOWER', 'TORNTPOWER', 'CUMMINSIND', 'VOLTAS',
  'BLUESTARCO', 'CROMPTON', 'WHIRLPOOL', 'BATAINDIA', 'RELAXO', 'PAGEIND', 'ABFRL',
  'MPHASIS', 'LTIM', 'COFORGE', 'PERSISTENT', 'LTTS', 'ZYDUSLIFE', 'AUROPHARMA',
  'LUPIN', 'BIOCON', 'ALKEM', 'TORNTPHARM'
];

class YahooFinanceService {
  constructor() {
    this.cache = {
      stockList: null,
      stockListTimestamp: 0,
      historicalData: new Map()
    };
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async fetchStockData(symbol) {
    try {
      const yahooSymbol = `${symbol}.NS`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const result = response.data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators.quote[0];

      // Get the latest values
      const lastIndex = quote.close.length - 1;
      const currentPrice = meta.regularMarketPrice || quote.close[lastIndex];
      const previousClose = meta.chartPreviousClose || meta.previousClose;
      const openPrice = quote.open[0] || meta.regularMarketOpen || previousClose;

      return {
        symbol: symbol,
        companyName: meta.shortName || meta.longName || symbol,
        open: openPrice,
        high: meta.regularMarketDayHigh || Math.max(...quote.high.filter(h => h)),
        low: meta.regularMarketDayLow || Math.min(...quote.low.filter(l => l)),
        close: currentPrice,
        previousClose: previousClose,
        change: currentPrice - previousClose,
        changePercent: ((currentPrice - previousClose) / previousClose) * 100,
        volume: meta.regularMarketVolume || quote.volume[lastIndex] || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching ${symbol}:`, error.message);
      return null;
    }
  }

  async getNifty500Stocks() {
    // Check cache
    if (this.cache.stockList && Date.now() - this.cache.stockListTimestamp < this.cacheTimeout) {
      return this.cache.stockList;
    }

    console.log('Fetching stock data from Yahoo Finance...');

    // Fetch stocks in batches to avoid rate limiting
    const batchSize = 10;
    const stocks = [];

    for (let i = 0; i < NIFTY_SYMBOLS.length; i += batchSize) {
      const batch = NIFTY_SYMBOLS.slice(i, i + batchSize);
      const promises = batch.map(symbol => this.fetchStockData(symbol));
      const results = await Promise.all(promises);

      results.forEach(stock => {
        if (stock) stocks.push(stock);
      });

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < NIFTY_SYMBOLS.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${stocks.length} stocks from Yahoo Finance`);

    this.cache.stockList = stocks;
    this.cache.stockListTimestamp = Date.now();

    return stocks;
  }

  async getStockQuote(symbol) {
    return await this.fetchStockData(symbol);
  }

  async getHistoricalData(symbol, days = 20) {
    const cacheKey = `${symbol}_${days}`;

    // Check cache
    const cached = this.cache.historicalData.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout * 5) {
      return cached.data;
    }

    try {
      const yahooSymbol = `${symbol}.NS`;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1mo`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quote = result.indicators.quote[0];

      const historicalData = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i]
      })).filter(d => d.close !== null).slice(-days);

      this.cache.historicalData.set(cacheKey, {
        data: historicalData,
        timestamp: Date.now()
      });

      return historicalData;
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error.message);
      return [];
    }
  }

  clearCache() {
    this.cache.stockList = null;
    this.cache.stockListTimestamp = 0;
    this.cache.historicalData.clear();
  }
}

module.exports = new YahooFinanceService();
