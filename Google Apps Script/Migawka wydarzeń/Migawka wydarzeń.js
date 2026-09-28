/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 */
function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Wczytanie źródeł i promptu z folderu: Automation/Migawka Wydarzeń na Google Dysku
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  if (!filtrProfilu) {
    filtrProfilu = "Brak zewnętrznego promptu - domyślny tryb analityka.";
  }

  let dzisiaj = new Date();
  let dzisiajStr = dzisiaj.toISOString().split('T')[0];
  
  let za7Dni = new Date(dzisiaj);
  za7Dni.setDate(dzisiaj.getDate() + 7);
  
  let przed7Dniami = new Date(dzisiaj);
  przed7Dniami.setDate(dzisiaj.getDate() - 7);

  let formatD = (d) => d.toISOString().split('T')[0];

  let kontekstCzasowy = "BEZWZGLĘDNE RAMY KALENDARZOWE (Dzisiejsza data to: " + dzisiajStr + "):\n" +
                        "- Okres przeszły: od " + formatD(przed7Dniami) + " do " + dzisiajStr + "\n" +
                        "- Okres przyszły (NADCHODZĄCY TYDZIEŃ): od " + dzisiajStr + " do " + formatD(za7Dni);

  let unikalneUrle = [...new Set([...SOURCES_LOKALNE.map(s => s.url), ...SOURCES_GLOBALNE.map(s => s.url)])];
  
  let requesty = unikalneUrle.map(url => ({
    url: url,
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  }));

  let tresciStron = {};
  try {
    let odpowiedzi = UrlFetchApp.fetchAll(requesty);
    odpowiedzi.forEach((resp, index) => {
      let url = unikalneUrle[index];
      if (resp.getResponseCode() === 200) {
        let czystyTekst = wyczyscHtmlDoTekstu(resp.getContentText());
        tresciStron[url] = czystyTekst.length > 3500 ? czystyTekst.substring(0, 3500) : czystyTekst;
      } else {
        tresciStron[url] = ""; 
      }
    });
  } catch (e) {
    Logger.log("Błąd pobierania: " + e.message);
  }

  let wynikiLokalePrzyszle = [];
  let wynikiGlobalnePrzeszle = [];
  let wynikiGlobalnePrzyszle = [];

  SOURCES_LOKALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynikiZrodla = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przyszle", filtrProfilu);
      if (wynikiZrodla) {
        let przefiltrowane = wynikiZrodla.filter(row => {
          let calyWierszStr = row.join(" ").toUpperCase();
          return !calyWierszStr.includes("ODRZUCONE");
        });
        wynikiLokalePrzyszle = wynikiLokalePrzyszle.concat(przefiltrowane);
      }
    }
  });

  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynikiPrzeszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (wynikiPrzeszle) {
        let przefiltrowanePrzeszle = wynikiPrzeszle.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiGlobalnePrzeszle = wynikiGlobalnePrzeszle.concat(przefiltrowanePrzeszle);
      }

      let wynikiPrzyszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (wynikiPrzyszle) {
        let przefiltrowanePrzyszle = wynikiPrzyszle.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiGlobalnePrzyszle = wynikiGlobalnePrzyszle.concat(przefiltrowanePrzyszle);
      }
    }
  });

  sortujIGrupujWyniki(wynikiLokalePrzyszle, 0, 1);
  sortujIGrupujWyniki(wynikiGlobalnePrzeszle, 1, 0);
  sortujIGrupujWyniki(wynikiGlobalnePrzyszle, 1, 0);

  let naglowki1 = ["Obszar / Lokalizacja", "Data / Dzień", "Tytuł / Temat", "Streszczenie merytoryczne", "Źródło", "Link"];
  let naglowki2 = ["Data wydarzenia", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Źródło", "Link"];

  zapiszDoArkusza(ss, "1. Lokalne - Przyszłe", wynikiLokalePrzyszle, naglowki1);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", wynikiGlobalnePrzeszle, naglowki2);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", wynikiGlobalnePrzyszle, naglowki2);

  wyslijRaportEmail(wynikiLokalePrzyszle, wynikiGlobalnePrzeszle, wynikiGlobalnePrzyszle, naglowki1, naglowki2, dzisiajStr);
}

