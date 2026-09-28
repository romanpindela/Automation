/**
 * Główna funkcja uruchamiająca proces przygotowania i wysyłki raportu.
 * Wersja: lokalne nadchodzące + trwające + rozszerzone dane wydarzeń
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
        tresciStron[url] = czystyTekst.length > 5000 ? czystyTekst.substring(0, 5000) : czystyTekst;
      } else {
        tresciStron[url] = "";
      }
    });
  } catch (e) {
    Logger.log("Błąd pobierania: " + e.message);
  }

  let wynikiLokalePrzyszle = [];
  let wynikiLokaleTrwajace = [];
  let wynikiGlobalnePrzeszle = [];
  let wynikiGlobalnePrzyszle = [];

  SOURCES_LOKALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynikiPrzyszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przyszle", filtrProfilu);
      if (wynikiPrzyszle) {
        let przefiltrowane = wynikiPrzyszle
          .map(normalizujWynikLokalny)
          .filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiLokalePrzyszle = wynikiLokalePrzyszle.concat(przefiltrowane);
      }

      let wynikiTrwajace = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_trwajace", filtrProfilu);
      if (wynikiTrwajace) {
        let przefiltrowaneTrwajace = wynikiTrwajace
          .map(normalizujWynikLokalny)
          .filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiLokaleTrwajace = wynikiLokaleTrwajace.concat(przefiltrowaneTrwajace);
      }
    }
  });

  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynikiPrzeszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (wynikiPrzeszle) {
        let przefiltrowanePrzeszle = wynikiPrzeszle
          .map(normalizujWynikGlobalny)
          .filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiGlobalnePrzeszle = wynikiGlobalnePrzeszle.concat(przefiltrowanePrzeszle);
      }

      let wynikiPrzyszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (wynikiPrzyszle) {
        let przefiltrowanePrzyszle = wynikiPrzyszle
          .map(normalizujWynikGlobalny)
          .filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE"));
        wynikiGlobalnePrzyszle = wynikiGlobalnePrzyszle.concat(przefiltrowanePrzyszle);
      }
    }
  });

  let wynikiLokaleWszystkie = [...wynikiLokalePrzyszle, ...wynikiLokaleTrwajace];

  sortujIGrupujWyniki(wynikiLokaleWszystkie, 0, 1);
  sortujIGrupujWyniki(wynikiGlobalnePrzeszle, 1, 0);
  sortujIGrupujWyniki(wynikiGlobalnePrzyszle, 1, 0);

  let naglowki1 = [
    "Obszar / Lokalizacja",
    "Data / Dzień",
    "Godzina",
    "Tytuł / Temat",
    "Streszczenie merytoryczne",
    "Dla kogo (wiek)",
    "Warunki wstępu",
    "Źródło / Link"
  ];

  let naglowki2 = [
    "Data wydarzenia",
    "Godzina",
    "Obszar / Zasięg",
    "Kategoria",
    "Tytuł / Temat",
    "Streszczenie merytoryczne",
    "Dla kogo (wiek)",
    "Warunki wstępu",
    "Źródło / Link"
  ];

  zapiszDoArkusza(ss, "1. Lokalne - Przyszłe i Trwające", wynikiLokaleWszystkie, naglowki1);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", wynikiGlobalnePrzeszle, naglowki2);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", wynikiGlobalnePrzyszle, naglowki2);

  wyslijRaportEmail(wynikiLokaleWszystkie, wynikiGlobalnePrzeszle, wynikiGlobalnePrzyszle, naglowki1, naglowki2, dzisiajStr);
}

function normalizujWynikLokalny(row) {
  if (!Array.isArray(row) || row.length === 0) return null;

  let wynik = row.map(item => String(item || "").trim());
  while (wynik.length < 8) wynik.push("");

  if (wynik.length > 8) {
    // do not exceed expected length, collapse link/source if there are extra fields
    let sourceLink = sformatujZrodloILink(wynik[7], wynik[8]);
    wynik = wynik.slice(0, 7).concat([sourceLink]);
  }

  // Ensure the last field always includes the source and link if available.
  if (wynik.length === 8 && wynik[7] && !wynik[7].includes("http")) {
    let sourceText = wynik[7];
    let urlText = "";
    if (row.length > 8 && /^https?:\/\//i.test(String(row[8] || ""))) {
      urlText = row[8];
    }
    wynik[7] = sformatujZrodloILink(sourceText, urlText);
  }

  if (wynik.length === 7) {
    wynik.push("");
  }

  // Data i godzina dla lokalnych: jeśli brak, ustaw "Trwa / data niepewna"
  if (!wynik[1]) wynik[1] = "Trwa / data niepewna";
  if (!wynik[2]) wynik[2] = "—";
  if (!wynik[5]) wynik[5] = "Wszyscy";
  if (!wynik[6]) wynik[6] = "Brak informacji";

  return wynik;
}

function normalizujWynikGlobalny(row) {
  if (!Array.isArray(row) || row.length === 0) return null;

  let wynik = row.map(item => String(item || "").trim());
  while (wynik.length < 9) wynik.push("");

  if (wynik.length > 9) {
    let sourceLink = sformatujZrodloILink(wynik[8], wynik[9]);
    wynik = wynik.slice(0, 8).concat([sourceLink]);
  }

  if (wynik.length === 9) {
    wynik.push("");
  }

  if (!wynik[1]) wynik[1] = "—";
  if (!wynik[6]) wynik[6] = "Wszyscy";
  if (!wynik[7]) wynik[7] = "Brak informacji";

  return wynik;
}

function sformatujZrodloILink(zrodlo, link) {
  let z = String(zrodlo || "").trim();
  let l = String(link || "").trim();
  if (!z && !l) return "";
  if (z && l) return z + " — " + l;
  return z || l;
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
  let instrukcjaRozszerzona = "";

  if (typRaportu === "lokalne_przyszle") {
    instrukcjaCzasowa =
      "BEZWZGLĘDNY WYMÓG CZASOWY:\n" +
      "- Wybierz WYŁĄCZNIE nadchodzące wydarzenia w najbliższych 7 dniach.\n" +
      "- Ignoruj wydarzenia przeszłe i stałe zajęcia dla dorosłych bez konkretnej daty.\n" +
      "- Jeżeli wydarzenie trwa już teraz, ale ma zapowiedziany termin w najbliższych dniach, traktuj je jako 'przyszłe' tylko wtedy, gdy jest to wyraźnie zapowiedziane na ten okres.";

    strukturaKolumn = "\"Obszar / Lokalizacja\", \"Data / Dzień\", \"Godzina\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Dla kogo (wiek)\", \"Warunki wstępu\", \"Źródło / Link\"";

    instrukcjaRozszerzona = "INSTRUKCJA POLI DODATKOWYCH:\n" +
      "1. Godzina: jeśli jest konkretna, wpisz ją; jeśli tylko przedział, wpisz np. 14:00-18:00; jeśli brak, wpisz '—'.\n" +
      "2. Dla kogo (wiek): np. 'Dzieci 4-7 lat', 'Całe rodziny', 'Dzieci 5-12 lat', 'Wszyscy', 'Dorośli'.\n" +
      "3. Warunki wstępu: wpisz 'Wstęp wolny', 'Wstęp płatny: 20 zł', 'Wymagana rejestracja', 'Publiczne', lub 'Brak informacji'.\n" +
      "4. Źródło / Link: zwróć dokładnie jedną komórkę w formacie 'Nazwa źródła — https://adres.pl'.";

  } else if (typRaportu === "lokalne_trwajace") {
    instrukcjaCzasowa =
      "BEZWZGLĘDNY WYMÓG CZASOWY:\n" +
      "- Wybierz WYŁĄCZNIE wydarzenia, które trwają teraz, mają charakter ciągły, lub mają aktywny okres obejmujący dzisiaj i najbliższe dni.\n" +
      "- Nie wybieraj wydarzeń wyłącznie historycznych ani stałych kursów dla dorosłych.\n" +
      "- Jeśli nie ma konkretnej daty, wpisz 'Trwa / data niepewna' w polu Data / Dzień.";

    strukturaKolumn = "\"Obszar / Lokalizacja\", \"Data / Dzień\", \"Godzina\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Dla kogo (wiek)\", \"Warunki wstępu\", \"Źródło / Link\"";

    instrukcjaRozszerzona = "INSTRUKCJA POLI DODATKOWYCH:\n" +
      "1. Godzina: jeśli pojawia się w opisie ciągłego wydarzenia, wpisz ją. Jeśli nie ma konkretu, wpisz '—'.\n" +
      "2. Dla kogo (wiek): dla wydarzeń rodzinnych użyj 'Dzieci 4-7 lat', 'Całe rodziny', 'Wszyscy'; dla wydarzeń ogólnych 'Wszyscy'.\n" +
      "3. Warunki wstępu: wpisz 'Wstęp wolny', 'Wstęp płatny', 'Wymagana rejestracja', 'Publiczne', lub 'Brak informacji'.\n" +
      "4. Źródło / Link: zwróć dokładnie jedną komórkę w formacie 'Nazwa źródła — https://adres.pl'.";

  } else {
    let typOpis = (typRaportu === "globalne_przeszle") ? "co się wydarzyło w minionych 7 dniach" : "co się wydarzy w najbliższych 7 dniach";
    instrukcjaCzasowa = "Analizuj pod kątem kategorii: " + typOpis + ".";
    strukturaKolumn = "\"Data wydarzenia\", \"Godzina\", \"Obszar / Zasięg\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Dla kogo (wiek)\", \"Warunki wstępu\", \"Źródło / Link\"";
    instrukcjaRozszerzona = "INSTRUKCJA POLI DODATKOWYCH:\n" +
      "1. Godzina: jeśli jest znana, wpisz ją; jeśli nie, wpisz '—'.\n" +
      "2. Dla kogo (wiek): 'Profesionałowie', 'Inwestorzy', 'Ogół społeczeństwa', 'Wszyscy', lub '—'.\n" +
      "3. Warunki wstępu: 'Publiczne', 'Transmisja online', 'Artykuł / Wiadomość', lub 'Brak informacji'.\n" +
      "4. Źródło / Link: zwróć dokładnie jedną komórkę w formacie 'Nazwa źródła — https://adres.pl'.";
  }

  let systemPrompt = "Jesteś zaawansowanym filtrem analitycznym.\n\n" + kontekstCzasowy + "\n\n" + filtrProfilu + "\n\n" + instrukcjaCzasowa + "\n\n" + instrukcjaRozszerzona + "\n\nAnalizuj tekst ze źródła " + source.url + ":\n\"\"\"" + trescZrodla + "\"\"\"\nZwróć JSON:\n{\"dane\": [[" + strukturaKolumn + "]]}";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij wyłącznie trafione pozycje w formacie JSON. Pamiętaj, aby uzupełnić wszystkie pola: Data / Dzień, Godzina, Dla kogo (wiek), Warunki wstępu oraz Źródło / Link w formacie 'Nazwa — URL'." }
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

    let text = response.getContentText();
    if (!text) return [];

    let json = JSON.parse(text);
    if (json.error) {
      Logger.log("DeepSeek API error: " + JSON.stringify(json.error));
      return [];
    }

    let content = json.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(content).dane || [];
  } catch (e) {
    Logger.log("Błąd przetwarzania DeepSeek: " + e.message);
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
    for (let i = startRow; i < dane.length; i++) {
      sheet.appendRow(dane[i]);
    }
  }

  sheet.autoResizeColumns(1, nagłówki.length);
}

/**
 * Wysyła raport e-mail oraz załącza PDF z poprawionym nagłówkiem i tabelą źródeł na końcu.
 */
