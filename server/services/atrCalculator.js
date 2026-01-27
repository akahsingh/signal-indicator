class ATRCalculator {
  /**
   * Calculate True Range for a single candle
   * True Range = max(High - Low, |High - Previous Close|, |Low - Previous Close|)
   */
  calculateTrueRange(current, previousClose) {
    const highLow = current.high - current.low;
    const highPrevClose = Math.abs(current.high - previousClose);
    const lowPrevClose = Math.abs(current.low - previousClose);

    return Math.max(highLow, highPrevClose, lowPrevClose);
  }

  /**
   * Calculate Average True Range (ATR)
   * @param {Array} data - Array of OHLC data [{open, high, low, close}, ...]
   * @param {number} period - ATR period (typically 14)
   * @returns {number} - ATR value
   */
  calculateATR(data, period = 14) {
    if (!data || data.length < period + 1) {
      // Not enough data, return a default ATR based on last candle's range
      if (data && data.length > 0) {
        const lastCandle = data[data.length - 1];
        return (lastCandle.high - lastCandle.low) * 1.5;
      }
      return 0;
    }

    // Calculate True Range for each candle (starting from index 1)
    const trueRanges = [];
    for (let i = 1; i < data.length; i++) {
      const tr = this.calculateTrueRange(data[i], data[i - 1].close);
      trueRanges.push(tr);
    }

    // Take the last 'period' true ranges
    const recentTRs = trueRanges.slice(-period);

    // Calculate simple average (SMA-based ATR)
    const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;

    return atr;
  }

  /**
   * Calculate Exponential ATR (Wilder's smoothing)
   * More responsive to recent price changes
   */
  calculateExponentialATR(data, period = 14) {
    if (!data || data.length < period + 1) {
      return this.calculateATR(data, period);
    }

    // Calculate True Range for each candle
    const trueRanges = [];
    for (let i = 1; i < data.length; i++) {
      const tr = this.calculateTrueRange(data[i], data[i - 1].close);
      trueRanges.push(tr);
    }

    // Calculate initial ATR as SMA of first 'period' TRs
    let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;

    // Apply Wilder's smoothing for remaining TRs
    const multiplier = 1 / period;
    for (let i = period; i < trueRanges.length; i++) {
      atr = (trueRanges[i] * multiplier) + (atr * (1 - multiplier));
    }

    return atr;
  }

  /**
   * Calculate stop loss based on ATR
   */
  calculateStopLoss(entryPrice, atr, multiplier, isBuy) {
    if (isBuy) {
      return entryPrice - (atr * multiplier);
    } else {
      return entryPrice + (atr * multiplier);
    }
  }

  /**
   * Calculate target based on ATR
   */
  calculateTarget(entryPrice, atr, multiplier, isBuy) {
    if (isBuy) {
      return entryPrice + (atr * multiplier);
    } else {
      return entryPrice - (atr * multiplier);
    }
  }

  /**
   * Get all levels (SL and multiple targets) for a trade
   */
  getLevels(entryPrice, atr, slMultiplier, targetMultipliers, isBuy) {
    const stopLoss = this.calculateStopLoss(entryPrice, atr, slMultiplier, isBuy);
    const targets = targetMultipliers.map(mult =>
      this.calculateTarget(entryPrice, atr, mult, isBuy)
    );

    return {
      entryPrice,
      stopLoss,
      targets,
      atr,
      risk: Math.abs(entryPrice - stopLoss),
      rewards: targets.map(t => Math.abs(t - entryPrice))
    };
  }
}

module.exports = new ATRCalculator();
