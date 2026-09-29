/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 * - 3 rundy analizy czasowej dla każdego źródła
 * - Twarda weryfikacja poprawności i aktualności dat po stronie kodu JS
 * - Ekstrakcja dokładnych linków źródłowych do konkretnych wydarzeń
 * - Zapis do 3 zakładek w Arkuszu Google
 * - Identyczna forma tabelaryczna w e-mailu oraz w załączniku PDF
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
        let tekstZLinkami = wyczyscHtmlZZachowaniemLinkow(resp.getContentText(), url);
        tresciStron[url] = tekstZLinkami.length > 5000 ? tekstZLinkami.substring(0, 5000) : tekstZLinkami;
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
  // ŹRÓDŁA LOKALNE - 3 RUNDY Z TWARDĄ WERYFIKACJĄ
  // ==========================================
  SOURCES_LOKALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      // Runda 1: Przeszłe (analizowane w tle)
      zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przeszle", filtrProfilu);

      // Runda 2: Trwające
      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_trwajace", filtrProfilu);
      if (r2) {
        let r2Valid = r2.filter(row => {
          let str = row.join(" ").toUpperCase();
          if (str.includes("ODRZUCONE")) return false;
          return czyDataWMiasteczkuCzasowym(row[1], "trwajace", dzisiaj, przed7Dniami, za7Dni);
        });
        lokalneTrwajace = lokalneTrwajace.concat(r2Valid);
      }

      // Runda 3: Przyszłe (nadchodzący tydzień)
      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przyszle", filtrProfilu);
      if (r3) {
        let r3Valid = r3.filter(row => {
          let str = row.join(" ").toUpperCase();
          if (str.includes("ODRZUCONE")) return false;
          return czyDataWMiasteczkuCzasowym(row[1], "przyszle", dzisiaj, przed7Dniami, za7Dni);
        });
        lokalnePrzyszle = lokalnePrzyszle.concat(r3Valid);
      }
    }
  });

  // ==========================================
  // ŹRÓDŁA GLOBALNE - 3 RUNDY Z TWARDĄ WERYFIKACJĄ
  // ==========================================
  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      // Runda 1: Świat - Co się wydarzyło (przeszłe)
      let r1 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (r1) {
        let r1Valid = r1.filter(row => {
          let str = row.join(" ").toUpperCase();
          if (str.includes("ODRZUCONE")) return false;
          return czyDataWMiasteczkuCzasowym(row[0], "przeszle", dzisiaj, przed7Dniami, za7Dni);
        });
        globalnePrzeszle = globalnePrzeszle.concat(r1Valid);
      }

      // Runda 2: Świat - Trwające
      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_trwajace", filtrProfilu);
      if (r2) {
        let r2Valid = r2.filter(row => {
          let str = row.join(" ").toUpperCase();
          if (str.includes("ODRZUCONE")) return false;
          return czyDataWMiasteczkuCzasowym(row[0], "trwajace", dzisiaj, przed7Dniami, za7Dni);
        });
        globalneTrwajace = globalneTrwajace.concat(r2Valid);
      }

      // Runda 3: Świat - Co się wydarzy (przyszłe)
      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (r3) {
        let r3Valid = r3.filter(row => {
          let str = row.join(" ").toUpperCase();
          if (str.includes("ODRZUCONE")) return false;
          return czyDataWMiasteczkuCzasowym(row[0], "przyszle", dzisiaj, przed7Dniami, za7Dni);
        });
        globalnePrzyszle = globalnePrzyszle.concat(r3Valid);
      }
    }
  });

  // Agregacja wyników do 3 docelowych zestawień
  let tabela1Lokalne = [...lokalneTrwajace, ...lokalnePrzyszle];
  let tabela2GlobalnePrzeszle = globalnePrzeszle;
  let tabela3GlobalnePrzyszle = [...globalneTrwajace, ...globalnePrzyszle];

  sortujIGrupujWyniki(tabela1Lokalne, 0, 1);
  sortujIGrupujWyniki(tabela2GlobalnePrzeszle, 0, 2);
  sortujIGrupujWyniki(tabela3GlobalnePrzyszle, 0, 2);

  let naglowkiLokalne = ["Obszar / Lokalizacja", "Data / Dzień", "Godzina", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wydarzenia"];
  let naglowkiGlobalne = ["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wiadomości"];

  // Zapis do 3 zakładek w GSheet
  zapiszDoArkusza(ss, "1. Lokalne - Trwające i przyszłe (w tym tygdoniu)", tabela1Lokalne, naglowkiLokalne);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", tabela2GlobalnePrzeszle, naglowkiGlobalne);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", tabela3GlobalnePrzyszle, naglowkiGlobalne);

  // Wysłanie raportu Email + PDF
  wyslijRaportEmailTabelaryczny(tabela1Lokalne, tabela2GlobalnePrzeszle, tabela3GlobalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr);
}

