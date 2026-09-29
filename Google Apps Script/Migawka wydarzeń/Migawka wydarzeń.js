/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 * - Dynamiczne pobieranie listy odbiorców z emails.txt w folderze Automation/Migawka Wydarzeń
 * - Wysyłka raportu do każdego odbiorcy kolejno w osobnym mailu
 * - Rozszerzony bufor do 25 000 znaków dla serwisów lokalnych i rynkowych
 * - Trzy rundy analizy czasowej dla każdego źródła
 * - Inteligentne wyszukiwanie kolumny daty (zapobiega pustym tabelom makro/rynków)
 * - Twarda weryfikacja dat po stronie JS z mapą dni tygodnia
 * - Ekstrakcja bezpośrednich linków do artykułów/wydarzeń
 * - Zapis do 3 zakładek w Arkuszu Google
 * - Identyczna forma tabelaryczna w e-mailu oraz w PDF
 */
function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Wczytanie źródeł, promptu i listy odbiorców z Dysku Google
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  let odbiorcyEmail = wczytajAdresyEmailZPliku("Automation", "Migawka Wydarzeń", "emails.txt");
  if (!odbiorcyEmail || odbiorcyEmail.length === 0) {
    odbiorcyEmail = [Session.getActiveUser().getEmail()];
  }

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

  // Przygotowanie jawnej mapy dni tygodnia na najbliższe 7 dni
  let dniTygodniaPL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  let mapaDniNadchodzacych = [];
  for (let i = 0; i <= 7; i++) {
    let d = new Date(dzisiaj);
    d.setDate(dzisiaj.getDate() + i);
    mapaDniNadchodzacych.push(dniTygodniaPL[d.getDay()] + " = " + formatD(d));
  }

  let kontekstCzasowy = 
    "BEZWZGLĘDNY KONTEKST KALENDARZOWY:\n" +
    "- Dzisiejsza data: " + dzisiajStr + " (" + dniTygodniaPL[dzisiaj.getDay()] + ")\n" +
    "- Okres przeszły: od " + formatD(przed7Dniami) + " do " + dzisiajStr + "\n" +
    "- Dni nadchodzącego tygodnia:\n  * " + mapaDniNadchodzacych.join("\n  * ") + "\n";

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
        // Bufor 25k znaków, aby uwzględnić kalendaria oraz serwisy makro/giełdowe
        tresciStron[url] = tekstZLinkami.length > 25000 ? tekstZLinkami.substring(0, 25000) : tekstZLinkami;
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
      zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przeszle", filtrProfilu);

      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_trwajace", filtrProfilu);
      if (r2 && Array.isArray(r2)) {
        let r2Valid = r2.filter(row => {
          if (!row || row.join(" ").toUpperCase().includes("ODRZUCONE")) return false;
          let poleDaty = znajdzPoleDatyWWierszu(row);
          return czyDataWMiasteczkuCzasowym(poleDaty, "trwajace", dzisiaj, przed7Dniami, za7Dni);
        });
        lokalneTrwajace = lokalneTrwajace.concat(r2Valid);
      }

      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przyszle", filtrProfilu);
      if (r3 && Array.isArray(r3)) {
        let r3Valid = r3.filter(row => {
          if (!row || row.join(" ").toUpperCase().includes("ODRZUCONE")) return false;
          let poleDaty = znajdzPoleDatyWWierszu(row);
          return czyDataWMiasteczkuCzasowym(poleDaty, "przyszle", dzisiaj, przed7Dniami, za7Dni);
        });
        lokalnePrzyszle = lokalnePrzyszle.concat(r3Valid);
      }
    }
  });

  // ==========================================
  // ŹRÓDŁA GLOBALNE - 3 RUNDY ANALIZY
  // ==========================================
  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let r1 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (r1 && Array.isArray(r1)) {
        let r1Valid = r1.filter(row => {
          if (!row || row.join(" ").toUpperCase().includes("ODRZUCONE")) return false;
          let poleDaty = znajdzPoleDatyWWierszu(row);
          return czyDataWMiasteczkuCzasowym(poleDaty, "przeszle", dzisiaj, przed7Dniami, za7Dni);
        });
        globalnePrzeszle = globalnePrzeszle.concat(r1Valid);
      }

      let r2 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_trwajace", filtrProfilu);
      if (r2 && Array.isArray(r2)) {
        let r2Valid = r2.filter(row => {
          if (!row || row.join(" ").toUpperCase().includes("ODRZUCONE")) return false;
          let poleDaty = znajdzPoleDatyWWierszu(row);
          return czyDataWMiasteczkuCzasowym(poleDaty, "trwajace", dzisiaj, przed7Dniami, za7Dni);
        });
        globalneTrwajace = globalneTrwajace.concat(r2Valid);
      }

      let r3 = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (r3 && Array.isArray(r3)) {
        let r3Valid = r3.filter(row => {
          if (!row || row.join(" ").toUpperCase().includes("ODRZUCONE")) return false;
          let poleDaty = znajdzPoleDatyWWierszu(row);
          return czyDataWMiasteczkuCzasowym(poleDaty, "przyszle", dzisiaj, przed7Dniami, za7Dni);
        });
        globalnePrzyszle = globalnePrzyszle.concat(r3Valid);
      }
    }
  });

  // Deduplikacja listy lokalnej
  let mapaLokalne = new Map();
  [...lokalnePrzyszle, ...lokalneTrwajace].forEach(item => {
    let klucz = (item[3] || "").toLowerCase().trim();
    if (!mapaLokalne.has(klucz)) mapaLokalne.set(klucz, item);
  });
  let tabela1Lokalne = Array.from(mapaLokalne.values());

  let tabela2GlobalnePrzeszle = globalnePrzeszle;
  let tabela3GlobalnePrzyszle = [...globalneTrwajace, ...globalnePrzyszle];

  sortujIGrupujWyniki(tabela1Lokalne, 1, 0);
  sortujIGrupujWyniki(tabela2GlobalnePrzeszle, 0, 2);
  sortujIGrupujWyniki(tabela3GlobalnePrzyszle, 0, 2);

  let naglowkiLokalne = ["Obszar / Lokalizacja", "Data / Dzień", "Godzina", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wydarzenia"];
  let naglowkiGlobalne = ["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wiadomości"];

  // Zapis do 3 zakładek w GSheet
  zapiszDoArkusza(ss, "1. Lokalne - Trwające i przyszłe (w tym tygdoniu)", tabela1Lokalne, naglowkiLokalne);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", tabela2GlobalnePrzeszle, naglowkiGlobalne);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", tabela3GlobalnePrzyszle, naglowkiGlobalne);

  // Wysłanie raportu Email (kolejno) + PDF
  wyslijRaportEmailTabelaryczny(tabela1Lokalne, tabela2GlobalnePrzeszle, tabela3GlobalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr, odbiorcyEmail);
}

