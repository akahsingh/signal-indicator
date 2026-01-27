const fs = require('fs');
const path = require('path');

class SignalHistory {
  constructor() {
    this.historyFile = path.join(__dirname, '..', '..', 'data', 'signal-history.json');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.historyFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify({ signals: [] }, null, 2));
    }
  }

  loadHistory() {
    try {
      const data = fs.readFileSync(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return { signals: [] };
    }
  }

  saveHistory(history) {
    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Save signals to history
   * Only saves if signal doesn't already exist for same symbol and date
   */
  saveSignals(signals) {
    const history = this.loadHistory();
    const today = new Date().toISOString().split('T')[0];

    let newCount = 0;
    signals.forEach(signal => {
      // Check if signal already exists for this symbol and date
      const exists = history.signals.some(s =>
        s.symbol === signal.symbol && s.date === today
      );

      if (!exists) {
        history.signals.push({
          ...signal,
          date: today,
          savedAt: new Date().toISOString(),
          status: 'active' // active, target1_hit, target2_hit, sl_hit
        });
        newCount++;
      }
    });

    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    history.signals = history.signals.filter(s =>
      new Date(s.date) >= thirtyDaysAgo
    );

    this.saveHistory(history);
    return newCount;
  }

  /**
   * Get signal history with optional filters
   */
  getHistory(options = {}) {
    const { days = 7, symbol = null, signalType = null } = options;
    const history = this.loadHistory();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let filtered = history.signals.filter(s =>
      new Date(s.date) >= cutoffDate
    );

    if (symbol) {
      filtered = filtered.filter(s =>
        s.symbol.toUpperCase() === symbol.toUpperCase()
      );
    }

    if (signalType) {
      filtered = filtered.filter(s =>
        s.signalType === signalType.toUpperCase()
      );
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    return filtered;
  }

  /**
   * Get today's signals
   */
  getTodaySignals() {
    const today = new Date().toISOString().split('T')[0];
    const history = this.loadHistory();
    return history.signals.filter(s => s.date === today);
  }

  /**
   * Update signal status (for tracking if target/SL was hit)
   */
  updateSignalStatus(symbol, date, status) {
    const history = this.loadHistory();
    const signal = history.signals.find(s =>
      s.symbol === symbol && s.date === date
    );

    if (signal) {
      signal.status = status;
      signal.updatedAt = new Date().toISOString();
      this.saveHistory(history);
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats() {
    const history = this.loadHistory();
    const signals = history.signals;

    const stats = {
      totalSignals: signals.length,
      buySignals: signals.filter(s => s.signalType === 'BUY').length,
      sellSignals: signals.filter(s => s.signalType === 'SELL').length,
      target1Hit: signals.filter(s => s.status === 'target1_hit').length,
      target2Hit: signals.filter(s => s.status === 'target2_hit').length,
      slHit: signals.filter(s => s.status === 'sl_hit').length,
      uniqueStocks: [...new Set(signals.map(s => s.symbol))].length,
      dateRange: {
        from: signals.length > 0 ? signals[signals.length - 1].date : null,
        to: signals.length > 0 ? signals[0].date : null
      }
    };

    return stats;
  }
}

module.exports = new SignalHistory();
