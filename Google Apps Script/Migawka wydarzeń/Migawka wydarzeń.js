/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 * Analizuje źródła w 3 rundach i zapisuje do 3 zakładek w Arkuszu Google.
 * Zarówno treść wiadomości e-mail, jak i załącznik PDF prezentowane są w identycznym układzie tabelarycznym.
 */
function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Wczytanie źródeł i promptu z Google Drive
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  if (!filtrProfilu) {
    filtrProfilu = "Domyślny tryb: Ojciec 2 córek w Krakowie (czas wolny/dzieci), inwestor śledzący rynki i kluczowe zmiany w mieście. Całkowity zakaz szumu informacyjnego.";
  }

  let dzisiaj = new Date();
  let dzisiajStr = dzisiaj.toISOString().split('T')[0];
  
  let za7Dni = new Date(dzisiaj);
  za7Dni.setDate(dzisiaj.getDate() + 7);
  
  let przed7Dniami = new Date(dzisiaj);
  przed7Dniami.setDate(dzisiaj.getDate() - 7);

  let formatD = (d) => d.toISOString().split('T')[0];

  let kontekstCzasowy = "BEZWZGLĘDNE RAMY KALENDARZOWE (Dzisiejsza data: " + dzisiajStr + "):\n" +
                        "- Okres przeszły: od " + formatD(przed7Dniami) + " do " + dzisiajStr + "\n" +
                        "- Okres teraźniejszy: trwające obecnie / dzień dzisiejszy (" + dzisiajStr + ")\n" +
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
        tresciStron[url] = czystyTekst.length > 4000 ? czystyTekst.substring(0, 4000) : czystyTekst;
      } else {
        tresciStron[url] = ""; 
      }
    });
  } catch (e) {
    Logger.log("Błąd pobierania stron: " + e.message);
  }

  let lokalneTrwajace = [];
  let lokalnePrzyszle = [];

  let globalnePrzeszle = [];
  let globalneTrwajace = [];
  let globalnePrzyszle = [];

  // ==========================================
  // ŹRÓDŁA LOKALNE - 3 RUNDY ANALIZY
  // ==========================================
  SOURCES_LOKALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      // Runda 1: Przeszłe (odrzucana z zestawienia tygodniowego)
      zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przeszle", filtrProfilu);

      // Runda 2: Lokalne Trwające / Dzisiaj
      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_trwajace", filtrProfilu);
      if (r2) lokalneTrwajace = lokalneTrwajace.concat(r2.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE")));

      // Runda 3: Lokalne Przyszłe
      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przyszle", filtrProfilu);
      if (r3) lokalnePrzyszle = lokalnePrzyszle.concat(r3.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE")));
    }
  });

  // ==========================================
  // ŹRÓDŁA GLOBALNE - 3 RUNDY ANALIZY
  // ==========================================
  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      // Runda 1: Co się wydarzyło
      let r1 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (r1) globalnePrzeszle = globalnePrzeszle.concat(r1.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE")));

      // Runda 2: Trwające szczyty i procesy
      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_trwajace", filtrProfilu);
      if (r2) globalneTrwajace = globalneTrwajace.concat(r2.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE")));

      // Runda 3: Co się wydarzy (kalendarium)
      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (r3) globalnePrzyszle = globalnePrzyszle.concat(r3.filter(row => !row.join(" ").toUpperCase().includes("ODRZUCONE")));
    }
  });

  // Łączenie danych w 3 zdefiniowane sekcje
  let tabela1Lokalne = [...lokalneTrwajace, ...lokalnePrzyszle];
  let tabela2GlobalnePrzeszle = globalnePrzeszle;
  let tabela3GlobalnePrzyszle = [...globalneTrwajace, ...globalnePrzyszle];

  sortujIGrupujWyniki(tabela1Lokalne, 0, 1);
  sortujIGrupujWyniki(tabela2GlobalnePrzeszle, 0, 2);
  sortujIGrupujWyniki(tabela3GlobalnePrzyszle, 0, 2);

  let naglowkiLokalne = ["Obszar / Lokalizacja", "Data / Dzień", "Godzina", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Źródło / Link"];
  let naglowkiGlobalne = ["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Źródło / Link"];

  // Zapis do 3 zakładek arkusza
  zapiszDoArkusza(ss, "1. Lokalne - Trwające i przyszłe (w tym tygdoniu)", tabela1Lokalne, naglowkiLokalne);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", tabela2GlobalnePrzeszle, naglowkiGlobalne);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", tabela3GlobalnePrzyszle, naglowkiGlobalne);

  // Wysłanie raportu (wspólny kod HTML tabeli w mailu i PDF)
  wyslijRaportEmailTabelaryczny(tabela1Lokalne, tabela2GlobalnePrzeszle, tabela3GlobalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr);
}

