/**
 * Główna funkcja uruchamiająca pobieranie, precyzyjną filtrację dat, sortowanie i wysyłkę raportu 3-sekcyjnego.
 */
function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Źródła dla sekcji Lokalnej / Dzieci / Kultura
  const SOURCES_LOKALNE = [
    { url: "https://przedszkole140.blizej.info/", group: "Szkoły / Przedszkola" },
    { url: "https://sokolska.ckpodgorza.pl/", group: "Szkoły / CK Podgórza" },
    { url: "https://borek.ckpodgorza.pl/", group: "Szkoły / CK Podgórza" },
    { url: "https://iskierka.ckpodgorza.pl/", group: "Szkoły / CK Podgórza" },
    { url: "https://smcegielniana.pl/kategoria/aktualnosci", group: "Łagiewniki" },
    { url: "https://dzielnica9.krakow.pl/", group: "Łagiewniki" },
    { url: "https://wydarzenia.miasto-info.pl/", group: "Myślenice" },
    { url: "https://csm.tarnow.pl/wydarzenia/dla-dzieci", group: "Tarnów" },
    { url: "https://kultura.tarnow.pl/wydarzenia/miesiac/", group: "Tarnów" },
    { url: "https://www.malopolska.pl/", group: "Małopolska" }
  ];

  // Źródła dla sekcji Świat / Polityka / Gospodarka
  const SOURCES_GLOBALNE = [
    { url: "https://zero.pl/kategoria/kraj", group: "Polska" },
    { url: "https://forsal.pl/", group: "Polska/Gospodarka" },
    { url: "https://www.reuters.com", group: "Świat/Polityka" },
    { url: "https://www.politico.eu", group: "Europa/Polityka" },
    { url: "https://biznes.pap.pl", group: "Polska/Gospodarka" },
    { url: "https://www.rp.pl/wydarzenia/swiat", group: "Świat" }
  ];

  let rawDataLokalne = pobierzDaneZeZrodel(SOURCES_LOKALNE);
  let rawDataGlobalne = pobierzDaneZeZrodel(SOURCES_GLOBALNE);

  // Precyzyjne wyliczenie okien czasowych
  let dzisiaj = new Date();
  let dzisiajStr = dzisiaj.toISOString().split('T')[0];
  
  let za7Dni = new Date(dzisiaj);
  za7Dni.setDate(dzisiaj.getDate() + 7);
  
  let przed7Dniami = new Date(dzisiaj);
  przed7Dniami.setDate(dzisiaj.getDate() - 7);

  let formatD = (d) => d.toISOString().split('T')[0];

  let kontekstCzasowy = "BEZWZGLĘDNE RAMY KALENDARZOWE (Dzisiejsza data to: " + dzisiajStr + "):\n" +
                        "- Okres przeszły (co się wydarzyło): od " + formatD(przed7Dniami) + " do " + dzisiajStr + "\n" +
                        "- Okres przyszły (co się wydarzy / planowane): od " + dzisiajStr + " do " + formatD(za7Dni);

  // 1. Sekcja 1: Lokalne, Dzieci, Kultura (TYLKO PRZYSZŁE W TYGODNIU)
  let wynikiLokale = zapytajDeepSeek(kontekstCzasowy + "\n" + rawDataLokalne.join("\n"), "lokalne_przyszle");

  // 2. Sekcja 2 i 3: Świat, Polityka, Gospodarka (Przeszłe oraz Przyszłe)
  let wynikiGlobalnePrzeszle = zapytajDeepSeek(kontekstCzasowy + "\n" + rawDataGlobalne.join("\n"), "globalne_przeszle");
  let wynikiGlobalnePrzyszle = zapytajDeepSeek(kontekstCzasowy + "\n" + rawDataGlobalne.join("\n"), "globalne_przyszle");

  // Nagłówki tabel zgodne z nowym układem
  let naglowki1 = ["Lokalizacja", "Data / Dzień", "Tytuł / Temat", "Streszczenie merytoryczne", "Link"];
  let naglowki2 = ["Data artykułu / wydarzenia", "Zasięg / Obszar", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Link"];

  // Zapis do arkuszy Google Sheets (3 zakładki)
  zapiszDoArkusza(ss, "1. Lokalne - Przyszłe", wynikiLokale, naglowki1);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", wynikiGlobalnePrzeszle, naglowki2);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", wynikiGlobalnePrzyszle, naglowki2);

  // Wysyłka sformatowanego maila z kolorowymi tabelami i datą w tytule
  wyslijRaportEmail(wynikiLokale, wynikiGlobalnePrzeszle, wynikiGlobalnePrzyszle, naglowki1, naglowki2, dzisiajStr);
}

