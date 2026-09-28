/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
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

  let wynikiLokalePrzyszle = [];
  let wynikiGlobalnePrzeszle = [];
  let wynikiGlobalnePrzyszle = [];

  // KROK 1 & 2: Zapytanie do AI dla każdego źródła z uwzględnieniem rygorystycznego profilu użytkownika
  SOURCES_LOKALNE.forEach(source => {
    let wynikiZrodla = zapytajDeepSeekDlaZrodla(source, kontekstCzasowy, "lokalne_przyszle");
    if (wynikiZrodla && wynikiZrodla.length > 0) {
      wynikiLokalePrzyszle = wynikiLokalePrzyszle.concat(wynikiZrodla);
    }
    Utilities.sleep(500);
  });

  SOURCES_GLOBALNE.forEach(source => {
    let wynikiPrzeszle = zapytajDeepSeekDlaZrodla(source, kontekstCzasowy, "globalne_przeszle");
    if (wynikiPrzeszle && wynikiPrzeszle.length > 0) {
      wynikiGlobalnePrzeszle = wynikiGlobalnePrzeszle.concat(wynikiPrzeszle);
    }
    Utilities.sleep(500);

    let wynikiPrzyszle = zapytajDeepSeekDlaZrodla(source, kontekstCzasowy, "globalne_przyszle");
    if (wynikiPrzyszle && wynikiPrzyszle.length > 0) {
      wynikiGlobalnePrzyszle = wynikiGlobalnePrzyszle.concat(wynikiPrzyszle);
    }
    Utilities.sleep(500);
  });

  // Grupuj i sortuj wyniki wg obszaru (indeks 0 lub 1), a następnie po dacie
  sortujIGrupujWyniki(wynikiLokalePrzyszle, 0, 1);
  sortujIGrupujWyniki(wynikiGlobalnePrzeszle, 1, 0);
  sortujIGrupujWyniki(wynikiGlobalnePrzyszle, 1, 0);

  // Nowe nagłówki uwzględniające kolumnę Źródło
  let naglowki1 = ["Obszar / Lokalizacja", "Data / Dzień", "Tytuł / Temat", "Streszczenie merytoryczne", "Źródło", "Link"];
  let naglowki2 = ["Data wydarzenia", "Obszar / Zasięg", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Źródło", "Link"];

  // KROK 3: Stworzenie raportu i zapis w arkuszach
  zapiszDoArkusza(ss, "1. Lokalne - Przyszłe", wynikiLokalePrzyszle, naglowki1);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", wynikiGlobalnePrzeszle, naglowki2);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", wynikiGlobalnePrzyszle, naglowki2);

  // KROK 3: Wysyłka sformatowanego maila z ikonami i dopasowaną kolorystyką
  wyslijRaportEmail(wynikiLokalePrzyszle, wynikiGlobalnePrzeszle, wynikiGlobalnePrzyszle, naglowki1, naglowki2, dzisiajStr);
}

/**
 * Wysyła pojedynczy adres URL do DeepSeek AI z dwustopniowym filtrem (profil użytkownika + ramy czasowe).
 */