/**
 * Odpytanie modelu DeepSeek
 */
function zapytajDeepSeekDlaTresc(source, trescZrodla, kontekstCzasowy, typRaportu, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY.");

  const url = "https://api.deepseek.com/chat/completions";

  let instrukcjaZadaniowa = "";
  let strukturaKolumn = "";

  if (typRaportu.startsWith("lokalne")) {
    strukturaKolumn = '["Obszar / Lokalizacja", "Data / Dzień", "Godzina", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Źródło / Link"]';
    
    if (typRaportu === "lokalne_przeszle") {
      instrukcjaZadaniowa = "RUNDA 1: Zdarzenia przeszłe w regionie (zakończone inwestycje, uchwały). Pomiń drobne zebrania.";
    } else if (typRaportu === "lokalne_trwajace") {
      instrukcjaZadaniowa = "RUNDA 2 (KRAKÓW - TRWAJĄCE OBECNIE / DZISIAJ):\n" +
        "- Aktywne wystawy, jarmarki, ekspozycje i festiwale idealne dla rodziny z dziećmi (dziewczynki 5-7 lat) oraz trwające remonty kluczowych tras.\n" +
        "- Bezwzględny zakaz: kronika kryminalna, wypadki, spotkania seniorów, kursy stałe dla dorosłych.";
    } else if (typRaportu === "lokalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (KRAKÓW - NADCHODZĄCE 7 DNI):\n" +
        "- Zapowiedzi: warsztaty, teatry dziecięce, plener, pikniki edukacyjne i zaplanowane paraliże komunikacyjne w Krakowie.\n" +
        "- Bezwzględny zakaz: poezja dla dorosłych, posiedzenia rad dzielnic, szum informacyjny.";
    }
  } else {
    strukturaKolumn = '["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Źródło / Link"]';
    
    if (typRaportu === "globalne_przeszle") {
      instrukcjaZadaniowa = "RUNDA 1 (RYNKI I ŚWIAT - MINIONE 7 DNI):\n" +
        "- Decyzje banków centralnych (RPP, Fed, EBC), odczyty inflacji, istotne wydarzenia na rynkach akcji, krypto/blockchain i surowcach.\n" +
        "- Bezwzględny zakaz: kłótnie partyjne bez wpływu na finanse, sensacje, dramy.";
    } else if (typRaportu === "globalne_trwajace") {
      instrukcjaZadaniowa = "RUNDA 2 (RYNKI I ŚWIAT - TRWAJĄCE SZCZYTY I PROCESY):\n" +
        "- Trwające szczyty gospodarcze, konferencje technologiczne, wielodniowe głosowania regulacyjne.";
    } else if (typRaportu === "globalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (RYNKI I ŚWIAT - NAJBLIŻSZE 7 DNI):\n" +
        "- Kalendarium makro: odczyty CPI/PKB, posiedzenia banków centralnych, premiery rynkowe.";
    }
  }

  let systemPrompt = 
    "Jesteś analitykiem filtrującym dane dla mieszkańca Krakowa i inwestora.\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    instrukcjaZadaniowa + "\n\n" +
    "Analizuj tekst ze źródła: " + source.url + "\n\"\"\"" + trescZrodla + "\"\"\"\n\n" +
    "Zwróć WYŁĄCZNIE poprawny JSON: {\"dane\": [[...], [...]]}. Wiersze muszą odpowiadać ściśle polom: " + strukturaKolumn + ". Jeśli brak wartościowych wpisów, zwróć: {\"dane\": []}.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij trafione rekordy w formacie JSON." }
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
    Logger.log("Błąd API DeepSeek: " + e.message);
    return [];
  }
}