/**
 * Odpytanie modelu DeepSeek z naciskiem na ekstrakcję linku i zakaz halucynacji dat
 */
function zapytajDeepSeekDlaTresc(source, trescZrodla, kontekstCzasowy, typRaportu, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY.");

  const url = "https://api.deepseek.com/chat/completions";

  let instrukcjaZadaniowa = "";
  let strukturaKolumn = "";

  if (typRaportu.startsWith("lokalne")) {
    strukturaKolumn = '["Obszar / Lokalizacja", "Data / Dzień", "Godzina", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wydarzenia"]';
    
    if (typRaportu === "lokalne_przeszle") {
      instrukcjaZadaniowa = "RUNDA 1: Zakończone w ostatnich 7 dniach kluczowe inwestycje lub uchwały w Krakowie.";
    } else if (typRaportu === "lokalne_trwajace") {
      instrukcjaZadaniowa = "RUNDA 2 (KRAKÓW - TRWAJĄCE OBECNIE / DZISIAJ):\n" +
        "- Wyszukaj trwające wystawy, jarmarki, ekspozycje i festiwale idealne dla rodziny z dziećmi (dziewczynki 5-7 lat) oraz trwające utrudnienia drogowe.\n" +
        "- Odrzuć: kursy dla dorosłych, spotkania emerytów, kronikę kryminalną.";
    } else if (typRaportu === "lokalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (KRAKÓW - NADCHODZĄCE 7 DNI):\n" +
        "- Zapowiedzi: warsztaty, teatry dziecięce, plener, pikniki edukacyjne i zaplanowane utrudnienia drogowe w Krakowie.\n" +
        "- Odrzuć: poezję dla dorosłych, posiedzenia rad dzielnic, szum informacyjny.";
    }
  } else {
    strukturaKolumn = '["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wiadomości"]';
    
    if (typRaportu === "globalne_przeszle") {
      instrukcjaZadaniowa = "RUNDA 1 (RYNKI I ŚWIAT - MINIONE 7 DNI):\n" +
        "- Twarde dane: decyzje RPP/FED/EBC, inflacja, krypto/blockchain, surowce i indeksy.";
    } else if (typRaportu === "globalne_trwajace") {
      instrukcjaZadaniowa = "RUNDA 2 (RYNKI I ŚWIAT - TRWAJĄCE SZCZYTY I PROCESY):\n" +
        "- Trwające szczyty gospodarcze, konferencje technologiczne, procesy legislacyjne.";
    } else if (typRaportu === "globalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (RYNKI I ŚWIAT - NAJBLIŻSZE 7 DNI):\n" +
        "- Kalendarium makro: odczyty CPI/PKB, posiedzenia banków centralnych, premiery rynkowe.";
    }
  }

  let systemPrompt = 
    "Jesteś precyzyjnym analitykiem danych i kuratorem informacji.\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    instrukcjaZadaniowa + "\n\n" +
    "ŻELAZNE ZASADY KALENDARZOWE I WERYFIKACJI DAT:\n" +
    "1. Format daty MUSI wynosić YYYY-MM-DD (np. 2026-10-06) lub 'Trwa'.\n" +
    "2. KATEGORYCZNY ZAKAZ ZGADYWANIA LUB ZMIENIANIA MIESIĄCA: Zwróć szczególną uwagę na kontekst tekstu. Jeśli wydarzenie odbyło się w innym miesiącu (np. we wrześniu), pod żadnym pozorem nie wpisuj przyszłego miesiąca (np. października)! Jeśli data nie wpisuje się w zadany okres — pomiń rekord całkowicie.\n" +
    "3. Weryfikuj dzień tygodnia: Upewnij się, że podana data i dzień tygodnia są matematycznie spójne z kalendarzem na rok 2026.\n\n" +
    "BEZWZGLĘDNY NAKAZ DOTYCZĄCY LINKÓW:\n" +
    "Dla każdego wydarzenia lub wiadomości MUSISZ odnaleźć i podać bezpośredni link URL (np. https://strona.pl/wydarzenie-123), na podstawie którego wyłapałeś daną informację z tekstu.\n" +
    "W ostatniej kolumnie wpisz:\n" +
    "'Nazwa Źródła — https://dokladny-adres-url-artykulu'\n" +
    "Jeśli w tekście nie ma bezpośredniego linku do artykułu, użyj adresu bazowego: '" + source.url + "'.\n\n" +
    "Przeanalizuj treść ze źródła (" + source.url + "):\n\"\"\"" + trescZrodla + "\"\"\"\n\n" +
    "Zwróć WYŁĄCZNIE poprawny JSON: {\"dane\": [[...], [...]]}. Wiersze muszą zawierać: " + strukturaKolumn + ". Jeśli brak wartościowych wpisów, zwróć: {\"dane\": []}.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij trafione rekordy wraz ze zweryfikowanymi datami i bezpośrednimi linkami w formacie JSON." }
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
    Logger.log("Błąd zapytania DeepSeek: " + e.message);
    return [];
  }
}