function zapytajDeepSeekDlaZrodla(source, kontekstCzasowy, typRaportu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) {
    throw new Error("Brak skonfigurowanego klucza DEEPSEEK_API_KEY w Właściwościach skryptu.");
  }
  
  const url = "https://api.deepseek.com/chat/completions";

  let instrukcjaSpecyficzna = "";
  let strukturaKolumn = "";

  // Wyciągnięcie domeny do czytelnego oznaczenia źródła
  let domenaZrodla = source.url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");

  let filtrProfilu = 
    "PROFIL UŻYTKOWNIKA (BEZWZGLĘDNY FILTR ODSEJNIKOWY):\n" +
    "- Jesteś filtrem dla mężczyzny, ojca dwóch dziewczynek mieszkającego w Krakowie, interesującego się inwestycjami, gospodarką oraz polityką mającą realny wpływ na rynki i biznes, a także wartościową kulturą i wydarzeniami dla rodzin.\n" +
    "- KATEGORYCZNIE ODRZUĆ: informacje o seniorach, stowarzyszeniach emerytów, kołach gospodyń, osoby niepełnosprawne, dramy, celebrytów, plotki, wypadki drogowe, incydenty policyjne, kryminalne, patologie, szpitale/sluzbę zdrowia (chyba że przełom makroekonomiczny), wieczory poetyckie dla dorosłych, spotkania lokalnych rad osiedli bez znaczenia.\n" +
    "- ZOSTAW TYLKO: ciekawe wydarzenia kulturalne/sportowe/edukacyjne dla dzieci i rodzin w Krakowie i okolicy, inwestycje miejskie, kluczowe decyzje polityczno-gospodarcze, wskaźniki makroekonomiczne i biznes.";

  if (typRaportu === "lokalne_przyszle") {
    instrukcjaSpecyficzna = 
      filtrProfilu + "\n\n" +
      "Analizujesz adres URL źródła: " + source.url + " (Grupa: " + source.group + ").\n" +
      "SEKCJA 1 (Lokalne, Społeczne, Dzieci, Kultura - WYŁĄCZNIE PRZYSZŁE):\n" +
      "- Wybierz TYLKO wydarzenia w PRZYSZŁOŚCI w ciągu najbliższych 7 dni.\n" +
      "- POGRUBIENIA: Używaj pogrubienia (**tekst**) dla kluczowych nazw, dat, miejsc.\n" +
      "- UKŁAD KOLUMN (zwróć w tablicy tablic):\n" +
      "  1. Obszar / Lokalizacja (np. Kraków, Myślenice, Tarnów, Łagiewniki itp.)\n" +
      "  2. Data / Dzień\n" +
      "  3. Tytuł / Temat (z **pogrubieniami**)\n" +
      "  4. Streszczenie merytoryczne (z **pogrubieniami**)\n" +
      "  5. Źródło (wpisz dokładnie: " + domenaZrodla + ")\n" +
      "  6. Link (pełny URL)";
    strukturaKolumn = "\"Obszar / Lokalizacja\", \"Data / Dzień\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Źródło\", \"Link\"";
  } else if (typRaportu === "globalne_przeszle") {
    instrukcjaSpecyficzna = 
      filtrProfilu + "\n\n" +
      "Analizujesz adres URL źródła: " + source.url + " (Grupa: " + source.group + ").\n" +
      "SEKCJA 2 (Świat, Polityka, Gospodarka - CO SIĘ WYDARZYŁO w minionych 7 dniach):\n" +
      "- Wybierz TYLKO twarde fakty gospodarcze, biznesowe i istotną politykę z ostatnich 7 dni.\n" +
      "- POGRUBIENIA: Używaj pogrubienia (**tekst**) dla kluczowych danych, kwot, nazwisk, pojęć.\n" +
      "- UKŁAD KOLUMN (zwróć w tablicy tablic):\n" +
      "  1. Data wydarzenia (RRRR-MM-DD)\n" +
      "  2. Obszar / Zasięg (np. Polska, Europa, Świat)\n" +
      "  3. Kategoria\n" +
      "  4. Tytuł / Temat (z **pogrubieniami**)\n" +
      "  5. Streszczenie merytoryczne (z **pogrubieniami**)\n" +
      "  6. Źródło (wpisz dokładnie: " + domenaZrodla + ")\n" +
      "  7. Link (pełny URL)";
    strukturaKolumn = "\"Data wydarzenia\", \"Obszar / Zasięg\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Źródło\", \"Link\"";
  } else if (typRaportu === "globalne_przyszle") {
    instrukcjaSpecyficzna = 
      filtrProfilu + "\n\n" +
      "Analizujesz adres URL źródła: " + source.url + " (Grupa: " + source.group + ").\n" +
      "SEKCJA 3 (Świat, Polityka, Gospodarka - CO SIĘ WYDARZY w najbliższych 7 dniach):\n" +
      "- Wybierz zapowiedzi, kalendarz makroekonomiczny, szczyty i decyzje na najbliższe 7 dni.\n" +
      "- POGRUBIENIA: Używaj pogrubienia (**tekst**) dla kluczowych terminów i wydarzeń.\n" +
      "- UKŁAD KOLUMN (zwróć w tablicy tablic):\n" +
      "  1. Data wydarzenia (RRRR-MM-DD)\n" +
      "  2. Obszar / Zasięg (np. Polska, Europa, Świat)\n" +
      "  3. Kategoria\n" +
      "  4. Tytuł / Temat (z **pogrubieniami**)\n" +
      "  5. Streszczenie merytoryczne (z **pogrubieniami**)\n" +
      "  6. Źródło (wpisz dokładnie: " + domenaZrodla + ")\n" +
      "  7. Link (pełny URL)";
    strukturaKolumn = "\"Data wydarzenia\", \"Obszar / Zasięg\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Źródło\", \"Link\"";
  }

  let systemPrompt = "Jesteś bezwzględnym analitykiem mediów. Przeprowadzasz selekcję dwuetapową (filtr odrzucający szum + analiza czasowa).\n\n" +
                     kontekstCzasowy + "\n\n" +
                     instrukcjaSpecyficzna + "\n\n" +
                     "Zwróć wynik ŚCISLE w formacie JSON (sam czysty tekst, bez markdown):\n" +
                     "{\n  \"dane\": [\n    [" + strukturaKolumn + "]\n  ]\n}";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Przeanalizuj źródło: " + source.url + " i zwróć przefiltrowany JSON zgodnie z wytycznymi." }
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
      Logger.log("Błąd API DeepSeek dla " + source.url + ": " + JSON.stringify(json.error));
      return [];
    }
    
    let content = json.choices[0].message.content;
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsed = JSON.parse(content);
    return parsed.dane || [];
  } catch (e) {
    Logger.log("Błąd krytyczny DeepSeek dla " + source.url + ": " + e.message);
    return [];
  }
}

/**
 * Pomocnicza funkcja grupująca wg obszaru i sortująca po dacie.
 */