function wyslijRaportEmail(lokalnePrzyszle, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr) {
  let emailAdres = Session.getActiveUser().getEmail();
  let temat = "📰 Migawka Wydarzeń (" + dzisiajStr + ")";

  function generujTabeluZrodelHtml(isPdf = false) {
    let tdStyle = isPdf ? "padding: 3px 6px; font-size: 9px; color: #64748b; border-bottom: 1px solid #f1f5f9;" : "padding: 4px 8px; font-size: 10px; color: #64748b; border-bottom: 1px solid #f1f5f9;";
    let thStyle = isPdf ? "padding: 4px 6px; font-size: 9px; color: #475569; background-color: #f8fafc; text-align: left; border-bottom: 1px solid #e2e8f0;" : "padding: 5px 8px; font-size: 10px; color: #475569; background-color: #f8fafc; text-align: left; border-bottom: 1px solid #e2e8f0;";

    return `
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        <h4 style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Monitorowane źródła informacji</h4>
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
          <thead>
            <tr>
              <th style="${thStyle}">Kategoria / Region</th>
              <th style="${thStyle}">Adres URL źródła</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="${tdStyle}"><b>Kraków i okolice (Przedszkola / Szkoły)</b></td><td style="${tdStyle}">przedszkole140.blizej.info</td></tr>
            <tr><td style="${tdStyle}"><b>Kraków (CK Podgórza / Sokolska / Borek / Iskierka)</b></td><td style="${tdStyle}">sokolska.ckpodgorza.pl, borek.ckpodgorza.pl, iskierka.ckpodgorza.pl</td></tr>
            <tr><td style="${tdStyle}"><b>Kraków (Łagiewniki / Cegielniana / Dzielnica IX)</b></td><td style="${tdStyle}">smcegielniana.pl, dzielnica9.krakow.pl</td></tr>
            <tr><td style="${tdStyle}"><b>Myślenice & Tarnów</b></td><td style="${tdStyle}">wydarzenia.miasto-info.pl, csm.tarnow.pl, kultura.tarnow.pl</td></tr>
            <tr><td style="${tdStyle}"><b>Małopolska (Regionalne)</b></td><td style="${tdStyle}">malopolska.pl</td></tr>
            <tr><td style="${tdStyle}"><b>Informacje ogólnopolskie (Polska)</b></td><td style="${tdStyle}">zero.pl, forsal.pl, biznes.pap.pl</td></tr>
            <tr><td style="${tdStyle}"><b>Globalne / Świat / Europa</b></td><td style="${tdStyle}">politico.eu, rp.pl/wydarzenia/swiat</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  let htmlBody = "<h2 style=\"color: #1e293b; font-family: Arial, sans-serif;\">🎯 Migawka Wydarzeń (" + dzisiajStr + ")</h2>" +
      "<p style=\"font-family: Arial, sans-serif; color: #475569; font-size: 13px;\">Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>";

  htmlBody += "<h3 style=\"color: #047857; border-bottom: 2px solid #047857; padding-bottom: 5px; margin-top: 25px; font-family: Arial, sans-serif;\">🎡 1. Lokalne, Społeczne, Dzieci i Kultura (Nadchodzące i trwające)</h3>";
  if (!lokalnePrzyszle || lokalnePrzyszle.length === 0) {
    htmlBody += "<p style=\"font-family: Arial, sans-serif; font-size: 12px; color: #64748b;\"><em>Brak nadchodzących i trwających wydarzeń spełniających kryteria w najbliższych dniach.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(lokalnePrzyszle, naglowki1, "#047857", "#ecfdf5", 0);
  }

  htmlBody += "<h3 style=\"color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 5px; margin-top: 30px; font-family: Arial, sans-serif;\">📊 2. Świat, Polityka, Gospodarka – Co się wydarzyło (Minione 7 dni)</h3>";
  if (!globalnePrzeszle || globalnePrzeszle.length === 0) {
    htmlBody += "<p style=\"font-family: Arial, sans-serif; font-size: 12px; color: #64748b;\"><em>Brak istotnych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzeszle, naglowki2, "#4338ca", "#e0e7ff", 2);
  }

  htmlBody += "<h3 style=\"color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 5px; margin-top: 30px; font-family: Arial, sans-serif;\">🔮 3. Świat, Polityka, Gospodarka – Co się wydarzy (Zapowiedzi na 7 dni)</h3>";
  if (!globalnePrzyszle || globalnePrzyszle.length === 0) {
    htmlBody += "<p style=\"font-family: Arial, sans-serif; font-size: 12px; color: #64748b;\"><em>Brak zapowiadanych wydarzeń w tym okresie.</em></p>";
  } else {
    htmlBody += generujTabeleHtml(globalnePrzyszle, naglowki2, "#b45309", "#fef3c7", 2);
  }

  htmlBody += generujTabeluZrodelHtml(false);
  htmlBody += "<br><hr style=\"border: none; border-top: 1px solid #e2e8f0; margin-top: 20px;\"><p style=\"font-size: 11px; color: #94a3b8; font-family: Arial, sans-serif;\">Automatyczny agregator treści AI (RSS/Web + DeepSeek LLM).</p>";

  let pdfBlob = null;
  try {
    let pdfZawartosc = `
      <h2 style="color: #1e293b; font-family: Arial, sans-serif; font-size: 18px;">🎯 Migawka Wydarzeń (${dzisiajStr})</h2>
      <p style="font-family: Arial, sans-serif; color: #475569; font-size: 12px;">Raport wyselekcjonowany pod kątem rodzinnych wydarzeń w Krakowie, inwestycji oraz kluczowej gospodarki i polityki.</p>

      <h3 style="color: #047857; border-bottom: 2px solid #047857; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">🎡 1. Lokalne, Społeczne, Dzieci i Kultura (Nadchodzące i trwające)</h3>
      ${generujTabeleDoPdf(lokalnePrzyszle, naglowki1, "#047857", "#ecfdf5", 0)}

      <div style="page-break-before: always; break-before: page; padding-top: 10px;"></div>
      <h3 style="color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">📊 2. Świat, Polityka, Gospodarka – Co się wydarzyło (Minione 7 dni)</h3>
      ${generujTabeleDoPdf(globalnePrzeszle, naglowki2, "#4338ca", "#e0e7ff", 2)}

      <div style="page-break-before: always; break-before: page; padding-top: 10px;"></div>
      <h3 style="color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-top: 20px; font-family: Arial, sans-serif; font-size: 14px;">🔮 3. Świat, Polityka, Gospodarka – Co się wydarzy (Zapowiedzi na 7 dni)</h3>
      ${generujTabeleDoPdf(globalnePrzyszle, naglowki2, "#b45309", "#fef3c7", 2)}

      <div style="page-break-before: always; break-before: page; padding-top: 10px;"></div>
      ${generujTabeluZrodelHtml(true)}
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

function generujTabeleHtml(dane, nagłówki, kolorNaglowka, kolorTla, indeksGrupy) {
  let html = "<table style=\"border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; margin-top: 10px;\">";
  html += "<tr style=\"background-color: " + kolorNaglowka + "; color: white;\">";
  nagłówki.forEach(naglowek => {
    html += "<th style=\"border: 1px solid #cbd5e1; padding: 7px; text-align: left; font-size: 10px;\">" + naglowek + "</th>";
  });
  html += "</tr>";

  let ostatniaGrupa = "";
  let i = 0;

  dane.forEach(wiersz => {
    let aktualnaGrupa = String(wiersz[indeksGrupy] || "Inne");
    if (aktualnaGrupa !== ostatniaGrupa) {
      html += "<tr style=\"background-color: #f1f5f9;\">";
      html += "<td colspan=\"" + nagłówki.length + "\" style=\"border: 1px solid #cbd5e1; padding: 6px 8px; font-weight: bold; color: #334155; font-size: 10px;\">📌 " + aktualnaGrupa + "</td>";
      html += "</tr>";
      ostatniaGrupa = aktualnaGrupa;
      i = 0;
    }

    let stylTla = (i % 2 === 0) ? "background-color: #ffffff;" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + "\">";

    wiersz.forEach((komorka, index) => {
      let zawartosc = String(komorka || "");
      zawartosc = zawartosc.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

      if (index === wiersz.length - 1 && /^https?:\/\//i.test(zawartosc)) {
        zawartosc = "<a href=\"" + zawartosc + "\" target=\"_blank\" style=\"color: " + kolorNaglowka + "; font-weight: bold; text-decoration: none;\">Otwórz link</a>";
      }

      html += "<td style=\"border: 1px solid #cbd5e1; padding: 7px; color: #1e293b; vertical-align: top; font-size: 10px;\">" + zawartosc + "</td>";
    });

    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}

function generujTabeleDoPdf(dane, nagłówki, kolorNaglowka, kolorTla, indeksGrupy) {
  if (!dane || dane.length === 0) return "<p style=\"font-family: Arial, sans-serif; font-size: 11px; color: #64748b;\"><em>Brak wpisów w tej sekcji.</em></p>";

  let html = "<table style=\"border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 9px; margin-top: 10px;\">";
  html += "<tr style=\"background-color: " + kolorNaglowka + "; color: white;\">";
  nagłówki.forEach(naglowek => {
    html += "<th style=\"border: 1px solid #cbd5e1; padding: 4px; text-align: left; font-size: 8px;\">" + naglowek + "</th>";
  });
  html += "</tr>";

  let ostatniaGrupa = "";
  let i = 0;

  dane.forEach(wiersz => {
    let aktualnaGrupa = String(wiersz[indeksGrupy] || "Inne");
    if (aktualnaGrupa !== ostatniaGrupa) {
      html += "<tr style=\"background-color: #f1f5f9;\">";
      html += "<td colspan=\"" + nagłówki.length + "\" style=\"border: 1px solid #cbd5e1; padding: 4px; font-weight: bold; color: #334155; font-size: 8px;\">📌 " + aktualnaGrupa + "</td>";
      html += "</tr>";
      ostatniaGrupa = aktualnaGrupa;
      i = 0;
    }

    let stylTla = (i % 2 === 0) ? "background-color: #ffffff;" : "background-color: " + kolorTla + ";";
    html += "<tr style=\"" + stylTla + "\">";

    wiersz.forEach((komorka, index) => {
      let zawartosc = String(komorka || "");
      zawartosc = zawartosc.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

      if (index === wiersz.length - 1 && /^https?:\/\//i.test(zawartosc)) {
        zawartosc = "<a href=\"" + zawartosc + "\" style=\"color: " + kolorNaglowka + "; text-decoration: underline;\">Link</a>";
      }

      html += "<td style=\"border: 1px solid #cbd5e1; padding: 4px; color: #1e293b; vertical-align: top; font-size: 8px;\">" + zawartosc + "</td>";
    });

    html += "</tr>";
    i++;
  });

  html += "</table>";
  return html;
}