/**
 * Automatycznie wyszukuje komórkę z datą bez względu na kolejność kolumn w wierszu.
 */
function znajdzPoleDatyWWierszu(row) {
  if (!row || !Array.isArray(row)) return "";
  for (let i = 0; i < Math.min(row.length, 4); i++) {
    let komorka = String(row[i] || "").trim();
    if (/\b\d{4}-\d{2}-\d{2}\b/.test(komorka) || /\b\d{2}\.\d{2}\.\d{4}\b/.test(komorka)) {
      return komorka;
    }
    if (/trwa|dzisiaj|bieżący|ostatni/i.test(komorka)) {
      return komorka;
    }
  }
  return String(row[0] || "");
}

/**
 * Wczytuje adresy e-mail z pliku tekstowego na Dysku Google.
 */
function wczytajAdresyEmailZPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let zawartosc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
  if (!zawartosc) return null;

  let suroweWpisy = zawartosc.split(/[\r\n,;]+/);
  let adresy = [];

  suroweWpisy.forEach(wpis => {
    let email = wpis.trim();
    if (email && email.includes("@") && email.includes(".")) {
      adresy.push(email);
    }
  });

  return [...new Set(adresy)];
}

/**
 * Zapytanie do modelu DeepSeek
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
      instrukcjaZadaniowa = "RUNDA 2 (KRAKÓW - WYSTAWY I ATRAKCJE TRWAJĄCE OBECNIE / DZISIAJ):\n" +
        "- Wyszukaj ekspozycje stałe, interaktywne wystawy, jarmarki i trwające festiwale rodzinne.\n" +
        "- W polu 'Data / Dzień' wpisz: 'Trwa' lub podaj dzisiejszą datę.";
    } else if (typRaportu === "lokalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (KRAKÓW - WYDARZENIA ZAPLANOWANE NA NAJBLIŻSZE 7 DNI):\n" +
        "- Wybierz WSZYSTKIE konkretne wydarzenia: teatry dla dzieci, warsztaty, pikniki, spotkania plenerowe, zajęcia sportowe i pokazy.\n" +
        "- Skorzystaj z dostarczonej listy 'Dni nadchodzącego tygodnia'. Jeśli w tekście jest np. 'sobota', przypisz odpowiadającą jej datę YYYY-MM-DD.\n" +
        "- Jeśli wydarzenie odbywa się w weekend, koniecznie je uwzględnij!";
    }
  } else {
    strukturaKolumn = '["Data wydarzenia", "Godzina", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo (wiek)", "Warunki wstępu", "Link do wiadomości"]';
    
    if (typRaportu === "globalne_przeszle") {
      instrukcjaZadaniowa = "RUNDA 1 (RYNKI I GOSPODARKA - CO SIĘ WYDARZYŁO W MINIONYCH 7 DNIACH):\n" +
        "- Twarde dane: stopy procentowe (RPP, Fed, EBC), wskaźniki inflacji, istotne ruchy na giełdach, krypto/blockchain i surowcach.\n" +
        "- Odrzuć: spory partyjne bez wpływu na finanse, sensacje, plotki.";
    } else if (typRaportu === "globalne_trwajace") {
      instrukcjaZadaniowa = "RUNDA 2 (RYNKI I GOSPODARKA - PROCESY TRWAJĄCE):\n" +
        "- Trwające szczyty gospodarcze, konferencje technologiczne, wielodniowe głosowania regulacyjne i procesy rynkowe w toku.\n" +
        "- W polu 'Data wydarzenia' wpisz: 'Trwa' lub dzisiejszą datę.";
    } else if (typRaportu === "globalne_przyszle") {
      instrukcjaZadaniowa = "RUNDA 3 (RYNKI I GOSPODARKA - KALENDARIUM NA NAJBLIŻSZE 7 DNI):\n" +
        "- Zaplanowane publikacje kluczowych danych (CPI, PKB), posiedzenia banków centralnych, premiery technologiczne o znaczeniu inwestycyjnym.";
    }
  }

  let systemPrompt = 
    "Jesteś skutecznym asystentem analitycznym dla inwestora i ojca z Krakowa.\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    instrukcjaZadaniowa + "\n\n" +
    "REGUŁY KALENDARZOWE:\n" +
    "1. Format daty MUSI wynosić YYYY-MM-DD (np. 2026-10-03), zakres 'YYYY-MM-DD - YYYY-MM-DD' lub 'Trwa'.\n" +
    "2. Sprawdź miesiąc: Uważaj, by nie brać artykułów sprzed miesiąca. Jeśli tekst jawnie opisuje wydarzenie sprzed miesiąca — pomiń je.\n" +
    "3. Ekstrakcja linku: W ostatniej kolumnie podaj bezpośredni link do wydarzenia znaleziony w tekście (np. 'Nazwa — https://...').\n\n" +
    "Przeanalizuj treść ze źródła (" + source.url + "):\n\"\"\"" + trescZrodla + "\"\"\"\n\n" +
    "Zwróć poprawny JSON: {\"dane\": [[...], [...]]}. Pola w wierszu muszą ściśle odpowiadać: " + strukturaKolumn + ". Jeśli brak pozycji, zwróć: {\"dane\": []}.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij wszystkie trafione pozycje na nadchodzące dni w formacie JSON." }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
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
 * Uelastyczniona walidacja daty w JS (obsługuje zakresy, słowa kluczowe i daty YYYY-MM-DD)
 */
