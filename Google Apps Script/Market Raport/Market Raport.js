/**
 * ============================================================================
 * PROJEKT: Market Raport (Google Apps Script)
 * ŚCIEŻKA LOKALNA: c:\Dane\rpindela\GitHub\Automation\Google Apps Script\Market Raport\Market Raport.js
 * LOKALIZACJA DRIVE: GitHub / Automation / Google Apps Script / Market Raport / Market Raport
 * OPIS: Automatyczny pobór kursów, archiwizacja do arkusza oraz wysyłka raportu HTML
 *       ze znacznikami czasu bieżącego odczytu i poprzedniej bazy kalkulacyjnej.
 * ============================================================================
 */

const CONFIG = {
  // Ścieżka folderów na Google Drive
  drivePath: ['GitHub', 'Automation', 'Google Apps Script', 'Market Raport'],
  spreadsheetName: 'Market Raport',
  sheetName: 'Sheet1',
  
  // Opcjonalne awaryjne ID arkusza (gdyby wyszukiwanie po ścieżce zawiodło)
  fallbackSpreadsheetId: '', 
  
  // Konfiguracja powiadomień e-mail
  email: {
    recipient: Session.getActiveUser().getEmail() || 'romanpindela@gmail.com',
    subjectPrefix: 'Market Report | Aktualizacja'
  },
  
  // Konfiguracja aktywów portfela
  portfolio: [
    { name: 'Polkadot', symbol: 'DOT', currency: '$', colIndex: 1 },
    { name: 'Sabre Corp.', symbol: 'SABR', currency: '$', colIndex: 2 }
  ]
};

/**
 * Główny punkt wejścia (Trigger czasowy lub uruchomienie ręczne)
 */
function runMarketReport() {
  const ss = getSpreadsheetByPath(CONFIG.drivePath, CONFIG.spreadsheetName, CONFIG.fallbackSpreadsheetId);
  if (!ss) {
    Logger.log('Błąd: Nie udało się zlokalizować arkusza Market Raport na Google Drive.');
    return;
  }

  const sheet = ss.getSheetByName(CONFIG.sheetName) || ss.getSheets()[0];
  
  // 1. Pobranie najświeższych danych rynkowych i dopisanie wiersza
  const currentData = fetchAllMarketData();
  appendRowData(sheet, currentData);
  
  // 2. Pobranie danych do raportu i kalkulacja zmian względem poprzedniego wiersza
  const marketMetrics = prepareReportData(sheet);
  
  // 3. Generowanie i wysyłka profesjonalnego raportu HTML
  sendExecutiveReport(marketMetrics, ss.getUrl());
}

/**
 * Alias dla wstecznej kompatybilności wcześniejszych triggerów GAS
 */
function checkMarketData() {
  return runMarketReport();
}

/**
 * Dynamiczne wyszukiwanie pliku arkusza w strukturze katalogów Google Drive
 */
function getSpreadsheetByPath(folderNames, fileName, fallbackId) {
  try {
    let currentFolder = DriveApp.getRootFolder();
    
    for (let i = 0; i < folderNames.length; i++) {
      const folders = currentFolder.getFoldersByName(folderNames[i]);
      if (folders.hasNext()) {
        currentFolder = folders.next();
      } else {
        Logger.log(`Nie znaleziono folderu: ${folderNames[i]}. Próba pobrania po nazwie pliku w całym Drive.`);
        const globalFiles = DriveApp.getFilesByName(fileName);
        if (globalFiles.hasNext()) {
          return SpreadsheetApp.open(globalFiles.next());
        }
        if (fallbackId) {
          return SpreadsheetApp.openById(fallbackId);
        }
        return null;
      }
    }
    
    const files = currentFolder.getFilesByName(fileName);
    if (files.hasNext()) {
      return SpreadsheetApp.open(files.next());
    }
  } catch (e) {
    Logger.log(`Błąd lokalizacji pliku po ścieżce: ${e.message}`);
  }

  if (fallbackId) {
    return SpreadsheetApp.openById(fallbackId);
  }
  
  const fallbackFiles = DriveApp.getFilesByName(fileName);
  return fallbackFiles.hasNext() ? SpreadsheetApp.open(fallbackFiles.next()) : null;
}

/**
 * Zbieranie danych rynkowych z API (Coinbase / Yahoo Finance / CoinLore / CoinPaprika)
 */
