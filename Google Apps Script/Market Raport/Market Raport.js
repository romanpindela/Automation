function checkMarketData() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // --- 1. DATA FETCHING FUNCTIONS ---
  
  function getYahoo(ticker) {
    try {
      var url = "https://query2.finance.yahoo.com/v8/finance/chart/" + ticker;
      var response = UrlFetchApp.fetch(url, { "muteHttpExceptions": true, "headers": { "User-Agent": "Mozilla/5.0" } });
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        return parseFloat(json.chart.result[0].meta.regularMarketPrice).toFixed(2);
      }
    } catch(e) {}
    return "No data";
  }

  function getCoinbase(pair) {
    try {
      var url = "https://api.coinbase.com/v2/prices/" + pair + "/spot";
      var response = UrlFetchApp.fetch(url, {"muteHttpExceptions": true});
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        return parseFloat(json.data.amount).toFixed(2);
      }
    } catch(e) {}
    return "No data";
  }
  
  function getGlobalCrypto(type) {
    try {
      var url = "https://api.coinlore.net/api/global/";
      var response = UrlFetchApp.fetch(url, {"muteHttpExceptions": true});
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        if (type === 'btc_dom') return parseFloat(json[0].btc_d).toFixed(2) + "%";
        if (type === 'marketcap') return "$" + (parseFloat(json[0].total_mcap) / 1000000000000).toFixed(2) + " T";
      }
    } catch(e) {}
    return "No data";
  }

  function getCNBC(ticker) {
    try {
      var url = "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=" + ticker;
      var response = UrlFetchApp.fetch(url, {"muteHttpExceptions": true});
      if (response.getResponseCode() === 200) {
        var json = JSON.parse(response.getContentText());
        if(json.FormattedQuoteResult && json.FormattedQuoteResult.FormattedQuote && json.FormattedQuoteResult.FormattedQuote.length > 0) {
           return json.FormattedQuoteResult.FormattedQuote[0].last;
        }
      }
    } catch(e) {}
    return "No data";
  }

  // --- 2. GATHERING ALL DATA ---
  
  var data = {
    "DOT": getCoinbase("DOT-USD"),
    "SABR": getYahoo("SABR"),
    "BTC": getCoinbase("BTC-USD"),
    "ETH": getCoinbase("ETH-USD"),
    "BTC_DOM": getGlobalCrypto('btc_dom'),
    "TOTAL_MCAP": getGlobalCrypto('marketcap'),
    "SP500": getCNBC(".SPX"),
    "NASDAQ100": getCNBC(".NDX"),
    "USDPLN": getYahoo("USDPLN=X"),
    "EURPLN": getYahoo("EURPLN=X"),
    "GOLD": getYahoo("GC=F"),
    "SILVER": getYahoo("SI=F"),
    "BRENT": getYahoo("BZ=F"),
    "COPPER": getYahoo("HG=F"),
    "COFFEE": getYahoo("KC=F"),
    "ALUMINUM": getYahoo("ALI=F"),
    "US10Y": getCNBC("US10Y"),
    "US30Y": getCNBC("US30Y"),
    "US20Y": getCNBC("US20Y"), 
    "JP10Y": getCNBC("JP10Y-JP"), 
    "DE10Y": getCNBC("DE10Y-DE")
  };

  // --- 3. READ LAST READING FROM GSHEET (REFERENCE FOR CHANGES) ---
  var date = new Date();

  // Column order in the sheet (must match appendRow below)
  var COLS = ["DATE", "DOT", "SABR", "BTC", "ETH", "BTC_DOM", "TOTAL_MCAP",
              "SP500", "NASDAQ100", "USDPLN", "EURPLN", "GOLD", "SILVER",
              "BRENT", "COPPER", "COFFEE", "ALUMINUM",
              "US10Y", "US30Y", "JP10Y", "US20Y", "DE10Y"];

  var prev = null;      // { KEY: value } from the last row
  var prevDate = null;  // Date of the last reading
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var prevValues = sheet.getRange(lastRow, 1, 1, COLS.length).getValues()[0];
    var d = prevValues[0] instanceof Date ? prevValues[0] : new Date(prevValues[0]);
    if (!isNaN(d.getTime())) {
      prevDate = d;
      prev = {};
      for (var i = 0; i < COLS.length; i++) prev[COLS[i]] = prevValues[i];
    }
  }

  // Converts values like "6,812.43", "$3.45 T", "56.20%", 4.123 to a number (or null)
  function toNumber(v) {
    if (typeof v === "number") return v;
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[^0-9.,\-]/g, "");
    if (s === "") return null;
    if (s.indexOf(",") > -1 && s.indexOf(".") > -1) {
      s = s.replace(/,/g, "");                       // 6,812.43 -> 6812.43
    } else if (s.indexOf(",") > -1) {
      var parts = s.split(",");
      s = (parts.length === 2 && parts[1].length !== 3) ? parts.join(".") : parts.join(""); // 4,12 -> 4.12 | 6,812 -> 6812
    }
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  // Human readable period between the last reading and now, e.g. "7 days", "1 day", "5h"
  var periodLabel = "";
  if (prevDate) {
    var hours = (date.getTime() - prevDate.getTime()) / 3600000;
    if (hours < 24) {
      periodLabel = Math.max(1, Math.round(hours)) + "h";
    } else {
      var days = Math.round(hours / 24);
      periodLabel = days + (days === 1 ? " day" : " days");
    }
  }
  var prevDateLabel = prevDate ? Utilities.formatDate(prevDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : "";

  // Returns HTML with the change vs. last reading, e.g. "+5.50% in 7 days (vs 2026-10-26)"
  // usePP = true -> change shown in percentage points (for yields / dominance)
  function chg(key, usePP) {
    if (!prev) return "";
    var cur = toNumber(data[key]);
    var old = toNumber(prev[key]);
    if (cur === null || old === null || (!usePP && old === 0)) return "";
    var diff = usePP ? (cur - old) : ((cur - old) / Math.abs(old)) * 100;
    var color = diff > 0 ? "#1a7f37" : (diff < 0 ? "#cf222e" : "#888");
    var sign = diff > 0 ? "+" : "";
    var text = sign + diff.toFixed(2) + (usePP ? " pp" : "%");
    return '<div style="font-size: 11px; font-weight: 400; margin-top: 2px;">' +
           '<span style="color: ' + color + '; font-weight: 600;">' + text + '</span>' +
           '<span style="color: #999;"> in ' + periodLabel + ' (vs ' + prevDateLabel + ')</span></div>';
  }

  // --- 4. WRITE TO GSHEET SPREADSHEET ---
  
  sheet.appendRow([
    date, data.DOT, data.SABR, data.BTC, data.ETH, data.BTC_DOM, data.TOTAL_MCAP,
    data.SP500, data.NASDAQ100, data.USDPLN, data.EURPLN, data.GOLD, data.SILVER,
    data.BRENT, data.COPPER, data.COFFEE, data.ALUMINUM, 
    data.US10Y, data.US30Y, data.JP10Y, data.US20Y, data.DE10Y, "" 
  ]);
  
  // --- 5. SEND HTML EMAIL ---
  var email = Session.getActiveUser().getEmail();
  var subject = 'Market Report | Update ' + Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  var htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
      
      <div style="border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 25px;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #111;">Market Report</h2>
        <p style="margin: 6px 0 0 0; color: #666; font-size: 13px;">Report generated on ${Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd, HH:mm")}</p>
      </div>
      
      <!-- PORTFOLIO -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">My Portfolio</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Polkadot (DOT)</td>
          <td style="text-align: right; font-weight: 600; border-bottom: 1px solid #f4f4f4;">$${data.DOT}${chg("DOT")}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Sabre Corp. (SABR)</td>
          <td style="text-align: right; font-weight: 600; border-bottom: 1px solid #f4f4f4;">$${data.SABR}${chg("SABR")}</td>
        </tr>
      </table>

      <!-- CRYPTOCURRENCIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Cryptocurrencies</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">BTC/USD</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.BTC}${chg("BTC")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">ETH/USD</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.ETH}${chg("ETH")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">BTC Dominance</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.BTC_DOM}${chg("BTC_DOM", true)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Total Marketcap</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.TOTAL_MCAP}${chg("TOTAL_MCAP")}</td></tr>
      </table>

      <!-- INDICES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Stock Indices</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">S&P 500</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.SP500}${chg("SP500")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">NASDAQ 100</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.NASDAQ100}${chg("NASDAQ100")}</td></tr>
      </table>

      <!-- CURRENCIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Currencies (Forex)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">USD/PLN</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.USDPLN} PLN${chg("USDPLN")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">EUR/PLN</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.EURPLN} PLN${chg("EURPLN")}</td></tr>
      </table>

      <!-- COMMODITIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Commodities</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Gold</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.GOLD}${chg("GOLD")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Silver</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.SILVER}${chg("SILVER")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Brent Crude</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.BRENT}${chg("BRENT")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Copper</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.COPPER}${chg("COPPER")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Coffee</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.COFFEE}${chg("COFFEE")}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Aluminum</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.ALUMINUM}${chg("ALUMINUM")}</td></tr>
      </table>

      <!-- GOVERNMENT BONDS -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Government Bonds</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 10Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US10Y !== "No data" ? data.US10Y + "%" : data.US10Y}${chg("US10Y", true)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 20Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US20Y !== "No data" ? data.US20Y + "%" : data.US20Y}${chg("US20Y", true)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 30Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US30Y !== "No data" ? data.US30Y + "%" : data.US30Y}${chg("US30Y", true)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Germany 10Y (DE)</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.DE10Y !== "No data" ? data.DE10Y + "%" : data.DE10Y}${chg("DE10Y", true)}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Japan 10Y (JP)</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.JP10Y !== "No data" ? data.JP10Y + "%" : data.JP10Y}${chg("JP10Y", true)}</td></tr>
      </table>

      <div style="font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eaeaea; padding-top: 20px;">
        Data synchronized with spreadsheet: <br>
        <a href="${SpreadsheetApp.getActiveSpreadsheet().getUrl()}" style="color: #666; text-decoration: none;">Open in Google Sheets</a>
      </div>
    </div>
  `;

  MailApp.sendEmail({
    to: email,
    subject: subject,
    htmlBody: htmlBody
  });
}