function czyDataWMiasteczkuCzasowym(dataStr, typOkna, dzisiaj, przed7Dni, za7Dni) {
  if (!dataStr) return false;
  let str = String(dataStr).trim();

  // Wpisy stałe lub bezterminowe
  if (str.toLowerCase().includes("trwa") || str.toLowerCase().includes("dzisiaj") || str.toLowerCase().includes("bieżący")) {
    return (typOkna === "trwajace" || typOkna === "przyszle");
  }

  // Wyszukanie pierwszej daty w formacie YYYY-MM-DD
  let match = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) {
    let matchPL = str.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (matchPL) {
      match = [null, matchPL[3], matchPL[2], matchPL[1]];
    } else {
      // Jeśli AI podało inny opis tekstowy, nie odrzucamy pochopnie
      return true;
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
    return dataWydarzenia.getTime() === d0.getTime() || str.toLowerCase().includes("trwa");
  } else if (typOkna === "przyszle") {
    return dataWydarzenia >= d0 && dataWydarzenia <= dPlus7;
  }
  return false;
}

/**
 * Zamienia HTML na tekst z zachowaniem linków
 */
function wyczyscHtmlZZachowaniemLinkow(html, baseUrl) {
  let domain = "";
  try {
    let match = baseUrl.match(/^(https?:\/\/[^\/]+)/);
    if (match) domain = match[1];
  } catch (e) {}

  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
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
 * Zunifikowana treść tabelaryczna HTML wspólna dla Emaila i PDF
 */
function generujCialoRaportuTabelarycznego(lokalne, globalnePrzeszle, globalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr, dlaPdf) {
  let stylowanieTabeli = dlaPdf 
    ? "font-size: 8px; margin-top: 8px; margin-bottom: 16px;" 
    : "font-size: 11px; margin-top: 10px; margin-bottom: 24px;";

  let html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b;">
      <h2 style="font-size: ${dlaPdf ? '13px' : '18px'}; color: #0f172a; margin-bottom: 4px;">🎯 Migawka Wydarzeń (${dzisiajStr})</h2>
      <p style="font-size: ${dlaPdf ? '8px' : '12px'}; color: #64748b; margin-top: 0; margin-bottom: 16px;">
        Wyselekcjonowane wydarzenia rodzinne w Krakowie oraz kluczowe informacje makroekonomiczne.
      </p>

      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #047857; border-bottom: 2px solid #047857; padding-bottom: 4px; margin-bottom: 6px;">
        🎠 1. Lokalne — Trwające i przyszłe (w tym tygodniu)
      </h3>
      ${budujTabeleUniwersalna(lokalne, naglowkiLokalne, "#047857", "#ecfdf5", stylowanieTabeli, dlaPdf)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-bottom: 6px;">
        📊 2. Świat — Co się wydarzyło (Minione 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzeszle, naglowkiGlobalne, "#4338ca", "#e0e7ff", stylowanieTabeli, dlaPdf)}

      ${dlaPdf ? '<div style="page-break-before: always;"></div>' : ''}

      <h3 style="font-size: ${dlaPdf ? '10px' : '14px'}; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-bottom: 6px;">
        🔮 3. Świat — Co się wydarzy (Trwające procesy & Najbliższe 7 dni)
      </h3>
      ${budujTabeleUniwersalna(globalnePrzyszle, naglowkiGlobalne, "#b45309", "#fef3c7", stylowanieTabeli, dlaPdf)}
    </div>
  `;
  return html;
}

/**
 * Buduje tabelę HTML
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
 * Formatowanie linku do komórki
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
 * Wysyłka raportu tabelarycznego sekwencyjnie do każdego odbiorcy
 */
function wyslijRaportEmailTabelaryczny(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr, listaOdbiorcow) {
  let odbiorcy = Array.isArray(listaOdbiorcow) ? listaOdbiorcow : [listaOdbiorcow];
  if (odbiorcy.length === 0) {
    Logger.log("Brak odbiorców do wysyłki.");
    return;
  }

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

  odbiorcy.forEach((adresat, index) => {
    let emailCzysty = adresat.trim();
    if (!emailCzysty) return;

    let emailOptions = {
      to: emailCzysty,
      subject: temat,
      htmlBody: emailHtml
    };

    if (pdfBlob) {
      emailOptions.attachments = [pdfBlob];
    }

    try {
      MailApp.sendEmail(emailOptions);
      Logger.log(`[${index + 1}/${odbiorcy.length}] Wysłano raport do: ${emailCzysty}`);
      
      if (index < odbiorcy.length - 1) {
        Utilities.sleep(500);
      }
    } catch (err) {
      Logger.log(`Błąd podczas wysyłki do ${emailCzysty}: ${err.message}`);
    }
  });
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