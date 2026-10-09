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

  // --- 3. WRITE TO GSHEET SPREADSHEET ---
  var date = new Date();
  
  sheet.appendRow([
    date, data.DOT, data.SABR, data.BTC, data.ETH, data.BTC_DOM, data.TOTAL_MCAP,
    data.SP500, data.NASDAQ100, data.USDPLN, data.EURPLN, data.GOLD, data.SILVER,
    data.BRENT, data.COPPER, data.COFFEE, data.ALUMINUM, 
    data.US10Y, data.US30Y, data.JP10Y, data.US20Y, data.DE10Y, "" 
  ]);
  
  // --- 4. SEND HTML EMAIL ---
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
          <td style="text-align: right; font-weight: 600; border-bottom: 1px solid #f4f4f4;">$${data.DOT}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Sabre Corp. (SABR)</td>
          <td style="text-align: right; font-weight: 600; border-bottom: 1px solid #f4f4f4;">$${data.SABR}</td>
        </tr>
      </table>

      <!-- CRYPTOCURRENCIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Cryptocurrencies</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">BTC/USD</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.BTC}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">ETH/USD</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.ETH}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">BTC Dominance</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.BTC_DOM}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Total Marketcap</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.TOTAL_MCAP}</td></tr>
      </table>

      <!-- INDICES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Stock Indices</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">S&P 500</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.SP500}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">NASDAQ 100</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.NASDAQ100}</td></tr>
      </table>

      <!-- CURRENCIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Currencies (Forex)</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">USD/PLN</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.USDPLN} PLN</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">EUR/PLN</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.EURPLN} PLN</td></tr>
      </table>

      <!-- COMMODITIES -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Commodities</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Gold</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.GOLD}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Silver</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.SILVER}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Brent Crude</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.BRENT}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Copper</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.COPPER}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Coffee</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.COFFEE}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Aluminum</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">$${data.ALUMINUM}</td></tr>
      </table>

      <!-- GOVERNMENT BONDS -->
      <h3 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; margin-bottom: 12px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px;">Government Bonds</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 35px; font-size: 14px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 10Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US10Y !== "No data" ? data.US10Y + "%" : data.US10Y}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 20Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US20Y !== "No data" ? data.US20Y + "%" : data.US20Y}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">US 30Y</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.US30Y !== "No data" ? data.US30Y + "%" : data.US30Y}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Germany 10Y (DE)</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.DE10Y !== "No data" ? data.DE10Y + "%" : data.DE10Y}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #f4f4f4; color: #333;">Japan 10Y (JP)</td><td style="text-align: right; font-weight: 500; border-bottom: 1px solid #f4f4f4;">${data.JP10Y !== "No data" ? data.JP10Y + "%" : data.JP10Y}</td></tr>
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