/**
 * Pomocnicza funkcja do nawigacji po folderach i pobierania zawartości pliku tekstowego.
 */
function wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  try {
    let folderyGlowne = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!folderyGlowne.hasNext()) throw new Error("Nie znaleziono folderu głównego: " + nazwaGlownegoFolderu);
    
    let folderGlowny = folderyGlowne.next();
    let podfoldery = folderGlowny.getFoldersByName(nazwaPodfolderu);
    if (!podfoldery.hasNext()) throw new Error("Nie znaleziono podfolderu: " + nazwaPodfolderu);
    
    let podfolder = podfoldery.next();
    let pliki = podfolder.getFilesByName(nazwaPliku);
    
    if (pliki.hasNext()) {
      return pliki.next().getBlob().getDataAsString();
    } else {
      throw new Error("Nie znaleziono pliku: " + nazwaPliku + " w folderze " + nazwaGlownegoFolderu + "/" + nazwaPodfolderu);
    }
  } catch (e) {
    Logger.log("Błąd odczytu pliku " + nazwaPliku + ": " + e.message);
    return null;
  }
}

/**
 * Pomocnicza funkcja do wczytywania tablicy JSON z konkretnego folderu na Dysku.
 */
function wczytajJsonZPlikuWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let tresc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
  if (!tresc) return null;
  
  try {
    return JSON.parse(tresc);
  } catch (e) {
    Logger.log("Błąd parsowania JSON dla pliku " + nazwaPliku + ": " + e.message);
    return null;
  }
}

function zapytajDeepSeekDlaTresc(source, trescZrodla, kontekstCzasowy, typRaportu, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY.");

  const url = "https://api.deepseek.com/chat/completions";

  let instrukcjaCzasowa = "";
  let strukturaKolumn = "";

  if (typRaportu === "lokalne_przyszle") {
    instrukcjaCzasowa = 
      "BEZWZGLĘDNY WYMÓG CZASOWY:\n" +
      "- Wybierz WYŁĄCZNIE wydarzenia w PRZYSZŁOŚCI w okresie nadchodzących 7 dni.\n" +
      "- Całkowicie pomijaj wydarzenia archiwalne (przeszłe) oraz kursy stałe dla dorosłych bez konkretnych dat w nadchodzącym tygodniu.";
    strukturaKolumn = "\"Obszar / Lokalizacja\", \"Data / Dzień\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Źródło\", \"Link\"";
  } else {
    let typOpis = (typRaportu === "globalne_przeszle") ? "co się wydarzyło w minionych 7 dniach" : "co się wydarzy w najbliższych 7 dniach";
    instrukcjaCzasowa = "Analizuj pod kątem kategorii: " + typOpis + ".";
    strukturaKolumn = "\"Data wydarzenia\", \"Obszar / Zasięg\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Źródło\", \"Link\"";
  }

  let systemPrompt = "Jesteś analitykiem. \n\n" + kontekstCzasowy + "\n\n" + filtrProfilu + "\n\n" + instrukcjaCzasowa + "\n\nAnalizuj tekst ze źródła " + source.url + ":\n\"\"\"" + trescZrodla + "\"\"\"\n\nZwróć tylko trafione pozycje w formacie JSON: {\"dane\": [[...], [...], ...]}, gdzie każdy wiersz to tablica zawierająca: " + strukturaKolumn;

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij wyłącznie trafione pozycje w formacie JSON." }
    ],
    response_format: { type: "json_object" },
    temperature: 0.0
  };

  try {
    let response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    let json = JSON.parse(response.getContentText());
    if (json.error) return [];
    let content = json.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(content).dane || [];
  } catch (e) {
    return [];
  }
}

