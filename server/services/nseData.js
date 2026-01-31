const axios = require('axios');

// Complete NIFTY 500 stock symbols
const NIFTY_SYMBOLS = [
  // NIFTY 50 (Large Cap)
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'SBIN', 'BHARTIARTL',
  'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA',
  'TITAN', 'BAJFINANCE', 'ULTRACEMCO', 'WIPRO', 'NESTLEIND', 'ONGC', 'NTPC', 'POWERGRID',
  'M&M', 'TATAMOTORS', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT', 'ADANIPORTS', 'TECHM',
  'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'CIPLA', 'BAJAJFINSV', 'GRASIM', 'DIVISLAB',
  'BPCL', 'BRITANNIA', 'EICHERMOT', 'APOLLOHOSP', 'COALINDIA', 'TATACONSUM', 'HEROMOTOCO',
  'SBILIFE', 'HDFCLIFE', 'BAJAJ-AUTO', 'LTIM',

  // NIFTY NEXT 50
  'ABB', 'ADANIGREEN', 'ADANIPOWER', 'AMBUJACEM', 'AUROPHARMA', 'BANDHANBNK', 'BANKBARODA',
  'BEL', 'BERGEPAINT', 'BIOCON', 'BOSCHLTD', 'CHOLAFIN', 'COLPAL', 'CONCOR', 'DALBHARAT',
  'DABUR', 'DLF', 'GAIL', 'GODREJCP', 'GUJGASLTD', 'HAL', 'HAVELLS', 'HINDPETRO',
  'ICICIGI', 'ICICIPRULI', 'IDEA', 'IDFCFIRSTB', 'IGL', 'INDHOTEL', 'INDIGO', 'INDUSTOWER',
  'IOC', 'IRCTC', 'JINDALSTEL', 'JSWENERGY', 'JUBLFOOD', 'LICI', 'LUPIN', 'MARICO',
  'MCDOWELL-N', 'MOTHERSON', 'MUTHOOTFIN', 'NAUKRI', 'NHPC', 'NMDC', 'OBEROIRLTY',
  'OFSS', 'PAGEIND', 'PETRONET', 'PFC', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB',
  'RECLTD', 'SAIL', 'SBICARD', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SRF', 'TATACOMM',
  'TATAPOWER', 'TORNTPHARM', 'TRENT', 'UBL', 'UNIONBANK', 'UNITDSPR', 'UPL', 'VBL', 'VEDL', 'VOLTAS', 'ZOMATO', 'ZYDUSLIFE',

  // NIFTY MIDCAP 150
  '3MINDIA', 'AADHARHFC', 'AARTIDRUGS', 'AARTIIND', 'AAVAS', 'ACC', 'ADANIENSOL', 'ADANITRANS',
  'AFFLE', 'AJANTPHARM', 'ALKEM', 'ALLCARGO', 'AMARAJABAT', 'AMBER', 'ANGELONE', 'APLAPOLLO',
  'APTUS', 'ASHOKLEY', 'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AVANTIFEED', 'BASF',
  'BATAINDIA', 'BAYERCROP', 'BDL', 'BHARATFORG', 'BHARATRAS', 'BHEL', 'BIKAJI', 'BIRLACORPN',
  'BLUESTARCO', 'BRIGADE', 'BSE', 'CANFINHOME', 'CARBORUNIV', 'CASTROLIND', 'CDSL', 'CENTRALBK',
  'CENTURYTEX', 'CESC', 'CGPOWER', 'CHAMBALFER', 'CHEMPLASTS', 'CMSINFO', 'COCHINSHIP',
  'COFORGE', 'COROMANDEL', 'CREDITACC', 'CROMPTON', 'CUMMINSIND', 'CYIENT', 'DATAPATTNS',
  'DCMSHRIRAM', 'DEEPAKNTR', 'DELHIVERY', 'DEVYANI', 'DHANI', 'DIXON', 'DMART', 'ECLERX',
  'EDELWEISS', 'EIDPARRY', 'EIHOTEL', 'ELECON', 'ELGIEQUIP', 'EMAMILTD', 'ENDURANCE',
  'ENGINERSIN', 'EQUITASBNK', 'ERIS', 'ESCORTS', 'EXIDEIND', 'FACT', 'FINEORG', 'FINPIPE',
  'FLUOROCHEM', 'FORTIS', 'FOSECOIND', 'FSL', 'GICRE', 'GILLETTE', 'GLENMARK', 'GLAXO',
  'GMRAIRPORT', 'GNFC', 'GODFRYPHLP', 'GODREJAGRO', 'GODREJIND', 'GPPL', 'GRANULES',
  'GRAPHITE', 'GRINDWELL', 'GRSE', 'GSFC', 'GSPL', 'GUJALKALI', 'HATSUN', 'HDFCAMC',
  'HEIDELBERG', 'HEMIPROP', 'HGS', 'HINDZINC', 'HLEGLAS', 'HOMEFIRST', 'HONAUT', 'HUDCO',
  'IBREALEST', 'IBULHSGFIN', 'IDBI', 'IEX', 'IIFL', 'IPCALAB', 'IRCON', 'IRFC', 'ISEC',
  'ITI', 'J&KBANK', 'JAMNAAUTO', 'JBCHEPHARM', 'JBMA', 'JINDALSAW', 'JKCEMENT', 'JKLAKSHMI',
  'JKPAPER', 'JKTYRE', 'JMFINANCIL', 'JSL', 'JSWHL', 'JTEKTINDIA', 'JUSTDIAL', 'JYOTHYLAB',
  'KAJARIACER', 'KALPATPOWR', 'KALYANKJIL', 'KARURVYSYA', 'KEC', 'KEI', 'KIOCL', 'KIRLOSENG',
  'KNRCON', 'KPITTECH', 'KRBL', 'KSCL', 'KSB', 'LAOPALA', 'LATENTVIEW', 'LAURUSLABS',
  'LAXMIMACH', 'LICHSGFIN', 'LINDEINDIA', 'LLOYDSME', 'LTTS', 'LUXIND', 'MAHABANK',
  'MAHSEAMLES', 'MAITHANALL', 'MANAPPURAM', 'MANALIPETC', 'MAPMYINDIA', 'MASFIN',
  'MASTEK', 'MAXHEALTH', 'MAZDOCK', 'MCX', 'METROPOLIS', 'MFSL', 'MGL', 'MIDHANI',
  'MINDACORP', 'MINDAIND', 'MISHTANN', 'MMTC', 'MOIL', 'MOTHERSON', 'MPHASIS', 'MRF',
  'MRPL', 'MSUMI', 'MUKANDLTD', 'MUTHOOTFIN', 'NAM-INDIA', 'NATCOPHARM', 'NATIONALUM',
  'NAUKRI', 'NAVINFLUOR', 'NBCC', 'NCC', 'NESCO', 'NETWORK18', 'NFL', 'NILKAMAL',
  'NLCINDIA', 'NOCIL', 'NYKAA', 'NUVOCO', 'OBEROIRLTY', 'OFSS', 'OIL', 'OLECTRA',
  'ONGC', 'ORIENTCEM', 'ORIENTELEC', 'PAPERPROD', 'PAYTM', 'PCBL', 'PDSL', 'PEL',
  'PERSISTENT', 'PFIZER', 'PGHH', 'PHOENIXLTD', 'PIIND', 'PNC', 'PNBHOUSING', 'POLICYBZR',
  'POLYCAB', 'POLYMED', 'POONAWALLA', 'POWERINDIA', 'PRESTIGE', 'PRINCEPIPE', 'PRSMJOHNSN',
  'PSPPROJECT', 'PTC', 'PVRINOX', 'QUESS', 'RADICO', 'RAIN', 'RAJESHEXPO', 'RALLIS',
  'RAMCOCEM', 'RATNAMANI', 'RAYMOND', 'RBLBANK', 'RECLTD', 'REDINGTON', 'RELAXO', 'RENUKA',
  'RITES', 'ROUTE', 'RPOWER', 'RVNL', 'SAGCEM', 'SANOFI', 'SAPPHIRE', 'SARDAEN', 'SAREGAMA',
  'SBIN', 'SCHAEFFLER', 'SCHNEIDER', 'SCI', 'SEQUENT', 'SHARDACROP', 'SHILPAMED', 'SHOPERSTOP',
  'SJVN', 'SKFINDIA', 'SOBHA', 'SOLARA', 'SONACOMS', 'SONATSOFTW', 'SOUTHBANK', 'SPARC',
  'STAR', 'STARHEALTH', 'STEL', 'STLTECH', 'SUDARSCHEM', 'SUMICHEM', 'SUNDARMFIN', 'SUNDRMFAST',
  'SUNPHARMA', 'SUNTECK', 'SUPRAJIT', 'SUPREMEIND', 'SUVENPHAR', 'SUZLON', 'SWARAJENG',
  'SWSOLAR', 'SYMPHONY', 'SYNGENE', 'TANLA', 'TATACHEM', 'TATACOMM', 'TATAELXSI', 'TATAINVEST',
  'TATAMETALI', 'TATASTEEL', 'TCI', 'TCNSBRANDS', 'TECHM', 'THERMAX', 'TIINDIA', 'TIMKEN',
  'TITAN', 'TORNTPOWER', 'TRENT', 'TRIDENT', 'TRITURBINE', 'TRIVENI', 'TTKPRESTIG', 'TV18BRDCST',
  'TVSMOTOR', 'UBL', 'UCOBANK', 'UFLEX', 'ULTRACEMCO', 'UNIONBANK', 'UNIPARTS', 'UPL',
  'VAIBHAVGBL', 'VAKRANGEE', 'VARROC', 'VBL', 'VEDL', 'VENKEYS', 'VGUARD', 'VIJAYA',
  'VINATIORGA', 'VIPIND', 'VMART', 'VOLTAMP', 'VOLTAS', 'VSTIND', 'VTL', 'WABAG',
  'WELCORP', 'WELSPUNIND', 'WESTLIFE', 'WHIRLPOOL', 'WIPRO', 'WOCKPHARMA', 'YESBANK',
  'ZEEL', 'ZENSARTECH', 'ZODIACJRD', 'ZOMATO', 'ZYDUSLIFE',

  // Additional NIFTY 500 stocks
  'ABCAPITAL', 'ABFRL', 'ABSLAMC', 'AIAENG', 'AKZOINDIA', 'APLLTD', 'APOLLOTYRE',
  'ASAHIINDIA', 'ASHOKA', 'ASTERDM', 'BALRAMCHIN', 'BANARISUG', 'BALAMINES', 'BALMLAWRIE',
  'BARBEQUE', 'BBTC', 'BCG', 'BEML', 'BFUTILITIE', 'BHAGYANGR', 'BIGBLOC', 'BLISSGVS',
  'BLUEDART', 'BLS', 'BOROLTD', 'BORORENEW', 'BPCL', 'BSOFT', 'CAMLINFINE', 'CAMPUS',
  'CANARA', 'CAPLIPOINT', 'CARTRADE', 'CEATLTD', 'CENTUM', 'CENTURYPLY', 'CERA', 'CHEMCON',
  'CHALET', 'CIPLA', 'CLEAN', 'CLININDIA', 'CNOVAPETRO', 'CNTRAVELS', 'COFFEEDAY', 'COMPUAGE',
  'CONFIPET', 'CONTROLPR', 'COSMOFIRST', 'CRAFTSMAN', 'CRISIL', 'CSBBANK', 'CUB', 'DCAL',
  'DCBBANK', 'DECCANCE', 'DELTACORP', 'DEN', 'DHAMPURSUG', 'DIVISLAB', 'DLINKINDIA',
  'DOLLAR', 'DPSCLTD', 'DRREDDY', 'DWARKESH', 'DYNAMATECH', 'EASEMYTRIP', 'EBBETF0430',
  'EDELWEISS', 'EICHERMOT', 'EPL', 'EQUITAS', 'EVEREADY', 'EXCELINDUS', 'FCONSUMER', 'FDC',
  'FEDERALBNK', 'FIEM', 'FILATEX', 'FINCABLES', 'FIRSTSOUR', 'FUSION', 'GABRIEL', 'GALAXYSURF',
  'GATEWAY', 'GENUSPOWER', 'GET&D', 'GHCL', 'GLAND', 'GLOBUSSPR', 'GMBREW', 'GNA',
  'GOCOLORS', 'GODREJPROP', 'GOKEX', 'GOLDIAM', 'GOODYEAR', 'GRAVITA', 'GREENLAM',
  'GREENPANEL', 'GREAVESCOT', 'GRINFRA', 'GSHIP', 'GTLINFRA', 'GUFICBIO', 'GULFOILLUB',
  'HAPPSTMNDS', 'HARSHA', 'HATSUN', 'HCC', 'HCG', 'HCLTECH', 'HDFC', 'HFCL', 'HGINFRA',
  'HIKAL', 'HILTON', 'HIMADRI', 'HINDCOPPER', 'HINDZINC', 'HITECH', 'HITECHGEAR', 'HLE',
  'HSCL', 'HTMEDIA', 'ICIL', 'IFBIND', 'IIFLWAM', 'IMAGICAA', 'IMFA', 'INDIAGLYCO',
  'INDIAMART', 'INDIANB', 'INDNIPPON', 'INDOAMINES', 'INDOCO', 'INDORAMA', 'INDOTECH',
  'INFIBEAM', 'INGERRAND', 'INOXGREEN', 'INOXWIND', 'INTELLECT', 'IOB', 'IONEXCHANG',
  'ISGEC', 'ITDC', 'JAIBALAJI', 'JAICORPLTD', 'JAMNA', 'JASH', 'JAYAGROGN', 'JAYBARMARU',
  'JCHAC', 'JETAIRWAYS', 'JISLJALEQS', 'JKIL', 'JKLAKSHMI', 'JKTYRE', 'JMFINANCIL',
  'JPPOWER', 'JSLHISAR', 'JTLIND', 'JUBLINGREA', 'JUNIORBEES', 'JUSTDIAL', 'JYOTHYLAB',
  'KABRAEXTRU', 'KAKATCEM', 'KALAMANDIR', 'KALPATPOWR', 'KANSAINER', 'KARDA', 'KAYA',
  'KENNAMET', 'KERNEX', 'KESORAM', 'KEYFINSERV', 'KFINTECH', 'KHADIM', 'KILITCH', 'KINGFA',
  'KIRLFER', 'KIRLPNU', 'KITEX', 'KKCL', 'KMCSHIL', 'KNRCON', 'KOKUYOCMLN', 'KOPRAN',
  'KOTAKBANK', 'KOTARISUG', 'KPIGREEN', 'KPITTECH', 'KPRMILL', 'KRBL', 'KRIDHANINF', 'KSCL'
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
