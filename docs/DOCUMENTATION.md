# Intraday Stock Signal Indicator
## Complete Project Documentation

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Key Concepts Used](#2-key-concepts-used)
3. [Architecture](#3-architecture)
4. [How It Works - Step by Step](#4-how-it-works---step-by-step)
5. [File Structure](#5-file-structure)
6. [API Reference](#6-api-reference)
7. [Technologies Used](#7-technologies-used)
8. [Deployment Guide](#8-deployment-guide)

---

## 1. Project Overview

### What is this project?
An **Intraday Stock Signal Indicator** that automatically identifies high-performing stocks from NIFTY 500 and provides:
- **BUY/SELL signals** based on price movement
- **Stop Loss levels** calculated using ATR (Average True Range)
- **Profit targets** with risk-reward ratios

### Who is it for?
Intraday traders who want quick signals for stocks showing significant price movements.

### Key Features
| Feature | Description |
|---------|-------------|
| Auto-detection | Finds stocks with ≥3% price change |
| ATR-based levels | Scientific stop loss and targets |
| Real-time data | Fetches live data from NSE India |
| Signal history | Tracks past signals for review |
| Web dashboard | Easy-to-use browser interface |

---

## 2. Key Concepts Used

### 2.1 ATR (Average True Range)

**What is ATR?**
ATR measures market volatility - how much a stock typically moves in a day.

**Formula:**
```
True Range (TR) = Maximum of:
  1. Current High - Current Low
  2. |Current High - Previous Close|
  3. |Current Low - Previous Close|

ATR = Average of last 14 True Ranges
```

**Example:**
```
RELIANCE stock data:
Day 1: High=2520, Low=2480, Prev Close=2490
       TR = max(40, 30, 10) = 40

Day 2: High=2530, Low=2495, Prev Close=2500
       TR = max(35, 30, 5) = 35

... (14 days)

ATR = Average of 14 TRs = 38.5
```

**Why use ATR?**
- Adapts to each stock's volatility
- Volatile stocks get wider stop losses
- Stable stocks get tighter stop losses

---

### 2.2 Stop Loss & Target Calculation

**For BUY signals (stock going UP):**
```
Entry Price    = Current Price (e.g., ₹2,500)
ATR            = 40

Stop Loss      = Entry - (ATR × 1.5)
               = 2500 - (40 × 1.5)
               = 2500 - 60
               = ₹2,440

Target 1       = Entry + (ATR × 2)
               = 2500 + (40 × 2)
               = ₹2,580

Target 2       = Entry + (ATR × 3)
               = 2500 + (40 × 3)
               = ₹2,620
```

**For SELL signals (stock going DOWN):**
```
Entry Price    = Current Price (e.g., ₹2,500)
ATR            = 40

Stop Loss      = Entry + (ATR × 1.5)
               = 2500 + 60
               = ₹2,560

Target 1       = Entry - (ATR × 2)
               = 2500 - 80
               = ₹2,420

Target 2       = Entry - (ATR × 3)
               = 2500 - 120
               = ₹2,380
```

---

### 2.3 Risk-Reward Ratio

```
Risk    = |Entry - Stop Loss| = 60
Reward1 = |Target1 - Entry|   = 80
Reward2 = |Target2 - Entry|   = 120

R:R for Target 1 = 1:1.33 (Risk 60, Reward 80)
R:R for Target 2 = 1:2    (Risk 60, Reward 120)
```

**Meaning:** For every ₹1 you risk, you can potentially gain ₹1.33 or ₹2.

---

## 3. Architecture

### 3.1 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                        │
│                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│   │ index.html  │  │ styles.css  │  │   app.js    │        │
│   │ (Structure) │  │  (Design)   │  │  (Logic)    │        │
│   └─────────────┘  └─────────────┘  └─────────────┘        │
│                           │                                  │
│                    fetch('/api/signals')                     │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      EXPRESS SERVER                          │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   routes/stocks.js                   │   │
│   │              (API Endpoints Handler)                 │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│              ┌─────────────┼─────────────┐                  │
│              ▼             ▼             ▼                  │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│   │  nseData.js  │ │stockAnalyzer │ │atrCalculator │       │
│   │ (Fetch Data) │ │  (Filter)    │ │ (Calculate)  │       │
│   └──────────────┘ └──────────────┘ └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                      NSE INDIA API                           │
│                                                              │
│   https://www.nseindia.com/api/equity-stockIndices           │
│   (Returns NIFTY 500 stock data)                             │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.2 Data Flow Diagram

```
Step 1: User opens website
        │
        ▼
Step 2: Browser loads index.html
        │
        ▼
Step 3: app.js calls fetch('/api/signals')
        │
        ▼
Step 4: Server receives request at routes/stocks.js
        │
        ▼
Step 5: stockAnalyzer.analyzeStocks() is called
        │
        ├──► nseData.getNifty500Stocks()
        │         │
        │         ▼
        │    Fetches 500 stocks from NSE India
        │         │
        │         ▼
        │    Returns: [{symbol, price, change%, high, low}, ...]
        │
        ▼
Step 6: Filter stocks with ≥3% change
        │
        │    500 stocks ──► Filter ──► ~5-15 stocks
        │
        ▼
Step 7: For each filtered stock:
        │
        ├──► Get 14-day historical data
        ├──► Calculate ATR
        ├──► Calculate Stop Loss
        ├──► Calculate Targets
        │
        ▼
Step 8: Return signals as JSON
        │
        ▼
Step 9: Browser receives JSON, renders cards
        │
        ▼
Step 10: User sees BUY/SELL signals with levels
```

---

## 4. How It Works - Step by Step

### Step 1: Fetch Stock Data from NSE

```javascript
// nseData.js

// First, get cookies (NSE requires this)
async refreshCookies() {
  await axios.get('https://www.nseindia.com');
  // Save cookies for future requests
}

// Then fetch NIFTY 500 stocks
async getNifty500Stocks() {
  const url = 'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20500';
  const response = await axios.get(url, { headers: this.getHeaders() });

  // Response contains 500 stocks with:
  // - symbol (RELIANCE, TCS, etc.)
  // - lastPrice (current price)
  // - pChange (today's % change)
  // - dayHigh, dayLow, open, close
}
```

---

### Step 2: Filter Significant Stocks

```javascript
// stockAnalyzer.js

async analyzeStocks() {
  const stocks = await nseData.getNifty500Stocks();

  // Keep only stocks with ≥3% change
  const significant = stocks.filter(stock =>
    Math.abs(stock.changePercent) >= 3
  );

  // Sort by biggest movers first
  significant.sort((a, b) =>
    Math.abs(b.changePercent) - Math.abs(a.changePercent)
  );

  return significant;
}
```

**Example:**
```
Input: 500 stocks
       RELIANCE: +1.2%  ❌ (below 3%)
       TCS: -0.5%       ❌ (below 3%)
       ADANI: +5.8%     ✓ (above 3%)
       TATA: -4.2%      ✓ (above 3%)
       HDFC: +3.1%      ✓ (above 3%)

Output: 3 stocks [ADANI, TATA, HDFC]
```

---

### Step 3: Calculate ATR for Each Stock

```javascript
// atrCalculator.js

calculateATR(data, period = 14) {
  const trueRanges = [];

  for (let i = 1; i < data.length; i++) {
    // True Range calculation
    const highLow = data[i].high - data[i].low;
    const highPrevClose = Math.abs(data[i].high - data[i-1].close);
    const lowPrevClose = Math.abs(data[i].low - data[i-1].close);

    const tr = Math.max(highLow, highPrevClose, lowPrevClose);
    trueRanges.push(tr);
  }

  // Average of last 14 true ranges
  const atr = trueRanges.slice(-14).reduce((a, b) => a + b) / 14;
  return atr;
}
```

---

### Step 4: Generate Signal with Levels

```javascript
// stockAnalyzer.js

generateSignal(stock) {
  const signalType = stock.changePercent > 0 ? 'BUY' : 'SELL';
  const entry = stock.close;
  const atr = atrCalculator.calculateATR(historicalData);

  if (signalType === 'BUY') {
    return {
      symbol: stock.symbol,
      signalType: 'BUY',
      entryPrice: entry,
      stopLoss: entry - (atr * 1.5),
      target1: entry + (atr * 2),
      target2: entry + (atr * 3),
      atr: atr
    };
  } else {
    return {
      symbol: stock.symbol,
      signalType: 'SELL',
      entryPrice: entry,
      stopLoss: entry + (atr * 1.5),
      target1: entry - (atr * 2),
      target2: entry - (atr * 3),
      atr: atr
    };
  }
}
```

---

### Step 5: Display on Dashboard

```javascript
// app.js (Frontend)

async function fetchSignals() {
  const response = await fetch('/api/signals');
  const data = await response.json();

  data.signals.forEach(signal => {
    // Create a card for each signal
    const card = createSignalCard(signal);
    container.appendChild(card);
  });
}

function createSignalCard(signal) {
  // Returns HTML card showing:
  // - Stock symbol
  // - BUY or SELL badge
  // - Entry price
  // - Stop Loss (red)
  // - Target 1, Target 2 (green)
  // - Risk:Reward ratio
}
```

---

## 5. File Structure

```
Signal Indicator/
│
├── server/                      # Backend (Node.js)
│   │
│   ├── index.js                 # Server entry point
│   │                            # - Creates Express app
│   │                            # - Serves static files
│   │                            # - Routes /api/* requests
│   │
│   ├── config.js                # Configuration
│   │                            # - MIN_PRICE_CHANGE: 3%
│   │                            # - ATR_PERIOD: 14
│   │                            # - ATR_SL_MULTIPLIER: 1.5
│   │                            # - NSE API headers
│   │
│   ├── routes/
│   │   └── stocks.js            # API endpoints
│   │                            # - GET /api/signals
│   │                            # - GET /api/history
│   │                            # - GET /api/stats
│   │
│   └── services/
│       ├── nseData.js           # NSE data fetching
│       │                        # - Cookie management
│       │                        # - Fetch NIFTY 500 list
│       │                        # - Fetch historical data
│       │
│       ├── stockAnalyzer.js     # Signal generation
│       │                        # - Filter by % change
│       │                        # - Generate BUY/SELL signals
│       │                        # - Calculate levels
│       │
│       ├── atrCalculator.js     # ATR calculation
│       │                        # - True Range formula
│       │                        # - ATR averaging
│       │
│       └── signalHistory.js     # History storage
│                                # - Save signals to JSON
│                                # - Retrieve past signals
│
├── public/                      # Frontend (Browser)
│   │
│   ├── index.html               # HTML structure
│   │                            # - Tabs (Live, History, Stats)
│   │                            # - Signal cards container
│   │                            # - Filter buttons
│   │
│   ├── styles.css               # CSS styling
│   │                            # - Dark theme
│   │                            # - Card design
│   │                            # - Responsive layout
│   │
│   └── app.js                   # JavaScript logic
│                                # - Fetch signals from API
│                                # - Render cards
│                                # - Auto-refresh
│
├── docs/                        # Documentation
│   └── DOCUMENTATION.md         # This file
│
├── data/                        # Auto-created
│   └── signal-history.json      # Stored signals
│
├── package.json                 # Dependencies
├── render.yaml                  # Deployment config
└── .gitignore                   # Git ignore rules
```

---

## 6. API Reference

### GET /api/signals

**Description:** Get current day's trading signals

**Response:**
```json
{
  "success": true,
  "count": 5,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "signals": [
    {
      "symbol": "ADANIENT",
      "companyName": "Adani Enterprises Ltd",
      "signalType": "BUY",
      "entryPrice": 2850.50,
      "stopLoss": 2790.25,
      "target1": 2930.75,
      "target2": 2970.88,
      "atr": 40.17,
      "changePercent": 5.23,
      "riskReward1": "1:1.33",
      "riskReward2": "1:2"
    }
  ]
}
```

---

### GET /api/signals?type=bullish

**Description:** Get only BUY signals

**Query Parameters:**
| Param | Values | Description |
|-------|--------|-------------|
| type | bullish | Only BUY signals |
| type | bearish | Only SELL signals |

---

### GET /api/history

**Description:** Get past signals

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| days | 7 | Number of days |
| type | all | bullish/bearish |
| symbol | - | Specific stock |

**Example:** `/api/history?days=14&type=bullish`

---

### GET /api/stats

**Description:** Get signal statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSignals": 45,
    "buySignals": 28,
    "sellSignals": 17,
    "uniqueStocks": 32
  }
}
```

---

## 7. Technologies Used

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | JavaScript runtime |
| Express.js | Web server framework |
| Axios | HTTP requests to NSE |
| CORS | Cross-origin support |

### Frontend
| Technology | Purpose |
|------------|---------|
| HTML5 | Page structure |
| CSS3 | Styling & layout |
| JavaScript | Dynamic functionality |
| Fetch API | Call backend APIs |

### Deployment
| Platform | Purpose |
|----------|---------|
| Render.com | Cloud hosting (free) |
| GitHub | Code repository |

---

## 8. Deployment Guide

### Step 1: Push to GitHub

```bash
cd "Signal Indicator"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/signal-indicator.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click **New → Web Service**
4. Connect your repository
5. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Click **Create Web Service**
7. Get your URL: `https://signal-indicator.onrender.com`

### Step 3: Share with Users

Anyone can access `https://your-app.onrender.com` from any device - no installation required!

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────┐
│                 SIGNAL CALCULATION FORMULA                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ATR = Average of last 14 True Ranges                      │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ BUY SIGNAL (Stock UP ≥3%)                           │  │
│  │                                                     │  │
│  │   Stop Loss = Entry - (ATR × 1.5)                   │  │
│  │   Target 1  = Entry + (ATR × 2.0)                   │  │
│  │   Target 2  = Entry + (ATR × 3.0)                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ SELL SIGNAL (Stock DOWN ≥3%)                        │  │
│  │                                                     │  │
│  │   Stop Loss = Entry + (ATR × 1.5)                   │  │
│  │   Target 1  = Entry - (ATR × 2.0)                   │  │
│  │   Target 2  = Entry - (ATR × 3.0)                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Risk:Reward Ratios                                        │
│    Target 1 = 1:1.33                                       │
│    Target 2 = 1:2.00                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Disclaimer

This project is for **educational purposes only**. It is not financial advice. Always do your own research before making any investment decisions. Trading in the stock market involves significant risk.

---

**Created by:** Akash
**Version:** 1.0.0
**Last Updated:** January 2026