function wyczyscHtmlDoTekstu(html) {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function sortujIGrupujWyniki(dane, indeksObszaru, indeksDaty) {
  if (!dane || dane.length === 0) return;
  dane.sort((a, b) => {
    let obszarA = String(a[indeksObszaru] || "");
    let obszarB = String(b[indeksObszaru] || "");
    if (obszarA !== obszarB) return obszarA.localeCompare(obszarB);
    return String(a[indeksDaty] || "").localeCompare(String(b[indeksDaty] || ""));
  });
}

function zapiszDoArkusza(ss, nazwaZakładki, dane, nagłówki) {
  let sheet = ss.getSheetByName(nazwaZakładki) || ss.insertSheet(nazwaZakładki);
  sheet.clear();
  sheet.appendRow(nagłówki);
  sheet.getRange(1, 1, 1, nagłówki.length).setFontWeight("bold").setBackground("#f3f3f3");
  if (dane && dane.length > 0) {
    let startRow = (dane[0][0] === nagłówki[0]) ? 1 : 0;
    for (let i = startRow; i < dane.length; i++) sheet.appendRow(dane[i]);
  }
  sheet.autoResizeColumns(1, nagłówki.length);
}

/**
 * Wysyła raport e-mail oraz załącza PDF z poprawionym nagłówkiem i tabelą źródeł na końcu.
 * OPTYMALIZACJA: Limit na ilość wpisów w email (pozostałe w Spreadsheet)
 */
function wyslijRaportEmail(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "📰 Migawka Wydarzeń (" + dzisiajStr + ")";
  
  const MAX_ROWS_EMAIL = 20;
  let lokalnePrzyszleEmail = (lokalnePrzyszle || []).slice(0, MAX_ROWS_EMAIL);
  let globalnePrzeszleEmail = (globalnePrzeszle || []).slice(0, MAX_ROWS_EMAIL);
  let globalnePrzyszleEmail = (globalnePrzyszle || []).slice(0, MAX_ROWS_EMAIL);

  let cssStyles = `<style>
    table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; margin-top: 10px; }
    th { border: 1px solid #cbd5e1; padding: 5px; text-align: left; font-size: 9px; color: white; }
    td { border: 1px solid #cbd5e1; padding: 5px; color: #1e293b; }
    .group-header { background-color: #f1f5f9; font-weight: bold; color: #334155; }
    .alt-row { opacity: 0.95; }
    h2 { color: #1e293b; font-family: Arial, sans-serif; margin: 10px 0; }
    h3 { border-bottom: 2px solid; padding-bottom: 5px; margin-top: 20px; font-family: Arial, sans-serif; }
    .sources-table th { background-color: #334155; }
    .sources-table td { font-size: 9px; color: #64748b; }
  </style>`;

  let htmlBody = cssStyles;
  htmlBody += "<h2>🎯 Migawka Wydarzeń (" + dzisiajStr + ")</h2>";
  htmlBody += "<p style=\"font-family: Arial, sans-serif; color: #475569; font-size: 12px;\">Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>";

  htmlBody += "<h3 style=\"color: #047857;\">🎡 1. Lokalne, Społeczne, Dzieci i Kultura (Nadchodzące)</h3>";
  if (!lokalnePrzyszleEmail || lokalnePrzyszleEmail.length === 0) {
    htmlBody += "<p style=\"font-size: 11px; color: #64748b;\"><em>Brak nadchodzących wydarzeń spełniających kryteria w najbliższych dniach.</em></p>";
  } else {
    htmlBody += generujTabeleHtmlOpt(lokalnePrzyszleEmail, naglowki1, "#047857", "#ecfdf5", 0);
    if (lokalnePrzyszle.length > MAX_ROWS_EMAIL) {
      htmlBody += "<p style=\"font-size: 10px; color: #94a3b8;\"><em>⚠️ Pokazano " + MAX_ROWS_EMAIL + " z " + lokalnePrzyszle.length + " wpisów. Pełna lista w Arkuszu.</em></p>";
    }
  }

  htmlBody += "<h3 style=\"color: #4338ca;\">📊 2. Świat, Polityka, Gospodarka – Co się wydarzyło</h3>";
  if (!globalnePrzeszleEmail || globalnePrzeszleEmail.length === 0) {
    htmlBody += "<p style=\"font-size: 11px; color: #64748b;\"><em>Brak istotnych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtmlOpt(globalnePrzeszleEmail, naglowki2, "#4338ca", "#e0e7ff", 1);
    if (globalnePrzeszle.length > MAX_ROWS_EMAIL) {
      htmlBody += "<p style=\"font-size: 10px; color: #94a3b8;\"><em>⚠️ Pokazano " + MAX_ROWS_EMAIL + " z " + globalnePrzeszle.length + " wpisów. Pełna lista w Arkuszu.</em></p>";
    }
  }

  htmlBody += "<h3 style=\"color: #b45309;\">🔮 3. Świat, Polityka, Gospodarka – Co się wydarzy</h3>";
  if (!globalnePrzyszleEmail || globalnePrzyszleEmail.length === 0) {
    htmlBody += "<p style=\"font-size: 11px; color: #64748b;\"><em>Brak zapowiadanych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtmlOpt(globalnePrzyszleEmail, naglowki2, "#b45309", "#fef3c7", 1);
    if (globalnePrzyszle.length > MAX_ROWS_EMAIL) {
      htmlBody += "<p style=\"font-size: 10px; color: #94a3b8;\"><em>⚠️ Pokazano " + MAX_ROWS_EMAIL + " z " + globalnePrzyszle.length + " wpisów. Pełna lista w Arkuszu.</em></p>";
    }
  }

  htmlBody += generujTabeluZrodelHtmlOpt();
  htmlBody += "<br><hr style=\"border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;\"><p style=\"font-size: 10px; color: #94a3b8; font-family: Arial, sans-serif;\">Automatyczny agregator treści • Pełne dane w powiązanym Arkuszu Google</p>";

  let pdfBlob = null;
  try {
    let pdfZawartosc = `${cssStyles}
      <h2>🎯 Migawka Wydarzeń (${dzisiajStr})</h2>
      <p style="font-size: 11px; color: #475569;">Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>
      
      <h3 style="color: #047857;">🎡 1. Lokalne, Społeczne, Dzieci i Kultura</h3>
      ${generujTabelePdfOpt(lokalnePrzyszle, naglowki1, "#047857", "#ecfdf5", 0)}

      <div style="page-break-before: always; padding-top: 10px;"></div>
      <h3 style="color: #4338ca;">📊 2. Świat, Polityka, Gospodarka – Co się wydarzyło</h3>
      ${generujTabelePdfOpt(globalnePrzeszle, naglowki2, "#4338ca", "#e0e7ff", 1)}

      <div style="page-break-before: always; padding-top: 10px;"></div>
      <h3 style="color: #b45309;">🔮 3. Świat, Polityka, Gospodarka – Co się wydarzy</h3>
      ${generujTabelePdfOpt(globalnePrzyszle, naglowki2, "#b45309", "#fef3c7", 1)}

      <div style="page-break-before: always; padding-top: 10px;"></div>
      ${generujTabeluZrodelHtmlOpt(true)}
    `;

    let completeHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: A4 landscape; margin: 1cm; }
      body { font-family: Arial, sans-serif; }
    </style></head><body>${pdfZawartosc}</body></html>`;

    let blob = Utilities.newBlob(completeHtml, 'text/html', 'temp.html');
    pdfBlob = blob.getAs('application/pdf').setName("Raport_Wiadomosci_" + dzisiajStr + ".pdf");
  } catch (e) {
    Logger.log("Błąd generowania PDF: " + e.message);
  }

  let emailOptions = {
    to: emailAdres,
    subject: temat,
    htmlBody: htmlBody
  };

  if (pdfBlob) {
    emailOptions.attachments = [pdfBlob];
  }

  MailApp.sendEmail(emailOptions);
}

function generujTabeleHtmlOpt(dane, nagłówki, kolorNaglowka, kolorTla, indeksGrupy) {
  let html = "<table style=\"background-color: " + kolorNaglowka + ";\">";
  html += "<tr style=\"color: white;\">";
  nagłówki.forEach(naglowek => {
    html += "<th>" + naglowek + "</th>";
  });
  html += "</tr>";

  let ostatniaGrupa = "";
  let i = 0;
  
  dane.forEach(wiersz => {
    let aktualnaGrupa = String(wiersz[indeksGrupy] || "Inne");
    if (aktualnaGrupa !== ostatniaGrupa) {
      html += "<tr class=\"group-header\"><td colspan=\"" + nagłówki.length + "\">📌 " + aktualnaGrupa + "</td></tr>";
      ostatniaGrupa = aktualnaGrupa;
      i = 0;
    }

    let stylTla = (i % 2 === 0) ? "" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + "\">";
    
    wiersz.forEach((komorka, index) => {
      let zawartosc = String(komorka || "").replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      if (index === wiersz.length - 1 && zawartosc.startsWith('http')) {
        zawartosc = "<a href=\"" + zawartosc + "\" target=\"_blank\" style=\"color: " + kolorNaglowka + ";\">Otwórz</a>";
      }
      html += "<td>" + zawartosc + "</td>";
    });
    
    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}

function generujTabelePdfOpt(dane, nagłówki, kolorNaglowka, kolorTla, indeksGrupy) {
  if (!dane || dane.length === 0) return "<p style=\"font-size: 10px; color: #64748b;\"><em>Brak wpisów w tej sekcji.</em></p>";
  
  let html = "<table style=\"background-color: " + kolorNaglowka + ";\">";
  html += "<tr style=\"color: white; font-size: 9px;\">";
  nagłówki.forEach(naglowek => {
    html += "<th>" + naglowek + "</th>";
  });
  html += "</tr>";

  let ostatniaGrupa = "";
  let i = 0;
  
  dane.forEach(wiersz => {
    let aktualnaGrupa = String(wiersz[indeksGrupy] || "Inne");
    if (aktualnaGrupa !== ostatniaGrupa) {
      html += "<tr class=\"group-header\" style=\"font-size: 9px;\"><td colspan=\"" + nagłówki.length + "\">📌 " + aktualnaGrupa + "</td></tr>";
      ostatniaGrupa = aktualnaGrupa;
      i = 0;
    }

    let stylTla = (i % 2 === 0) ? "" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + " font-size: 8px;\">";
    
    wiersz.forEach((komorka, index) => {
      let zawartosc = String(komorka || "").replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
      if (index === wiersz.length - 1 && zawartosc.startsWith('http')) {
        zawartosc = "<a href=\"" + zawartosc + "\" style=\"color: " + kolorNaglowka + ";\">Link</a>";
      }
      html += "<td>" + zawartosc + "</td>";
    });
    
    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}

function generujTabeluZrodelHtmlOpt(isPdf = false) {
  let fontSize = isPdf ? "8px" : "9px";
  return `
    <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
      <h4 style="margin: 0 0 5px 0; font-size: 10px; color: #64748b; text-transform: uppercase;">Monitorowane źródła</h4>
      <table class="sources-table" style="font-size: ${fontSize};">
        <thead><tr><th>Kategoria / Region</th><th>Adresy URL</th></tr></thead>
        <tbody>
          <tr><td><b>Kraków (Przedszkola)</b></td><td>przedszkole140.blizej.info</td></tr>
          <tr><td><b>Kraków (CK Podgórza)</b></td><td>sokolska.ckpodgorza.pl, borek.ckpodgorza.pl, iskierka.ckpodgorza.pl</td></tr>
          <tr><td><b>Kraków (Łagiewniki)</b></td><td>smcegielniana.pl, dzielnica9.krakow.pl</td></tr>
          <tr><td><b>Tarnów</b></td><td>csm.tarnow.pl, kultura.tarnow.pl</td></tr>
          <tr><td><b>Małopolska</b></td><td>malopolska.pl</td></tr>
          <tr><td><b>Polska</b></td><td>zero.pl, forsal.pl, biznes.pap.pl</td></tr>
          <tr><td><b>Globalne</b></td><td>politico.eu, rp.pl</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
