const config = require('../config');
const nseData = require('./nseData');
const atrCalculator = require('./atrCalculator');

class StockAnalyzer {
  async analyzeStocks() {
    try {
      const stocks = await nseData.getNifty500Stocks();

      // Filter stocks with significant price change
      const significantStocks = stocks.filter(stock =>
        Math.abs(stock.changePercent) >= config.MIN_PRICE_CHANGE
      );

      // Sort by absolute change percentage (highest movers first)
      significantStocks.sort((a, b) =>
        Math.abs(b.changePercent) - Math.abs(a.changePercent)
      );

      // Generate signals for each stock
      const signals = await Promise.all(
        significantStocks.map(stock => this.generateSignal(stock))
      );

      return signals.filter(signal => signal !== null);
    } catch (error) {
      console.error('Error analyzing stocks:', error.message);
      throw error;
    }
  }

  async generateSignal(stock) {
    try {
      const signalType = stock.changePercent > 0 ? 'BUY' : 'SELL';
      const entryPrice = stock.close;

      // Get historical data for ATR calculation
      const historicalData = await nseData.getHistoricalData(stock.symbol, config.ATR_PERIOD + 1);

      // Add today's data to historical for complete picture
      const fullData = [
        ...historicalData,
        {
          date: new Date().toISOString().split('T')[0],
          open: stock.open,
          high: stock.high,
          low: stock.low,
          close: stock.close
        }
      ];

      // Calculate ATR
      const atr = atrCalculator.calculateATR(fullData, config.ATR_PERIOD);

      // Calculate stop loss and targets
      let stopLoss, target1, target2;

      if (signalType === 'BUY') {
        stopLoss = entryPrice - (atr * config.ATR_SL_MULTIPLIER);
        target1 = entryPrice + (atr * config.ATR_TARGET_MULTIPLIERS[0]);
        target2 = entryPrice + (atr * config.ATR_TARGET_MULTIPLIERS[1]);
      } else {
        stopLoss = entryPrice + (atr * config.ATR_SL_MULTIPLIER);
        target1 = entryPrice - (atr * config.ATR_TARGET_MULTIPLIERS[0]);
        target2 = entryPrice - (atr * config.ATR_TARGET_MULTIPLIERS[1]);
      }

      // Calculate risk-reward ratios
      const risk = Math.abs(entryPrice - stopLoss);
      const reward1 = Math.abs(target1 - entryPrice);
      const reward2 = Math.abs(target2 - entryPrice);

      return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        signalType,
        entryPrice: this.roundPrice(entryPrice),
        stopLoss: this.roundPrice(stopLoss),
        target1: this.roundPrice(target1),
        target2: this.roundPrice(target2),
        atr: this.roundPrice(atr),
        changePercent: this.roundPrice(stock.changePercent),
        volume: stock.volume,
        riskReward1: `1:${this.roundPrice(reward1 / risk)}`,
        riskReward2: `1:${this.roundPrice(reward2 / risk)}`,
        open: stock.open,
        high: stock.high,
        low: stock.low,
        previousClose: stock.previousClose,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error generating signal for ${stock.symbol}:`, error.message);
      return null;
    }
  }

  roundPrice(value) {
    return Math.round(value * 100) / 100;
  }

  filterSignals(signals, type) {
    if (!type) return signals;

    if (type === 'bullish') {
      return signals.filter(s => s.signalType === 'BUY');
    } else if (type === 'bearish') {
      return signals.filter(s => s.signalType === 'SELL');
    }

    return signals;
  }

  getSignalBySymbol(signals, symbol) {
    return signals.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
  }
}

module.exports = new StockAnalyzer();