/**
 * Pomocnicza funkcja pobierająca dane ze wskazanej listy źródeł.
 */
function pobierzDaneZeZrodel(sourcesList) {
  let rawData = [];
  sourcesList.forEach(source => {
    try {
      let response = UrlFetchApp.fetch(source.url, {
        muteHttpExceptions: true,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      let html = response.getContentText();
      
      let matches = html.matchAll(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
      let count = 0;
      
      for (let match of matches) {
        if (count >= 15) break;
        let href = match[1];
        let text = match[2].replace(/<[^>]*>?/gm, '').trim();
        
        if (text.length > 20) {
          if (href.startsWith('/')) {
            let matchOrigin = source.url.match(/^(https?:\/\/[^\/]+)/i);
            let baseUrl = matchOrigin ? matchOrigin[1] : '';
            href = baseUrl + href;
          } else if (!href.startsWith('http')) {
            href = source.url.endsWith('/') ? source.url + href : source.url + '/' + href;
          }
          
          rawData.push("Źródło [" + source.group + "] (" + source.url + "): Tytuł/Treść: \"" + text + "\" [Link: " + href + "]");
          count++;
        }
      }
    } catch (e) {
      Logger.log("Błąd pobierania " + source.url + ": " + e.message);
    }
  });
  return rawData;
}

/**
 * Główna funkcja analityczna DeepSeek z rygorystycznym filtrowaniem dat i wyciąganiem dokładnych dat artykułów.
 */
function zapytajDeepSeek(textData, typRaportu) {
  // Pobieranie klucza API bezpiecznie ze Script Properties
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) {
    throw new Error("Brak skonfigurowanego klucza DEEPSEEK_API_KEY w Właściwościach skryptu (Script Properties).");
  }
  
  const url = "https://api.deepseek.com/chat/completions";

  let instrukcjaSpecyficzna = "";
  let strukturaKolumn = "";

  if (typRaportu === "lokalne_przyszle") {
    instrukcjaSpecyficzna = 
      "KRYTERIUM CZASOWE I UKŁAD DLA SEKCJI 1 (Lokalne, Społeczne, Dzieci, Kultura - WYŁĄCZNIE PRZYSZŁE):\n" +
      "- Wybierz TYLKO te wydarzenia, które odbędą się w PRZYSZŁOŚCI w ciągu najbliższych 7 dni.\n" +
      "- BEZWZGLĘDNIE ODRZUĆ wszystko, co już się odbyło lub ma datę w odległej przyszłości.\n" +
      "- UKŁAD KOLUMN (zwróć w tej dokładnie kolejności w tablicy):\n" +
      "  1. Lokalizacja (np. Kraków, Myślenice, Tarnów, Łagiewniki itp.) - POSORTUJ WYNIKI ALFABETYCZNIE WG TEJ KOLUMNY!\n" +
      "  2. Data / Dzień (dokładna data lub dzień tygodnia wydarzenia)\n" +
      "  3. Tytuł / Temat\n" +
      "  4. Streszczenie merytoryczne\n" +
      "  5. Link";
    strukturaKolumn = "\"Lokalizacja\", \"Data / Dzień\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Link\"";
  } else if (typRaportu === "globalne_przeszle") {
    instrukcjaSpecyficzna = 
      "KRYTERIUM CZASOWE I UKŁAD DLA SEKCJI 2 (Świat, Polityka, Gospodarka - CO SIĘ WYDARZYŁO):\n" +
      "- Wybierz TYLKO wiadomości z MINIONYCH 7 DNI.\n" +
      "- WYCIĄGNIJ DOKŁADNĄ DATĘ: W pierwszej kolumnie podaj dokładną datę publikacji artykułu lub faktycznego wydarzenia (RRRR-MM-DD).\n" +
      "- UKŁAD KOLUMN (zwróć w tej dokładnie kolejności w tablicy):\n" +
      "  1. Data artykułu / wydarzenia\n" +
      "  2. Zasięg / Obszar (np. Polska, Europa, Świat) - POSORTUJ WYNIKI WG TEJ KOLUMNY!\n" +
      "  3. Kategoria\n" +
      "  4. Tytuł / Temat\n" +
      "  5. Streszczenie merytoryczne\n" +
      "  6. Link";
    strukturaKolumn = "\"Data artykułu / wydarzenia\", \"Zasięg / Obszar\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Link\"";
  } else if (typRaportu === "globalne_przyszle") {
    instrukcjaSpecyficzna = 
      "KRYTERIUM CZASOWE I UKŁAD DLA SEKCJI 3 (Świat, Polityka, Gospodarka - CO SIĘ WYDARZY):\n" +
      "- Wybierz TYLKO zapowiedzi na NAJBLIŻSZE 7 DNI.\n" +
      "- WYCIĄGNIJ DOKŁADNĄ DATĘ: W pierwszej kolumnie podaj zaplanowaną datę tego wydarzenia / publikacji (RRRR-MM-DD).\n" +
      "- UKŁAD KOLUMN (zwróć w tej dokładnie kolejności w tablicy):\n" +
      "  1. Data artykułu / wydarzenia\n" +
      "  2. Zasięg / Obszar (np. Polska, Europa, Świat) - POSORTUJ WYNIKI WG TEJ KOLUMNY!\n" +
      "  3. Kategoria\n" +
      "  4. Tytuł / Temat\n" +
      "  5. Streszczenie merytoryczne\n" +
      "  6. Link";
    strukturaKolumn = "\"Data artykułu / wydarzenia\", \"Zasięg / Obszar\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Link\"";
  }

  let systemPrompt = "Jesteś bezwzględnym analitykiem mediów i fact-checkerem. Analizujesz nagłówki, daty oraz linki.\n\n" +
                     textData + "\n\n" +
                     instrukcjaSpecyficzna + "\n\n" +
                     "Zwróć wynik ŚCISLE w formacie JSON (bez żadnego formatowania markdown, sam czysty tekst):\n" +
                     "{\n  \"dane\": [\n    [" + strukturaKolumn + "]\n  ]\n}";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Przeanalizuj surowe dane i zwróć przefiltrowany JSON zgodnie z wytycznymi." }
    ],
    response_format: { type: "json_object" },
    temperature: 0.0
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    let response = UrlFetchApp.fetch(url, options);
    let responseText = response.getContentText();
    let json = JSON.parse(responseText);
    
    if (json.error) {
      Logger.log("Błąd API DeepSeek: " + JSON.stringify(json.error));
      return [];
    }
    
    let content = json.choices[0].message.content;
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsed = JSON.parse(content);
    return parsed.dane || [];
  } catch (e) {
    Logger.log("Błąd krytyczny DeepSeek: " + e.message);
    return [];
  }
}