function sortujIGrupujWyniki(dane, indeksObszaru, indeksDaty) {
  if (!dane || dane.length === 0) return;
  dane.sort((a, b) => {
    let obszarA = String(a[indeksObszaru] || "");
    let obszarB = String(b[indeksObszaru] || "");
    if (obszarA !== obszarB) {
      return obszarA.localeCompare(obszarB);
    }
    let dataA = String(a[indeksDaty] || "");
    let dataB = String(b[indeksDaty] || "");
    return dataA.localeCompare(dataB);
  });
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
 * Funkcja formatująca i wysyłająca 3-częściowy raport na e-mail z ikonami i wyrazistą czytelnością.
 */
function wyslijRaportEmail(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "📰 Migawka wydarzeń (" + dzisiajStr + ")";

  let htmlBody = "<h2 style=\"color: #2c3e50;\">🎯 Osobisty Przegląd Wiadomości i Wydarzeń (" + dzisiajStr + ")</h2>" +
                 "<p>Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>" +
                 "<h3 style=\"color: #16a085; border-bottom: 2px solid #16a085; padding-bottom: 5px;\">🎡 1. Lokalne, Społeczne, Dzieci i Kultura (Nadchodzące wydarzenia)</h3>";

  if (!lokalnePrzyszle || lokalnePrzyszle.length === 0) {
    htmlBody += "<p><em>Brak nadchodzących wydarzeń spełniających kryteria w najbliższych dniach.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(lokalnePrzyszle, naglowki1, "#16a085", "#e8f8f5", 0);
  }

  htmlBody += "<h3 style=\"color: #2980b9; border-bottom: 2px solid #2980b9; padding-bottom: 5px; margin-top: 30px;\">📊 2. Świat, Polityka, Gospodarka – Co się wydarzyło (Minione 7 dni)</h3>";

  if (!globalnePrzeszle || globalnePrzeszle.length === 0) {
    htmlBody += "<p><em>Brak istotnych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzeszle, naglowki2, "#2980b9", "#ebf5fb", 1);
  }

  htmlBody += "<h3 style=\"color: #d35400; border-bottom: 2px solid #d35400; padding-bottom: 5px; margin-top: 30px;\">🔮 3. Świat, Polityka, Gospodarka – Co się wydarzy (Zapowiedzi na 7 dni)</h3>";

  if (!globalnePrzyszle || globalnePrzyszle.length === 0) {
    htmlBody += "<p><em>Brak zapowiadanych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzyszle, naglowki2, "#d35400", "#fef5e7", 1);
  }

  htmlBody += "<br><hr><p style=\"font-size: 11px; color: #7f8c8d;\">Automatyczny agregator treści AI (RSS/Web + DeepSeek LLM).</p>";

  MailApp.sendEmail({
    to: emailAdres,
    subject: temat,
    htmlBody: htmlBody
  });
}

/**
 * Pomocnicza funkcja zamieniająca tablicę danych na kolorową, przejrzystą tabelę HTML z grupowaniem po obszarze.
 */
function generujTabeleHtml(dane, nagłówki, kolorNaglowka, kolorTla, indeksGrupy) {
  let html = "<table style=\"border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; margin-top: 10px;\">";
  
  html += "<tr style=\"background-color: " + kolorNaglowka + "; color: white;\">";
  nagłówki.forEach(naglowek => {
    html += "<th style=\"border: 1px solid #bdc3c7; padding: 8px; text-align: left;\">" + naglowek + "</th>";
  });
  html += "</tr>";

  let ostatniaGrupa = "";
  let i = 0;
  
  dane.forEach(wiersz => {
    let aktualnaGrupa = String(wiersz[indeksGrupy] || "Inne");
    
    // Wiersz wyróżniający dla nowego obszaru (grupowanie)
    if (aktualnaGrupa !== ostatniaGrupa) {
      html += "<tr style=\"background-color: #d6dbdf;\">";
      html += "<td colspan=\"" + nagłówki.length + "\" style=\"border: 1px solid #bdc3c7; padding: 6px 8px; font-weight: bold; color: #2c3e50;\">📌 Obszar / Region: " + aktualnaGrupa + "</td>";
      html += "</tr>";
      ostatniaGrupa = aktualnaGrupa;
      i = 0; // reset paska zebry dla nowej grupy
    }

    let stylTla = (i % 2 === 0) ? "background-color: #ffffff;" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + "\">";
    
    wiersz.forEach((komorka, index) => {
      let zawartosc = String(komorka || "");
      
      // Konwersja pogrubień markdown na tagi HTML
      zawartosc = zawartosc.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

      // Obsługa kolumny linku (ostatnia kolumna)
      if (index === wiersz.length - 1 && zawartosc.startsWith('http')) {
        zawartosc = "<a href=\"" + zawartosc + "\" target=\"_blank\" style=\"color: " + kolorNaglowka + "; font-weight: bold;\">Otwórz link</a>";
      }
      
      html += "<td style=\"border: 1px solid #bdc3c7; padding: 8px;\">" + zawartosc + "</td>";
    });
    
    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}