/**
 * Sprawdza programistycznie, czy wyekstrahowana data mieści się w określonym oknie czasowym
 */
function czyDataWMiasteczkuCzasowym(dataStr, typOkna, dzisiaj, przed7Dni, za7Dni) {
  if (!dataStr) return false;
  let str = String(dataStr).trim();

  if (str.toLowerCase().includes("trwa") || str.toLowerCase().includes("dzisiaj")) {
    return (typOkna === "trwajace" || typOkna === "przyszle");
  }

  let match = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) {
    let matchPL = str.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (matchPL) {
      match = [null, matchPL[3], matchPL[2], matchPL[1]];
    } else {
      return false;
    }
  }

  let rok = parseInt(match[1], 10);
  let miesiac = parseInt(match[2], 10) - 1;
  let dzien = parseInt(match[3], 10);

  let dataWydarzenia = new Date(rok, miesiac, dzien);
  dataWydarzenia.setHours(0, 0, 0, 0);

  let d0 = new Date(dzisiaj); d0.setHours(0, 0, 0, 0);
  let dMinus7 = new Date(przed7Dni); dMinus7.setHours(0, 0, 0, 0);
  let dPlus7 = new Date(za7Dni); dPlus7.setHours(23, 59, 59, 999);

  if (typOkna === "przeszle") {
    return dataWydarzenia >= dMinus7 && dataWydarzenia <= d0;
  } else if (typOkna === "trwajace") {
    return dataWydarzenia.getTime() === d0.getTime();
  } else if (typOkna === "przyszle") {
    return dataWydarzenia >= d0 && dataWydarzenia <= dPlus7;
  }
  return false;
}

/**
 * Zamienia HTML na tekst z zachowaniem linków w tagach <a>
 */
