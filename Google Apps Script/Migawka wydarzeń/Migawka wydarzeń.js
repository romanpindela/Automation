/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 */
function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Wczytanie źródeł i promptu z folderu: Automation/Migawka Wydarzeń na Google Dysku
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Gebeurtenieén", "zrodla_globalne.json") || [];
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
 * Wysyła minimalny email z PDF (unika limitu rozmiaru wiadomości)
 */
function wyslijRaportEmail(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "📰 Migawka Wydarzeń (" + dzisiajStr + ")";

  // Minimalna wiadomość w emailu
  let htmlBody = "<h2 style=\"color: #1e293b; font-family: Arial, sans-serif;\">🎯 Migawka Wydarzeń (" + dzisiajStr + ")</h2>" +
    "<p style=\"font-family: Arial, sans-serif; color: #475569; font-size: 13px;\">Raport został przygotowany i jest dostępny jako plik PDF.</p>" +
    "<p style=\"font-family: Arial, sans-serif; color: #475569; font-size: 12px;\">" +
      "📊 Statystyka:<br>" +
      "• Lokalne (przyszłe): " + (lokalnePrzyszle ? lokalnePrzyszle.length : 0) + " wpisów<br>" +
      "• Świat (przeszłe): " + (globalnePrzeszle ? globalnePrzeszle.length : 0) + " wpisów<br>" +
      "• Świat (przyszłe): " + (globalnePrzyszle ? globalnePrzyszle.length : 0) + " wpisów" +
    "</p>" +
    "<p style=\"font-family: Arial, sans-serif; color: #94a3b8; font-size: 11px;\">Pełne dane znajdują się w powiązanym Arkuszu Google i załączniku PDF.</p>";

  let pdfBlob = null;
  try {
    let pdfZawartosc = generujPdfContent(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr);
    let completeHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: A4 landscape; margin: 1cm; }
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; margin-top: 10px; }
      th { background-color: #334155; color: white; border: 1px solid #cbd5e1; padding: 4px; font-size: 8px; }
      td { border: 1px solid #cbd5e1; padding: 4px; font-size: 8px; }
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

/**
 * Generuje zawartość PDF (bez wysyłania w emailu)
 */
function generujPdfContent(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let html = `<h2 style="color: #1e293b; font-family: Arial, sans-serif; font-size: 18px;">🎯 Migawka Wydarzeń (${dzisiajStr})</h2>`;
  html += `<p style="font-family: Arial, sans-serif; color: #475569; font-size: 12px;">Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>`;

  // Sekcja 1
  html += `<h3 style="color: #047857; border-bottom: 2px solid #047857; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">🎡 1. Lokalne</h3>`;
  html += generujTabelePdf(lokalnePrzyszle, naglowki1, "#047857", "#ecfdf5", 0);

  html += `<div style="page-break-before: always; padding-top: 10px;"></div>`;
  html += `<h3 style="color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">📊 2. Świat - Przeszłe</h3>`;
  html += generujTabelePdf(globalnePrzeszle, naglowki2, "#4338ca", "#e0e7ff", 1);

  html += `<div style="page-break-before: always; padding-top: 10px;"></div>`;
  html += `<h3 style="color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">🔮 3. Świat - Przyszłe</h3>`;
  html += generujTabelePdf(globalnePrzyszle, naglowki2, "#b45309", "#fef3c7", 1);

  return html;
}

/**
 * Generuje tabelę PDF z kompresją
 */
function generujTabelePdf(dane, naglowki, kolorNaglowka, kolorTla, indeksGrupy) {
  if (!dane || dane.length === 0) return `<p style="font-size: 10px; color: #64748b;">Brak danych.</p>`;

  let html = `<table style="background-color: ${kolorNaglowka};">`;
  html += `<tr style="color: white;">`;
  naglowki.forEach(n => html += `<th>${n}</th>`);
  html += `</tr>`;

  let ostatniaGrupa = "";
  dane.forEach(wiersz => {
    let grupa = String(wiersz[indeksGrupy] || "Inne");
    if (grupa !== ostatniaGrupa) {
      html += `<tr style="background-color: #f1f5f9;"><td colspan="${naglowki.length}" style="font-weight: bold; font-size: 8px;">📌 ${grupa}</td></tr>`;
      ostatniaGrupa = grupa;
    }
    html += `<tr>`;
    wiersz.forEach((k, idx) => {
      let val = String(k || "");
      if (idx === wiersz.length - 1 && val.startsWith('http')) {
        val = `<a href="${val}" style="color: ${kolorNaglowka};">Link</a>`;
      }
      html += `<td>${val}</td>`;
    });
    html += `</tr>`;
  });
  html += `</table>`;

  return html;
}
