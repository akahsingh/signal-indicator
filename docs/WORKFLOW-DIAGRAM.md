# Signal Indicator - Workflow Diagram

## Simple Flow

```
USER                          SERVER                         NSE INDIA
 │                              │                              │
 │  1. Opens website            │                              │
 │─────────────────────────────►│                              │
 │                              │                              │
 │                              │  2. Fetch NIFTY 500 stocks   │
 │                              │─────────────────────────────►│
 │                              │                              │
 │                              │  3. Returns 500 stocks       │
 │                              │◄─────────────────────────────│
 │                              │                              │
 │                              │  4. Filter ≥3% change        │
 │                              │  (500 → ~10 stocks)          │
 │                              │                              │
 │                              │  5. Calculate ATR            │
 │                              │  6. Calculate SL & Targets   │
 │                              │                              │
 │  7. Returns signals          │                              │
 │◄─────────────────────────────│                              │
 │                              │                              │
 │  8. Display cards            │                              │
 │                              │                              │
```

---

## Detailed Process

```
┌─────────────────────────────────────────────────────────────────┐
│                         START                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: User opens https://your-app.onrender.com              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Browser loads index.html, styles.css, app.js          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: app.js calls fetch('/api/signals')                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Server receives request (routes/stocks.js)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: nseData.js fetches from NSE India API                 │
│                                                                 │
│  URL: https://www.nseindia.com/api/equity-stockIndices          │
│                                                                 │
│  Returns: 500 stocks with price, change%, high, low             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: stockAnalyzer.js filters stocks                       │
│                                                                 │
│  Rule: Keep stocks with |change%| >= 3%                         │
│                                                                 │
│  Example:                                                       │
│    RELIANCE: +1.2%  → SKIP                                      │
│    ADANI: +5.8%     → KEEP (BUY signal)                        │
│    TATA: -4.2%      → KEEP (SELL signal)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: For each filtered stock, calculate ATR                │
│                                                                 │
│  ATR = Average of last 14 True Ranges                           │
│                                                                 │
│  True Range = max(High-Low, |High-PrevClose|, |Low-PrevClose|) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 8: Calculate Stop Loss and Targets                       │
│                                                                 │
│  BUY Signal:                                                    │
│    Stop Loss = Entry - (ATR × 1.5)                              │
│    Target 1  = Entry + (ATR × 2)                                │
│    Target 2  = Entry + (ATR × 3)                                │
│                                                                 │
│  SELL Signal:                                                   │
│    Stop Loss = Entry + (ATR × 1.5)                              │
│    Target 1  = Entry - (ATR × 2)                                │
│    Target 2  = Entry - (ATR × 3)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 9: Return JSON response to browser                       │
│                                                                 │
│  {                                                              │
│    "signals": [                                                 │
│      { symbol, signalType, entryPrice, stopLoss, targets }      │
│    ]                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 10: app.js renders signal cards on page                  │
│                                                                 │
│  Each card shows:                                               │
│    - Stock symbol & company name                                │
│    - BUY or SELL badge                                          │
│    - Entry price                                                │
│    - Stop Loss (red)                                            │
│    - Target 1 & Target 2 (green)                                │
│    - Risk:Reward ratio                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          END                                    │
│                                                                 │
│  Auto-refresh every 5 minutes during market hours               │
│  (9:15 AM - 3:30 PM IST)                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example Calculation

```
Stock: ADANI ENTERPRISES
Today's Change: +5.8%
Current Price: ₹2,850

Historical Data (14 days):
Day  | High   | Low    | Close  | True Range
-----|--------|--------|--------|------------
1    | 2820   | 2780   | 2800   | 40
2    | 2840   | 2790   | 2830   | 50
3    | 2860   | 2810   | 2840   | 50
...  | ...    | ...    | ...    | ...
14   | 2870   | 2830   | 2850   | 40

ATR = Average of 14 True Ranges = 42

Signal Generated:
┌────────────────────────────────────┐
│  ADANI ENTERPRISES                 │
│  ────────────────                  │
│  Signal: BUY                       │
│  Entry: ₹2,850                     │
│                                    │
│  Stop Loss: 2850 - (42 × 1.5)      │
│           = 2850 - 63              │
│           = ₹2,787                 │
│                                    │
│  Target 1: 2850 + (42 × 2)         │
│          = 2850 + 84               │
│          = ₹2,934                  │
│                                    │
│  Target 2: 2850 + (42 × 3)         │
│          = 2850 + 126              │
│          = ₹2,976                  │
│                                    │
│  Risk: ₹63 | Reward: ₹84/₹126     │
│  R:R = 1:1.33 / 1:2                │
└────────────────────────────────────┘
```

---

## File Responsibility

```
┌─────────────────────────────────────────────────────────────────┐
│                        FILES & DUTIES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  server/index.js          → Start server, route requests        │
│                                                                 │
│  server/config.js         → Store settings (3%, ATR period)     │
│                                                                 │
│  server/routes/stocks.js  → Handle /api/* requests              │
│                                                                 │
│  services/nseData.js      → Fetch data from NSE India           │
│                                                                 │
│  services/stockAnalyzer.js → Filter stocks, generate signals    │
│                                                                 │
│  services/atrCalculator.js → Calculate ATR, SL, targets         │
│                                                                 │
│  services/signalHistory.js → Save/load signal history           │
│                                                                 │
│  public/index.html        → Page structure                      │
│                                                                 │
│  public/styles.css        → Visual design                       │
│                                                                 │
│  public/app.js            → Fetch & display signals             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