function wyczyscHtmlZZachowaniemLinkow(html, baseUrl) {
  let domain = "";
  try {
    let match = baseUrl.match(/^(https?:\/\/[^\/]+)/);
    if (match) domain = match[1];
  } catch (e) {}

  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

  // Zamiana znaczników blokowych na entery, aby zachować powiązanie daty z tytułem
  text = text.replace(/<\/(div|p|li|article|section|tr|h\d)>/gi, "\n");

  text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, function(match, href, anchorText) {
    let czystyAnchor = anchorText.replace(/<[^>]+>/g, "").trim();
    if (!czystyAnchor || czystyAnchor.length < 3) return "";
    
    let pelnyUrl = href;
    if (href.startsWith("/")) {
      pelnyUrl = domain + href;
    } else if (!href.startsWith("http")) {
      pelnyUrl = baseUrl.replace(/\/?$/, "/") + href;
    }
    
    if (pelnyUrl.includes("javascript:") || pelnyUrl.includes("#")) return czystyAnchor;
    return czystyAnchor + " [Link: " + pelnyUrl + "] ";
  });

  text = text.replace(/<[^>]+>/g, " ");
  return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
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
      ${budujTabeleUniwersalna(lokalne, naglowkiLokalne, "#047857", "#ecfdf5", stylowanieTabeli, dlaPdf)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <!-- TABELA 2 -->
      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-bottom: 6px;">
        📊 2. Świat — Co się wydarzyło (Minione 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzeszle, naglowkiGlobalne, "#4338ca", "#e0e7ff", stylowanieTabeli, dlaPdf)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <!-- TABELA 3 -->
      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-bottom: 6px;">
        🔮 3. Świat — Co się wydarzy (Trwające procesy & Najbliższe 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzyszle, naglowkiGlobalne, "#b45309", "#fef3c7", stylowanieTabeli, dlaPdf)}
    </div>
  `;
  return html;
}

/**
 * Buduje tabelę HTML z linkami źródłowymi
 */
function budujTabeleUniwersalna(dane, naglowki, kolorGlowny, kolorWierszaAlt, stylowanieDodatkowe, dlaPdf) {
  if (!dane || dane.length === 0) {
    return `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 16px;">Brak odnotowanych pozycji w tej kategorii.</p>`;
  }

  let html = `<table style="border-collapse: collapse; width: 100%; ${stylowanieDodatkowe}">`;
  
  html += `<thead><tr style="background-color: ${kolorGlowny}; color: #ffffff;">`;
  naglowki.forEach(naglowek => {
    html += `<th style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 600;">${naglowek}</th>`;
  });
  html += `</tr></thead><tbody>`;

  dane.forEach((wiersz, idx) => {
    let tlo = (idx % 2 === 1) ? `background-color: ${kolorWierszaAlt};` : `background-color: #ffffff;`;
    html += `<tr style="${tlo}">`;
    wiersz.forEach((komorka, colIdx) => {
      let tekst = String(komorka || "—").trim();
      let jestOstatniaKolumna = (colIdx === wiersz.length - 1);
      
      if (jestOstatniaKolumna || tekst.includes("http")) {
        tekst = formatujKomorkeZLinkiem(tekst, kolorGlowny, dlaPdf);
      }
      
      html += `<td style="border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; line-height: 1.35;">${tekst}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

/**
 * Formatuje link do czytelnego przycisku lub hiperłącza
 */
function formatujKomorkeZLinkiem(tekst, kolor, dlaPdf) {
  if (!tekst || tekst === "—") return "—";

  let matchUrl = tekst.match(/https?:\/\/[^\s"'<>\)]+/);
  if (matchUrl) {
    let url = matchUrl[0];
    let etykieta = "Przejdź do źródła ↗";
    
    if (tekst.includes("—")) {
      etykieta = tekst.split("—")[0].trim();
    } else if (tekst.includes("[")) {
      etykieta = tekst.split("[")[0].trim();
    }

    if (dlaPdf) {
      return `<a href="${url}" style="color: ${kolor}; text-decoration: underline; font-weight: bold;">${etykieta}</a>`;
    } else {
      return `<a href="${url}" target="_blank" style="background-color: ${kolor}; color: #ffffff; text-decoration: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block;">${etykieta} ↗</a>`;
    }
  }
  return tekst;
}

/**
 * Wysyłka wiadomości e-mail z tabelą i załącznikiem PDF
 */
function wyslijRaportEmailTabelaryczny(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "🎯 Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  let emailHtml = `
    <div style="max-width: 980px; margin: 0 auto; background-color: #ffffff; padding: 15px;">
      ${generujCialoRaportuTabelarycznego(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr, false)}
      <div style="border-top: 1px solid #e2e8f0; margin-top: 20px; padding-top: 10px; font-size: 11px; color: #94a3b8; text-align: center;">
        Raport wygenerowany przez DeepSeek AI. Wszystkie pozycje zawierają bezpośrednie odnośniki do źródeł wydarzeń.
      </div>
    </div>
  `;

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