/**
 * Buduje zunifikowaną treść tabelaryczną HTML wspólną dla Emaila i PDF
 */
function generujCialoRaportuTabelarycznego(lokalne, globalnePrzeszle, globalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr, dlaPdf) {
  let stylowanieTabeli = dlaPdf 
    ? "font-size: 8px; margin-top: 8px; margin-bottom: 16px;" 
    : "font-size: 11px; margin-top: 10px; margin-bottom: 24px;";

  let html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b;">
      <h2 style="font-size: ${dlaPdf ? '13px' : '18px'}; color: #0f172a; margin-bottom: 4px;">🎯 Migawka Wydarzeń (${dzisiajStr})</h2>
      <p style="font-size: ${dlaPdf ? '8px' : '12px'}; color: #64748b; margin-top: 0; margin-bottom: 16px;">
        Raport wyselekcjonowany pod kątem czasu z córkami w Krakowie, sytuacji w regionie oraz kluczowych impulsów rynkowych.
      </p>

      <!-- TABELA 1 -->
      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #047857; border-bottom: 2px solid #047857; padding-bottom: 4px; margin-bottom: 6px;">
        🎠 1. Lokalne — Trwające i przyszłe (w tym tygodniu)
      </h3>
      ${budujTabeleUniwersalna(lokalne, naglowkiLokalne, "#047857", "#ecfdf5", stylowanieTabeli)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <!-- TABELA 2 -->
      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-bottom: 6px;">
        📊 2. Świat — Co się wydarzyło (Minione 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzeszle, naglowkiGlobalne, "#4338ca", "#e0e7ff", stylowanieTabeli)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <!-- TABELA 3 -->
      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-bottom: 6px;">
        🔮 3. Świat — Co się wydarzy (Trwające procesy & Najbliższe 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzyszle, naglowkiGlobalne, "#b45309", "#fef3c7", stylowanieTabeli)}
    </div>
  `;
  return html;
}

/**
 * Buduje tabelę z responsywnym kodem HTML, podziałem na wiersze i formatowaniem linków
 */
function budujTabeleUniwersalna(dane, naglowki, kolorGlowny, kolorWierszaAlt, stylowanieDodatkowe) {
  if (!dane || dane.length === 0) {
    return `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 16px;">Brak odnotowanych pozycji w tej kategorii.</p>`;
  }

  let html = `<table style="border-collapse: collapse; width: 100%; ${stylowanieDodatkowe}">`;
  
  // Nagłówek tabeli
  html += `<thead><tr style="background-color: ${kolorGlowny}; color: #ffffff;">`;
  naglowki.forEach(naglowek => {
    html += `<th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 600;">${naglowek}</th>`;
  });
  html += `</tr></thead><tbody>`;

  // Wiersze tabeli
  dane.forEach((wiersz, idx) => {
    let tlo = (idx % 2 === 1) ? `background-color: ${kolorWierszaAlt};` : `background-color: #ffffff;`;
    html += `<tr style="${tlo}">`;
    wiersz.forEach(komorka => {
      let tekst = String(komorka || "—");
      
      // Obsługa linku w kolumnie źródła
      if (tekst.includes("http")) {
        let czesci = tekst.split("—");
        let nazwa = czesci[0].trim();
        let url = (czesci[1] || czesci[0]).trim();
        tekst = `<a href="${url}" style="color: ${kolorGlowny}; font-weight: bold; text-decoration: none;" target="_blank">${nazwa}</a>`;
      }
      
      html += `<td style="border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; line-height: 1.35;">${tekst}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

/**
 * Wysyłka wiadomości e-mail z osadzoną tabelą oraz z tożsamym załącznikiem PDF
 */
function wyslijRaportEmailTabelaryczny(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "🎯 Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  // Treść emaila (HTML)
  let emailHtml = `
    <div style="max-width: 960px; margin: 0 auto; background-color: #ffffff; padding: 15px;">
      ${generujCialoRaportuTabelarycznego(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr, false)}
      <div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 10px; font-size: 11px; color: #94a3b8; text-align: center;">
        Raport wygenerowany automatycznie przez DeepSeek AI. Identyczne zestawienie znajdziesz w załączonym pliku PDF i Arkuszu Google.
      </div>
    </div>
  `;

  // Treść PDF (identyczna struktura w formacie A4 landscape)
  let pdfBlob = null;
  try {
    let pdfHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: A4 landscape; margin: 0.8cm; }
      body { font-family: Arial, sans-serif; }
    </style></head><body>
      ${generujCialoRaportuTabelarycznego(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr, true)}
    </body></html>`;

    let blob = Utilities.newBlob(pdfHtml, 'text/html', 'raport.html');
    pdfBlob = blob.getAs('application/pdf').setName("Migawka_Wydarzen_" + dzisiajStr + ".pdf");
  } catch (e) {
    Logger.log("Błąd generowania PDF: " + e.message);
  }

  let emailOptions = {
    to: emailAdres,
    subject: temat,
    htmlBody: emailHtml
  };

  if (pdfBlob) {
    emailOptions.attachments = [pdfBlob];
  }

  MailApp.sendEmail(emailOptions);
}

function wyczyscHtmlDoTekstu(html) {
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

function sortujIGrupujWyniki(dane, indeksGlowny, indeksPodrzedny) {
  if (!dane || dane.length === 0) return;
  dane.sort((a, b) => {
    let elA = String(a[indeksGlowny] || "");
    let elB = String(b[indeksGlowny] || "");
    if (elA !== elB) return elA.localeCompare(elB);
    return String(a[indeksPodrzedny] || "").localeCompare(String(b[indeksPodrzedny] || ""));
  });
}

function zapiszDoArkusza(ss, nazwaZakładki, dane, nagłówki) {
  let sheet = ss.getSheetByName(nazwaZakładki) || ss.insertSheet(nazwaZakładki);
  sheet.clear();
  sheet.appendRow(nagłówki);
  sheet.getRange(1, 1, 1, nagłówki.length).setFontWeight("bold").setBackground("#f1f5f9");
  if (dane && dane.length > 0) {
    let startRow = (dane[0][0] === nagłówki[0]) ? 1 : 0;
    for (let i = startRow; i < dane.length; i++) {
      sheet.appendRow(dane[i]);
    }
  }
  sheet.autoResizeColumns(1, nagłówki.length);
}

function wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  try {
    let folderyGlowne = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!folderyGlowne.hasNext()) return null;
    let folderGlowny = folderyGlowne.next();
    let podfoldery = folderGlowny.getFoldersByName(nazwaPodfolderu);
    if (!podfoldery.hasNext()) return null;
    let podfolder = podfoldery.next();
    let pliki = podfolder.getFilesByName(nazwaPliku);
    return pliki.hasNext() ? pliki.next().getBlob().getDataAsString() : null;
  } catch (e) {
    Logger.log("Błąd odczytu pliku: " + e.message);
    return null;
  }
}

function wczytajJsonZPlikuWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let tresc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
  if (!tresc) return null;
  try {
    return JSON.parse(tresc);
  } catch (e) {
    Logger.log("Błąd parsowania JSON: " + e.message);
    return null;
  }
}