function fetchAllMarketData() {
  const timestamp = Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd HH:mm:ss');
  const globalCrypto = fetchGlobalCryptoMetrics();
  
  return {
    timestamp: timestamp,
    dot: fetchCryptoPrice('DOT', 'polkadot'),
    sabr: fetchYahooQuote('SABR'),
    btc: fetchCryptoPrice('BTC', 'bitcoin'),
    eth: fetchCryptoPrice('ETH', 'ethereum'),
    btcDom: globalCrypto.btcDom,
    totalMcap: globalCrypto.totalMcap,
    sp500: fetchYahooQuote('^GSPC'),
    nasdaq100: fetchYahooQuote('^NDX'),
    usdpln: fetchForex('USDPLN=X'),
    eurpln: fetchForex('EURPLN=X'),
    gold: fetchYahooQuote('GC=F'),
    silver: fetchYahooQuote('SI=F'),
    brent: fetchYahooQuote('BZ=F'),
    copper: fetchYahooQuote('HG=F'),
    coffee: fetchYahooQuote('KC=F'),
    aluminum: fetchYahooQuote('ALI=F'),
    us10y: fetchBondYield('^TNX'),
    us30y: fetchBondYield('^TYX'),
    jp10y: fetchBondYield('JP10YT=RR'),
    us20y: fetchBondYield('^FVX'),
    de10y: fetchBondYield('DE10YT=RR'),
    pl10y: fetchBondYield('PL10YT=RR')
  };
}

/**
 * Niezawodny pobór kursu kryptowaluty:
 * 1. Coinbase API (najszybsze i stabilne w środowisku Google Cloud)
 * 2. Yahoo Finance (np. BTC-USD, ETH-USD, DOT-USD)
 * 3. Binance API (rezerwowe)
 * 4. CoinGecko (awaryjne)
 */