/**
 * Pomocnicza funkcja do czyszczenia i nadpisywania arkusza nowymi danymi.
 */
function zapiszDoArkusza(ss, nazwaZakładki, dane, nagłówki) {
  let sheet = ss.getSheetByName(nazwaZakładki);
  if (!sheet) {
    sheet = ss.insertSheet(nazwaZakładki);
  }
  
  sheet.clear();
  sheet.appendRow(nagłówki);
  sheet.getRange(1, 1, 1, nagłówki.length).setFontWeight("bold").setBackground("#f3f3f3");
  
  if (dane && dane.length > 0) {
    let startRow = (dane[0][0] === nagłówki[0]) ? 1 : 0;
    for (let i = startRow; i < dane.length; i++) {
      sheet.appendRow(dane[i]);
    }
  }
  
  sheet.autoResizeColumns(1, nagłówki.length);
}

/**
 * Funkcja formatująca i wysyłająca 3-częściowy raport na e-mail z kolorowymi tabelami i datą w tytule.
 */
function wyslijRaportEmail(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "📰 Migawka wydarzeń (" + dzisiajStr + ")";

  let htmlBody = "<h2 style=\"color: #2c3e50;\">Automatyczny Przegląd Wiadomości i Wydarzeń (" + dzisiajStr + ")</h2>" +
                 "<p>Poniżej znajduje się rygorystycznie przefiltrowany raport podzielony na trzy kluczowe sekcje czasowe.</p>" +
                 "<h3 style=\"color: #16a085; border-bottom: 2px solid #16a085; padding-bottom: 5px;\">1. Lokalne, Społeczne, Dzieci i Kultura (Nadchodzące wydarzenia)</h3>";

  if (!lokalnePrzyszle || lokalnePrzyszle.length === 0) {
    htmlBody += "<p><em>Brak nadchodzących wydarzeń spełniających kryteria w najbliższych dniach.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(lokalnePrzyszle, naglowki1, "#16a085", "#e8f8f5");
  }

  htmlBody += "<h3 style=\"color: #2980b9; border-bottom: 2px solid #2980b9; padding-bottom: 5px; margin-top: 30px;\">2. Świat, Polityka, Gospodarka – Co się wydarzyło (Minione 7 dni)</h3>";

  if (!globalnePrzeszle || globalnePrzeszle.length === 0) {
    htmlBody += "<p><em>Brak istotnych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzeszle, naglowki2, "#2980b9", "#ebf5fb");
  }

  htmlBody += "<h3 style=\"color: #d35400; border-bottom: 2px solid #d35400; padding-bottom: 5px; margin-top: 30px;\">3. Świat, Polityka, Gospodarka – Co się wydarzy (Zapowiedzi na 7 dni)</h3>";

  if (!globalnePrzyszle || globalnePrzyszle.length === 0) {
    htmlBody += "<p><em>Brak zapowiadanych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzyszle, naglowki2, "#d35400", "#fef5e7");
  }

  htmlBody += "<br><hr><p style=\"font-size: 11px; color: #7f8c8d;\">Raport wygenerowany automatycznie przez Google Apps Script i DeepSeek AI.</p>";

  MailApp.sendEmail({
    to: emailAdres,
    subject: temat,
    htmlBody: htmlBody
  });
}

/**
 * Pomocnicza funkcja zamieniająca tablicę danych na ładną, kolorową tabelę HTML.
 */
function generujTabeleHtml(dane, nagłówki, kolorNaglowka, kolorTla) {
  let html = "<table style=\"border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; margin-top: 10px;\">";
  
  html += "<tr style=\"background-color: " + kolorNaglowka + "; color: white;\">";
  nagłówki.forEach(naglowek => {
    html += "<th style=\"border: 1px solid #bdc3c7; padding: 8px; text-align: left;\">" + naglowek + "</th>";
  });
  html += "</tr>";

  let i = 0;
  dane.forEach(wiersz => {
    let stylTla = (i % 2 === 0) ? "background-color: #ffffff;" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + "\">";
    wiersz.forEach((komorka, index) => {
      let zawartosc = komorka;
      if (index === wiersz.length - 1 && komorka.startsWith('http')) {
        zawartosc = "<a href=\"" + komorka + "\" target=\"_blank\" style=\"color: " + kolorNaglowka + "; font-weight: bold;\">Otwórz link</a>";
      }
      html += "<td style=\"border: 1px solid #bdc3c7; padding: 8px;\">" + zawartosc + "</td>";
    });
    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}