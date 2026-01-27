const axios = require('axios');
const config = require('../config');

class NSEDataService {
  constructor() {
    this.cookies = '';
    this.lastCookieRefresh = 0;
    this.cookieRefreshInterval = 300000; // 5 minutes
    this.cache = {
      stockList: null,
      stockListTimestamp: 0,
      historicalData: new Map()
    };
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async refreshCookies() {
    try {
      const response = await axios.get(config.NSE_BASE_URL, {
        headers: config.NSE_HEADERS,
        timeout: 10000
      });

      const setCookies = response.headers['set-cookie'];
      if (setCookies) {
        this.cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
        this.lastCookieRefresh = Date.now();
        console.log('NSE cookies refreshed successfully');
      }
      return true;
    } catch (error) {
      console.error('Error refreshing cookies:', error.message);
      return false;
    }
  }

  async ensureCookies() {
    if (!this.cookies || Date.now() - this.lastCookieRefresh > this.cookieRefreshInterval) {
      await this.refreshCookies();
    }
  }

  getHeaders() {
    return {
      ...config.NSE_HEADERS,
      'Cookie': this.cookies
    };
  }

  async fetchWithRetry(url, retries = 3) {
    await this.ensureCookies();

    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          headers: this.getHeaders(),
          timeout: 15000
        });
        return response.data;
      } catch (error) {
        if (i === retries - 1) throw error;

        // Refresh cookies and retry
        console.log(`Retry ${i + 1}/${retries} for ${url}`);
        await this.refreshCookies();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async getNifty500Stocks() {
    // Check cache
    if (this.cache.stockList && Date.now() - this.cache.stockListTimestamp < this.cacheTimeout) {
      return this.cache.stockList;
    }

    try {
      const url = `${config.NSE_BASE_URL}/api/equity-stockIndices?index=NIFTY%20500`;
      const data = await this.fetchWithRetry(url);

      if (data && data.data) {
        const stocks = data.data.map(stock => ({
          symbol: stock.symbol,
          companyName: stock.meta?.companyName || stock.symbol,
          open: stock.open,
          high: stock.dayHigh,
          low: stock.dayLow,
          close: stock.lastPrice,
          previousClose: stock.previousClose,
          change: stock.change,
          changePercent: stock.pChange,
          volume: stock.totalTradedVolume,
          timestamp: new Date().toISOString()
        }));

        this.cache.stockList = stocks;
        this.cache.stockListTimestamp = Date.now();

        return stocks;
      }

      throw new Error('Invalid response from NSE');
    } catch (error) {
      console.error('Error fetching NIFTY 500 stocks:', error.message);
      throw error;
    }
  }

  async getStockQuote(symbol) {
    try {
      const url = `${config.NSE_BASE_URL}/api/quote-equity?symbol=${encodeURIComponent(symbol)}`;
      const data = await this.fetchWithRetry(url);

      if (data && data.priceInfo) {
        return {
          symbol: data.info?.symbol || symbol,
          companyName: data.info?.companyName || symbol,
          open: data.priceInfo.open,
          high: data.priceInfo.intraDayHighLow?.max,
          low: data.priceInfo.intraDayHighLow?.min,
          close: data.priceInfo.lastPrice,
          previousClose: data.priceInfo.previousClose,
          change: data.priceInfo.change,
          changePercent: data.priceInfo.pChange,
          volume: data.preOpenMarket?.totalTradedVolume || 0
        };
      }

      throw new Error(`No data found for symbol: ${symbol}`);
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  async getHistoricalData(symbol, days = 20) {
    const cacheKey = `${symbol}_${days}`;

    // Check cache
    const cached = this.cache.historicalData.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout * 5) {
      return cached.data;
    }

    try {
      // NSE historical data endpoint
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days * 2); // Extra days for weekends/holidays

      const from = fromDate.toISOString().split('T')[0].split('-').reverse().join('-');
      const to = toDate.toISOString().split('T')[0].split('-').reverse().join('-');

      const url = `${config.NSE_BASE_URL}/api/historical/cm/equity?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`;
      const data = await this.fetchWithRetry(url);

      if (data && data.data) {
        const historicalData = data.data
          .slice(0, days)
          .map(item => ({
            date: item.CH_TIMESTAMP,
            open: item.CH_OPENING_PRICE,
            high: item.CH_TRADE_HIGH_PRICE,
            low: item.CH_TRADE_LOW_PRICE,
            close: item.CH_CLOSING_PRICE,
            volume: item.CH_TOT_TRADED_QTY
          }))
          .reverse();

        this.cache.historicalData.set(cacheKey, {
          data: historicalData,
          timestamp: Date.now()
        });

        return historicalData;
      }

      return [];
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

module.exports = new NSEDataService();