function fetchCryptoPrice(symbol, coingeckoId) {
  // 1. Coinbase API
  try {
    const pair = `${symbol}-USD`;
    const url = `https://api.coinbase.com/v2/prices/${pair}/spot`;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      const amount = parseFloat(json?.data?.amount);
      if (!isNaN(amount) && amount > 0) return amount;
    }
  } catch (e) {
    Logger.log(`Błąd Coinbase dla ${symbol}: ${e.message}`);
  }

  // 2. Yahoo Finance (np. BTC-USD, ETH-USD, DOT-USD)
  try {
    const yahooTicker = `${symbol}-USD`;
    const price = fetchYahooQuote(yahooTicker);
    if (price !== null && !isNaN(price) && price > 0) return price;
  } catch (e) {
    Logger.log(`Błąd Yahoo dla ${symbol}: ${e.message}`);
  }

  // 3. Binance API
  try {
    const binancePair = `${symbol}USDT`;
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${binancePair}`;
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      const price = parseFloat(json?.price);
      if (!isNaN(price) && price > 0) return price;
    }
  } catch (e) {
    Logger.log(`Błąd Binance dla ${symbol}: ${e.message}`);
  }

  // 4. CoinGecko API (awaryjne)
  if (coingeckoId) {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
      const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (resp.getResponseCode() === 200) {
        const json = JSON.parse(resp.getContentText());
        const p = json?.[coingeckoId]?.usd;
        if (p !== undefined && p !== null) return p;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Pobór wskaźników globalnych (Dominacja BTC i Total Market Cap):
 * 1. CoinLore API (brak limitów, bez API key, w pełni stabilne w chmurze)
 * 2. CoinPaprika API (rezerwowe)
 * 3. CoinGecko API (awaryjne)
 */
function fetchGlobalCryptoMetrics() {
  // 1. CoinLore API
  try {
    const url = 'https://api.coinlore.net/api/global/';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      const data = Array.isArray(json) ? json[0] : json;
      if (data && data.total_mcap && data.btc_d) {
        const mcap = parseFloat(data.total_mcap);
        const btcD = parseFloat(data.btc_d);
        return {
          btcDom: !isNaN(btcD) ? `${btcD.toFixed(2)}%` : null,
          totalMcap: !isNaN(mcap) ? `$${(mcap / 1e12).toFixed(2)} T` : null
        };
      }
    }
  } catch (e) {
    Logger.log(`Błąd CoinLore global: ${e.message}`);
  }

  // 2. CoinPaprika API
  try {
    const url = 'https://api.coinpaprika.com/v1/global';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      if (json && json.market_cap_usd && json.bitcoin_dominance_percentage !== undefined) {
        const mcap = parseFloat(json.market_cap_usd);
        const btcD = parseFloat(json.bitcoin_dominance_percentage);
        return {
          btcDom: !isNaN(btcD) ? `${btcD.toFixed(2)}%` : null,
          totalMcap: !isNaN(mcap) ? `$${(mcap / 1e12).toFixed(2)} T` : null
        };
      }
    }
  } catch (e) {
    Logger.log(`Błąd CoinPaprika global: ${e.message}`);
  }

  // 3. CoinGecko API (awaryjne)
  try {
    const url = 'https://api.coingecko.com/api/v3/global';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const json = JSON.parse(resp.getContentText());
      const totalUsd = json.data?.total_market_cap?.usd;
      const btcDom = json.data?.market_cap_percentage?.btc;
      return {
        btcDom: btcDom !== undefined ? `${btcDom.toFixed(2)}%` : null,
        totalMcap: totalUsd ? `$${(totalUsd / 1e12).toFixed(2)} T` : null
      };
    }
  } catch (e) {}

  return { btcDom: null, totalMcap: null };
}

function fetchBtcDominance() {
  return fetchGlobalCryptoMetrics().btcDom;
}

function fetchTotalMarketCap() {
  return fetchGlobalCryptoMetrics().totalMcap;
}

function fetchYahooQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    const price = res.chart?.result?.[0]?.meta?.regularMarketPrice;
    return price !== undefined ? price : null;
  } catch (e) {
    return null;
  }
}

function fetchForex(ticker) {
  const val = fetchYahooQuote(ticker);
  return val !== null ? val.toFixed(2) : null;
}

function fetchBondYield(ticker) {
  const val = fetchYahooQuote(ticker);
  return val !== null ? `${val.toFixed(3)}%` : null;
}

/**
 * Zapis wiersza odczytu w arkuszu
 */
function appendRowData(sheet, d) {
  const row = [
    d.timestamp,
    d.dot, d.sabr,
    d.btc, d.eth, d.btcDom, d.totalMcap,
    d.sp500, d.nasdaq100,
    d.usdpln, d.eurpln,
    d.gold, d.silver, d.brent, d.copper, d.coffee, d.aluminum,
    d.us10y, d.us30y, d.jp10y, d.us20y, d.de10y, d.pl10y
  ];
  sheet.appendRow(row);
}

/**
 * Pobranie ostatnich 2 wierszy i kalkulacja zmian ze znacznikami czasu
 */
function prepareReportData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const numCols = 23;
  const numRowsToRead = lastRow >= 3 ? 2 : 1;
  const startRow = lastRow >= 3 ? lastRow - 1 : lastRow;
  
  const values = sheet.getRange(startRow, 1, numRowsToRead, numCols).getValues();
  const current = numRowsToRead === 2 ? values[1] : values[0];
  const previous = numRowsToRead === 2 ? values[0] : null;

  function formatTimestamp(val) {
    if (!val || val === 'brak' || val === '-') return val || '-';
    if (val instanceof Date) {
      return Utilities.formatDate(val, 'Europe/Warsaw', 'yyyy-MM-dd HH:mm:ss');
    }
    return String(val);
  }

  const currTimestamp = formatTimestamp(current[0]);
  const prevTimestamp = previous ? formatTimestamp(previous[0]) : 'brak';

  function parseVal(v) {
    if (v === null || v === '' || v === 'Brak danych' || v === '-') return null;
    if (typeof v === 'number') return v;
    const cleaned = String(v).replace(/[$%,\s]/g, '').replace('T', '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  function formatPrice(val, prefix = '$', decimals = 2, suffix = '') {
    const num = parseVal(val);
    if (num === null) return '-';
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return `${prefix}${formatted}${suffix}`;
  }

  function calcDelta(currIdx, isPercentagePoint = false) {
    const cVal = parseVal(current[currIdx]);
    if (cVal === null) return { formattedChange: '-', isPositive: null, rawChange: 0 };
    if (!previous) return { formattedChange: '0.00%', isPositive: null, rawChange: 0 };

    const pVal = parseVal(previous[currIdx]);
    if (pVal === null || pVal === 0) return { formattedChange: '-', isPositive: null, rawChange: 0 };

    if (isPercentagePoint) {
      const diff = cVal - pVal;
      const sign = diff > 0 ? '+' : '';
      return {
        formattedChange: `${sign}${diff.toFixed(2)} pp`,
        isPositive: diff >= 0,
        rawChange: diff
      };
    } else {
      const pct = ((cVal - pVal) / pVal) * 100;
      const sign = pct > 0 ? '+' : '';
      return {
        formattedChange: `${sign}${pct.toFixed(2)}%`,
        isPositive: pct >= 0,
        rawChange: pct
      };
    }
  }

  return {
    timestamp: currTimestamp,
    prevTimestamp: prevTimestamp,
    portfolio: [
      { name: 'Polkadot', symbol: 'DOT', price: formatPrice(current[1], '$', 2), ...calcDelta(1) },
      { name: 'Sabre Corp.', symbol: 'SABR', price: formatPrice(current[2], '$', 2), ...calcDelta(2) }
    ],
    crypto: [
      { name: 'BTC/USD', price: formatPrice(current[3], '$', 2), ...calcDelta(3) },
      { name: 'ETH/USD', price: formatPrice(current[4], '$', 2), ...calcDelta(4) },
      { name: 'BTC Dominance', price: current[5] ? (String(current[5]).includes('%') ? String(current[5]) : `${Number(current[5]).toFixed(2)}%`) : '-', ...calcDelta(5, true) },
      { name: 'Total Market Cap', price: current[6] || '-', ...calcDelta(6) }
    ],
    indices: [
      { name: 'S&P 500', price: formatPrice(current[7], '', 2), ...calcDelta(7) },
      { name: 'NASDAQ 100', price: formatPrice(current[8], '', 2), ...calcDelta(8) }
    ],
    forex: [
      { name: 'USD/PLN', price: formatPrice(current[9], '', 2, ' PLN'), ...calcDelta(9) },
      { name: 'EUR/PLN', price: formatPrice(current[10], '', 2, ' PLN'), ...calcDelta(10) }
    ],
    commodities: [
      { name: 'Złoto (Gold)', price: formatPrice(current[11], '$', 2), ...calcDelta(11) },
      { name: 'Srebro (Silver)', price: formatPrice(current[12], '$', 2), ...calcDelta(12) },
      { name: 'Ropa Brent', price: formatPrice(current[13], '$', 2), ...calcDelta(13) },
      { name: 'Miedź (Copper)', price: formatPrice(current[14], '$', 2), ...calcDelta(14) },
      { name: 'Kawa (Coffee)', price: formatPrice(current[15], '$', 2), ...calcDelta(15) },
      { name: 'Aluminium', price: formatPrice(current[16], '$', 2), ...calcDelta(16) }
    ],
    bonds: [
      { name: 'US 10Y', price: current[17] || '-', ...calcDelta(17, true) },
      { name: 'US 20Y', price: current[20] || '-', ...calcDelta(20, true) },
      { name: 'US 30Y', price: current[18] || '-', ...calcDelta(18, true) },
      { name: 'Niemcy 10Y (DE)', price: current[21] || '-', ...calcDelta(21, true) },
      { name: 'Japonia 10Y (JP)', price: current[19] || '-', ...calcDelta(19, true) },
      { name: 'Polska 10Y (PL)', price: current[22] || '-', ...calcDelta(22, true) }
    ]
  };
}

/**
 * Szablon e-mail klasy Executive ze znacznikami dat w tabelach i kartach
 */
function sendExecutiveReport(data, sheetUrl) {
  if (!data) return;

  const dateStr = Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM-dd');
  const subject = `${CONFIG.email.subjectPrefix} | ${dateStr}`;

  function renderRows(items) {
    return items.map(item => {
      const isUp = item.isPositive === true;
      const isDown = item.isPositive === false;
      const badgeStyle = isUp 
        ? 'background-color: #e6f4ea; color: #137333;' 
        : isDown 
        ? 'background-color: #fce8e6; color: #c5221f;' 
        : 'background-color: #f1f3f4; color: #5f6368;';

      return `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #edf2f7; font-size: 13px; color: #1f2937; font-weight: 500;">
            ${item.name}
          </td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #edf2f7; text-align: right;">
            <div style="font-size: 13px; color: #111827; font-weight: 600;">${item.price}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 1px;">${data.timestamp}</div>
          </td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #edf2f7; text-align: right; width: 110px;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px; ${badgeStyle}">
              ${item.formattedChange}
            </span>
            <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">poprz: ${data.prevTimestamp}</div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderPortfolioCards(items) {
    return items.map(item => {
      const isUp = item.isPositive === true;
      const isDown = item.isPositive === false;
      const badgeBg = isUp ? '#e6f4ea' : isDown ? '#fce8e6' : '#f1f3f4';
      const badgeColor = isUp ? '#137333' : isDown ? '#c5221f' : '#5f6368';

      return `
        <div style="flex: 1; min-width: 220px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; margin: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">
              ${item.name} (${item.symbol})
            </span>
            <span style="font-size: 10px; color: #94a3b8;">${data.timestamp}</span>
          </div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 6px;">
            <span style="font-size: 22px; font-weight: 700; color: #111827;">${item.price}</span>
            <div style="text-align: right;">
              <span style="padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; background-color: ${badgeBg}; color: ${badgeColor};">
                ${item.formattedChange}
              </span>
              <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">vs ${data.prevTimestamp}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCategorySection(title, color, items) {
    return `
      <thead>
        <tr style="background: #f8fafc;">
          <th style="text-align: left; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${color}; border-top: 2px solid ${color}; border-bottom: 1px solid #e2e8f0;">
            ${title}
          </th>
          <th style="text-align: right; padding: 10px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #64748b; border-top: 2px solid ${color}; border-bottom: 1px solid #e2e8f0;">
            Kurs (${data.timestamp})
          </th>
          <th style="text-align: right; padding: 10px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: #64748b; border-top: 2px solid ${color}; border-bottom: 1px solid #e2e8f0;">
            Zmiana (vs ${data.prevTimestamp})
          </th>
        </tr>
      </thead>
      <tbody>
        ${renderRows(items)}
      </tbody>
    `;
  }

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      
      <!-- Nagłówek -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 28px; color: #ffffff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #ffffff;">Executive Market Brief</h1>
              <div style="margin-top: 6px; font-size: 12px; color: #94a3b8;">
                Odczyt bieżący: <strong style="color: #38bdf8;">${data.timestamp}</strong> &bull; Poprzedni: <strong style="color: #cbd5e1;">${data.prevTimestamp}</strong>
              </div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="background: rgba(255, 255, 255, 0.12); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; color: #38bdf8; letter-spacing: 0.4px;">
                AUTOMATION ACTIVE
              </span>
            </td>
          </tr>
        </table>
      </div>

      <div style="padding: 24px 28px;">
        
        <!-- Sekcja: Portfel Inwestycyjny -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #475569; margin-bottom: 10px;">
            Portfel Inwestycyjny
          </div>
          <div style="display: flex; flex-wrap: wrap; margin: -6px;">
            ${renderPortfolioCards(data.portfolio)}
          </div>
        </div>

        <!-- Tabele z rynkami -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${renderCategorySection('Kryptowaluty & Wskaźniki', '#0284c7', data.crypto)}
          ${renderCategorySection('Indeksy Giełdowe', '#4338ca', data.indices)}
          ${renderCategorySection('Waluty (Forex)', '#4f46e5', data.forex)}
          ${renderCategorySection('Surowce & Metale', '#b45309', data.commodities)}
          ${renderCategorySection('Rentowność Obligacji Skarbowych', '#047857', data.bonds)}
        </table>

        <!-- Link do arkusza w nowej lokalizacji -->
        <div style="margin-top: 30px; padding: 18px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
            Lokalizacja arkusza: <code>Drive / GitHub / Automation / Google Apps Script / Market Raport</code>
          </div>
          <a href="${sheetUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 600; letter-spacing: 0.2px;">
            Otwórz Arkusz w Google Sheets &rarr;
          </a>
        </div>

      </div>

      <!-- Stopka -->
      <div style="background: #f1f5f9; padding: 12px 28px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
        Skrypt Google Apps Script &bull; Zakres kalkulacji: ${data.prevTimestamp} &rarr; ${data.timestamp}
      </div>

    </div>
  </body>
  </html>
  `;

  GmailApp.sendEmail(CONFIG.email.recipient, subject, '', {
    htmlBody: htmlBody
  });
}