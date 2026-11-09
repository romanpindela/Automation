/**
 * ============================================================================
 * MIGAWKA WYDARZEŃ - KOMPLETNY KOD PRODUKCYJNY
 * Ścieżka bazowa: GitHub/Automation/Google Apps Script/Migawka Wydarzeń
 * ============================================================================
 */

// Globalna konfiguracja ścieżki i strażnika czasu
const SCIEZKA_BAZOWA = "GitHub/Automation/Google Apps Script/Migawka Wydarzeń";
const MOJ_EMAIL_TESTOWY = "roman.pindela@gmail.com";
let START_TIME = 0;
const MAX_EXECUTION_TIME_MS = 270 * 1000; // 4.5 minuty (limit GAS to 6 min)

function czyCzasSieKonczy() {
  return (new Date().getTime() - START_TIME) > MAX_EXECUTION_TIME_MS;
}

// ============================================================================
// GŁÓWNE FUNKCJE RAPORTUJĄCE (URUCHOMIENIE AUTOMATYCZNE I RĘCZNE)
// ============================================================================

/**
 * Główna funkcja raportująca podpięta pod automatyczny trigger czasowy (Time-driven trigger).
 * - Jeśli uruchomiona przez trigger czasowy (e.triggerUid / e.authMode) -> wysyła do wszystkich subskrybentów.
 * - Jeśli uruchomiona ręcznie z edytora bez parametrów -> domyślnie wykonuje bezpieczny test do siebie.
 * - Może też przyjąć parametr wymuszenia: generujRaportWiadomosci(true) lub generujRaportWiadomosci("wszyscy").
 */
function generujRaportWiadomosci(e, trybWymuszony) {
  const jestTriggerCzasowy = Boolean(e && (e.triggerUid || e.authMode));
  const wymusWszystkich = (e === true || e === "wszyscy" || trybWymuszony === true || trybWymuszony === "wszyscy" || (typeof e === "object" && e && e.wyslijDoWszystkich === true));
  const wyslijDoWszystkich = jestTriggerCzasowy || wymusWszystkich;
  const isTest = !wyslijDoWszystkich;

  return uruchomGenerowanieRaportu({
    wyslijDoWszystkich: wyslijDoWszystkich,
    isTest: isTest
  });
}

/**
 * RĘCZNY TEST: Generuje raport i wysyła go WYŁĄCZNIE do Ciebie (MOJ_EMAIL_TESTOWY).
 * Temat wiadomości posiada prefiks [TEST].
 * Wybierz tę funkcję z listy w edytorze GAS, aby szybko przetestować raport.
 */
function generujRaportWiadomosciTest() {
  return uruchomGenerowanieRaportu({
    wyslijDoWszystkich: false,
    isTest: true
  });
}
function wyslijRaportTestowy() { return generujRaportWiadomosciTest(); }

/**
 * RĘCZNA PRODUKCJA: Generuje raport i wysyła go do WSZYSTKICH subskrybentów z bazy emails.txt.
 * Wybierz tę funkcję z listy w edytorze GAS, jeśli chcesz ręcznie wysłać newsletter do wszystkich odbiorców.
 */
function generujRaportWiadomosciWszyscy() {
  return uruchomGenerowanieRaportu({
    wyslijDoWszystkich: true,
    isTest: false
  });
}
function wyslijRaportDoWszystkich() { return generujRaportWiadomosciWszyscy(); }

/**
 * Wewnętrzna funkcja realizująca pełny proces pobierania danych, analizy AI,
 * zapisu do Google Sheets i wysyłki e-maili.
 * @param {Object} opcje
 * @param {boolean} opcje.wyslijDoWszystkich - Czy wysłać do wszystkich subskrybentów z emails.txt
 * @param {boolean} opcje.isTest - Czy raport ma status testowy (prefiks [TEST])
 */
function uruchomGenerowanieRaportu(opcje) {
  opcje = opcje || {};
  const wyslijDoWszystkich = Boolean(opcje.wyslijDoWszystkich);
  const isTest = (typeof opcje.isTest !== "undefined") ? Boolean(opcje.isTest) : !wyslijDoWszystkich;

  START_TIME = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const SOURCES_LOKALNE = wczytajJsonPoSciezce(SCIEZKA_BAZOWA, "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonPoSciezce(SCIEZKA_BAZOWA, "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikPoSciezce(SCIEZKA_BAZOWA, "prompt_migawka_wydarzen.txt");

  if (!filtrProfilu) {
    filtrProfilu = "Domyślny tryb: Ojciec 2 córek (czas wolny/dzieci w Krakowie, Myślenicach i Tarnowie), inwestor śledzący rynki i kluczowe zmiany lokalne, krajowe i globalne. Całkowity zakaz szumu informacyjnego.";
  }

  // Ustalenie listy odbiorców
  let subskrybenci = [];
  if (wyslijDoWszystkich) {
    Logger.log(">>> [PRODUKCJA] Wczytuję pełną bazę odbiorców z emails.txt...");
    subskrybenci = wczytajSubskrybentowZPlikuPoSciezce(SCIEZKA_BAZOWA, "emails.txt");
    if (!subskrybenci || subskrybenci.length === 0) {
      Logger.log(">>> [UWAGA] Brak subskrybentów w emails.txt! Awaryjna wysyłka do: " + MOJ_EMAIL_TESTOWY);
      subskrybenci = [{ email: MOJ_EMAIL_TESTOWY, subRodziny: true, subSwiat: true }];
    } else {
      Logger.log(`>>> [PRODUKCJA] Załadowano ${subskrybenci.length} subskrybentów z pliku.`);
    }
  } else {
    Logger.log(`>>> [TEST RĘCZNY] Wysyłka WYŁĄCZNIE do: ${MOJ_EMAIL_TESTOWY}`);
    subskrybenci = [{ email: MOJ_EMAIL_TESTOWY, subRodziny: true, subSwiat: true }];
  }

  Logger.log(`Załadowano źródeł lokalnych: ${SOURCES_LOKALNE.length}, globalnych: ${SOURCES_GLOBALNE.length}`);

  let dzisiaj = new Date();
  let dzisiajStr = dzisiaj.toISOString().split('T')[0];

  let przed7Dniami = new Date(dzisiaj);
  przed7Dniami.setDate(dzisiaj.getDate() - 7);

  let formatD = (d) => d.toISOString().split('T')[0];
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
        tresciStron[url] = tekstZLinkami.length > 20000 ? tekstZLinkami.substring(0, 20000) : tekstZLinkami;
      } else {
        Logger.log(`Błąd HTTP ${resp.getResponseCode()} dla URL: ${url}`);
        tresciStron[url] = "";
      }
    });
  } catch (e) {
    Logger.log("Błąd pobierania stron przez UrlFetchApp.fetchAll: " + e.message);
  }

  let sekcja1_Rodziny = [];
  let sekcja2_WydarzyloSie = [];
  let sekcja3_WPlanach = [];

  // 1. ŹRÓDŁA LOKALNE
  for (let source of SOURCES_LOKALNE) {
    if (czyCzasSieKonczy()) {
      Logger.log("OSTRZEŻENIE: Zbliża się limit czasu GAS. Przerywam źródła lokalne.");
      break;
    }
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynik = zapytajDeepSeekZbiorczoLokalne(source, tresc, kontekstCzasowy, filtrProfilu);
      if (wynik) {
        if (Array.isArray(wynik.rodziny_trwajace)) {
          sekcja1_Rodziny = sekcja1_Rodziny.concat(wynik.rodziny_trwajace.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
        if (Array.isArray(wynik.rodziny_przyszle)) {
          sekcja1_Rodziny = sekcja1_Rodziny.concat(wynik.rodziny_przyszle.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
        if (Array.isArray(wynik.lokalne_przeszle)) {
          sekcja2_WydarzyloSie = sekcja2_WydarzyloSie.concat(wynik.lokalne_przeszle.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
        if (Array.isArray(wynik.lokalne_plany)) {
          sekcja3_WPlanach = sekcja3_WPlanach.concat(wynik.lokalne_plany.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
      }
    }
  }

  // 2. ŹRÓDŁA GLOBALNE / KRAJOWE
  for (let source of SOURCES_GLOBALNE) {
    if (czyCzasSieKonczy()) {
      Logger.log("OSTRZEŻENIE: Zbliża się limit czasu GAS. Przerywam źródła globalne.");
      break;
    }
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let wynik = zapytajDeepSeekZbiorczoGlobalne(source, tresc, kontekstCzasowy, filtrProfilu);
      if (wynik) {
        if (Array.isArray(wynik.globalne_przeszle)) {
          sekcja2_WydarzyloSie = sekcja2_WydarzyloSie.concat(wynik.globalne_przeszle.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
        if (Array.isArray(wynik.globalne_przyszle)) {
          sekcja3_WPlanach = sekcja3_WPlanach.concat(wynik.globalne_przyszle.filter(row => Array.isArray(row) && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
        }
      }
    }
  }

  // Deduplikacja
  let mapaRodziny = new Map();
  sekcja1_Rodziny.forEach(item => {
    let tytul = (item[4] || "").toLowerCase().trim();
    if (tytul && !mapaRodziny.has(tytul)) mapaRodziny.set(tytul, item);
  });
  sekcja1_Rodziny = Array.from(mapaRodziny.values());

  let mapaWydarzylo = new Map();
  sekcja2_WydarzyloSie.forEach(item => {
    let tytul = (item[5] || item[4] || "").toLowerCase().trim();
    if (tytul && !mapaWydarzylo.has(tytul)) mapaWydarzylo.set(tytul, item);
  });
  sekcja2_WydarzyloSie = Array.from(mapaWydarzylo.values());

  let mapaPlany = new Map();
  sekcja3_WPlanach.forEach(item => {
    let tytul = (item[5] || item[4] || "").toLowerCase().trim();
    if (tytul && !mapaPlany.has(tytul)) mapaPlany.set(tytul, item);
  });
  sekcja3_WPlanach = Array.from(mapaPlany.values());

  // Normalizacja dat z dniami tygodnia
  sekcja1_Rodziny = sekcja1_Rodziny.map(row => {
    if (row && row.length > 2) row[2] = normalizujDateZDniemTygodnia(row[2]);
    return row;
  });
  sekcja2_WydarzyloSie = sekcja2_WydarzyloSie.map(row => {
    if (row && row.length > 2) row[2] = normalizujDateZDniemTygodnia(row[2]);
    return row;
  });
  sekcja3_WPlanach = sekcja3_WPlanach.map(row => {
    if (row && row.length > 2) row[2] = normalizujDateZDniemTygodnia(row[2]);
    return row;
  });

  sortujIGrupujWyniki(sekcja1_Rodziny, 0, 1);
  sortujIGrupujWyniki(sekcja2_WydarzyloSie, 0, 1);
  sortujIGrupujWyniki(sekcja3_WPlanach, 0, 1);

  if (ss) {
    let naglowkiArkuszRodziny = ["Obszar", "Gdzie", "Data / Dzień", "Godzina", "Tytuł / Wydarzenie", "Streszczenie merytoryczne", "Dla kogo", "Warunki wstępu", "Link"];
    let naglowkiArkuszOgolne = ["Obszar", "Gdzie", "Data / Dzień", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"];

    zapiszDoArkusza(ss, "1. Wydarzenia dla Rodzin", sekcja1_Rodziny, naglowkiArkuszRodziny);
    zapiszDoArkusza(ss, "2. Co się wydarzyło", sekcja2_WydarzyloSie, naglowkiArkuszOgolne);
    zapiszDoArkusza(ss, "3. Co jest w planach", sekcja3_WPlanach, naglowkiArkuszOgolne);
  }

  let mapaUrlIkon = wczytajIkonyHerbowZDrive();
  let urlLogo = wczytajLogoZDrive();

  wyslijRaportEmailTabelaryczny(
    sekcja1_Rodziny,
    sekcja2_WydarzyloSie,
    sekcja3_WPlanach,
    dzisiajStr,
    subskrybenci,
    mapaUrlIkon,
    urlLogo,
    isTest // Flaga testu (prefiks [TEST] w temacie maila)
  );
}

// ============================================================================
// SYSTEM OBSŁUGI ŚCIEŻEK WIELOPOZIOMOWYCH (DRIVE TRAVERSAL)
// ============================================================================

function pobierzFolderPoSciezce(sciezkaTekstowa) {
  try {
    let folderyNazwy = sciezkaTekstowa.split(/[\\/]+/).map(s => s.trim()).filter(Boolean);
    let biezacyKatalog = null;

    for (let i = 0; i < folderyNazwy.length; i++) {
      let nazwa = folderyNazwy[i];
      let iterator = (i === 0)
        ? DriveApp.getFoldersByName(nazwa)
        : biezacyKatalog.getFoldersByName(nazwa);

      let znaleziony = null;
      while (iterator.hasNext()) {
        let f = iterator.next();
        if (!f.isTrashed()) {
          znaleziony = f;
          break;
        }
      }

      if (!znaleziony) {
        Logger.log(`[BŁĄD ŚCIEŻKI] Nie znaleziono katalogu: "${nazwa}" (poziom ${i + 1}/${folderyNazwy.length})`);
        return null;
      }
      biezacyKatalog = znaleziony;
    }
    return biezacyKatalog;
  } catch (err) {
    Logger.log(`[BŁĄD TRAVERSAL]: ${err.message}`);
    return null;
  }
}

function wczytajPlikPoSciezce(sciezkaKatalogu, nazwaPliku) {
  let folder = pobierzFolderPoSciezce(sciezkaKatalogu);
  if (!folder) return null;

  let pliki = folder.getFilesByName(nazwaPliku);
  while (pliki.hasNext()) {
    let plik = pliki.next();
    if (!plik.isTrashed()) {
      return plik.getBlob().getDataAsString();
    }
  }
  Logger.log(`[BŁĄD ŚCIEŻKI] Brak pliku "${nazwaPliku}" w katalogu "${folder.getName()}"`);
  return null;
}

function wczytajJsonPoSciezce(sciezkaKatalogu, nazwaPliku) {
  let tresc = wczytajPlikPoSciezce(sciezkaKatalogu, nazwaPliku);
  if (!tresc) return null;
  try {
    return JSON.parse(tresc);
  } catch (e) {
    Logger.log(`[BŁĄD PARSOWANIA JSON ${nazwaPliku}]: ${e.message}`);
    return null;
  }
}

// ============================================================================
// POBIERANIE LOGO I HERBÓW Z NOWEJ LOKALIZACJI
// ============================================================================

function wczytajLogoZDrive() {
  try {
    let sciezkaBrand = SCIEZKA_BAZOWA + "/Brand";
    let folderBrand = pobierzFolderPoSciezce(sciezkaBrand);
    if (!folderBrand) return "";

    let pliki = folderBrand.getFilesByName("Logo MW v2.jpg");
    if (!pliki.hasNext()) {
      pliki = folderBrand.getFilesByName("LOGO.jpg");
    }
    if (pliki.hasNext()) {
      let plik = pliki.next();
      plik.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return "https://drive.google.com/thumbnail?id=" + plik.getId() + "&sz=w500";
    }
  } catch (e) {
    Logger.log("Błąd odczytu Logo: " + e.message);
  }
  return "";
}

function wczytajIkonyHerbowZDrive() {
  const mapowanieNazw = {
    "01_herb_krakowa.jpg": "01_herb_krakowa.jpg",
    "02_herb_orzel_blekitny.jpg": "02_herb_orzel_blekitny.jpg",
    "03_herb_malopolska.jpg": "03_herb_malopolska.jpg",
    "04_herb_myslenice.jpg": "04_herb_myslenice.jpg",
    "05_herb_tarnow_1.jpg": "05_herb_tarnow_1.jpg",
    "06_herb_tarnow_2.jpg": "06_herb_tarnow_2.jpg",
    "07_flaga_polska_1.jpg": "07_flaga_polska_1.jpg",
    "08_flaga_unia_europejska_tekst.jpg": "08_flaga_unia_europejska_tekst.jpg",
    "09_flaga_ue_gwiazdy.jpg": "09_flaga_ue_gwiazdy.jpg",
    "10_symbol_swiat_globus.jpg": "10_symbol_swiat_globus.jpg"
  };

  let urleIkon = {};
  try {
    let sciezkaJpg = SCIEZKA_BAZOWA + "/Brand/ikony_herby_i_symbole/JPG";
    let folderJpg = pobierzFolderPoSciezce(sciezkaJpg);
    if (!folderJpg) return urleIkon;

    for (let plikKlucz in mapowanieNazw) {
      let nazwaPliku = mapowanieNazw[plikKlucz];
      let pliki = folderJpg.getFilesByName(nazwaPliku);
      if (pliki.hasNext()) {
        let plik = pliki.next();
        plik.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        urleIkon[plikKlucz] = "https://drive.google.com/thumbnail?id=" + plik.getId() + "&sz=w160";
      }
    }
  } catch (e) {
    Logger.log("Błąd odczytu ikon herbowych JPG: " + e.message);
  }
  return urleIkon;
}

// ============================================================================
// FORMATOWANIE DATY Z DNIEM TYGODNIA
// ============================================================================

function normalizujDateZDniemTygodnia(wartoscDaty) {
  if (!wartoscDaty) return "—";
  let tekst = String(wartoscDaty).trim();
  if (tekst === "—" || tekst.toLowerCase() === "trwa") return tekst;

  const dniTygodniaPL = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  for (let d of dniTygodniaPL) {
    if (tekst.toLowerCase().includes(d)) return tekst;
  }

  let rok, miesiac, dzien;
  let matchISO = tekst.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (matchISO) {
    rok = parseInt(matchISO[1], 10);
    miesiac = parseInt(matchISO[2], 10);
    dzien = parseInt(matchISO[3], 10);
  } else {
    let matchPL = tekst.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (matchPL) {
      dzien = parseInt(matchPL[1], 10);
      miesiac = parseInt(matchPL[2], 10);
      rok = parseInt(matchPL[3], 10);
    }
  }

  if (rok && miesiac && dzien) {
    let obiektData = new Date(rok, miesiac - 1, dzien);
    if (!isNaN(obiektData.getTime())) {
      let dStr = String(dzien).padStart(2, "0");
      let mStr = String(miesiac).padStart(2, "0");
      let dzienNazwa = dniTygodniaPL[obiektData.getDay()];
      return `${dStr}.${mStr}.${rok} ${dzienNazwa}`;
    }
  }
  return tekst;
}

// ============================================================================
// KOMUNIKACJA Z DEEPSEEK AI
// ============================================================================

function zapytajDeepSeekZbiorczoLokalne(source, trescZrodla, kontekstCzasowy, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY w Ustawieniach Projektu.");

  const url = "https://api.deepseek.com/chat/completions";
  const systemPrompt =
    "Jesteś precyzyjnym asystentem analitycznym. Przeanalizuj treść źródła i wyodrębnij pozycje do 4 kategorii:\n" +
    "1. 'rodziny_trwajace': WYSTAWY I ATRAKCJE DLA RODZIN TRWAJĄCE OBECNIE (Kraków, Myślenice, Tarnów). W kolumnie 'Data / Dzień' wpisz: 'Trwa'.\n" +
    "2. 'rodziny_przyszle': NADCHODZĄCE WYDARZENIA DLA RODZIN NA 7 DNI (spektakle, warsztaty, pikniki w Krakowie, Myślenicach, Tarnowie). Podaj konkretną datę.\n" +
    "3. 'lokalne_przeszle': CO SIĘ WYDARZYŁO W MINIONYCH 7 DNIACH LOKALNIE (uchwały, inwestycje, remonty - Kraków, Małopolska).\n" +
    "4. 'lokalne_plany': CO JEST W PLANACH LOKALNIE (zapowiedzi inwestycji, konsultacje, startujące remonty - Kraków, Małopolska).\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    "REGUŁY DOTYCZĄCE KOLUMN:\n" +
    "- Struktura dla 'rodziny_trwajace' i 'rodziny_przyszle': [\"Obszar\", \"Gdzie\", \"Data / Dzień\", \"Godzina\", \"Tytuł / Wydarzenie\", \"Streszczenie merytoryczne\", \"Dla kogo\", \"Warunki wstępu\", \"Link\"]\n" +
    "- Struktura dla 'lokalne_przeszle' i 'lokalne_plany': [\"Obszar\", \"Gdzie\", \"Data / Dzień\", \"Godzina\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Dla kogo\", \"Link\"]\n" +
    "- 'Obszar': Wpisz DOKŁADNIE jedno z miast: Kraków, Myślenice, Tarnów lub Małopolska.\n" +
    "- Streszczenie merytoryczne: MAKSYMALNIE 1 konkretne zdanie (do 160 znaków)!\n" +
    "- W kolumnie 'Link': podaj bezpośredni adres URL. Jeśli brak, wstaw: '" + source.url + "'.\n\n" +
    "Zwróć poprawny JSON o strukturze:\n" +
    "{\n" +
    "  \"rodziny_trwajace\": [[...]],\n" +
    "  \"rodziny_przyszle\": [[...]],\n" +
    "  \"lokalne_przeszle\": [[...]],\n" +
    "  \"lokalne_plany\": [[...]]\n" +
    "}\nJeśli brak wpisów w danej kategorii, zwróć pustą tablicę []. Maksymalnie po 6-8 najistotniejszych wpisów.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Tekst źródła (" + source.url + "):\n\"\"\"" + trescZrodla + "\"\"\"" }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096
  };

  try {
    let response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    let code = response.getResponseCode();
    let raw = response.getContentText();
    if (code !== 200) {
      Logger.log(`[DeepSeek BŁĄD HTTP ${code}] dla ${source.url}: ${raw}`);
      return null;
    }

    let jsonResp = JSON.parse(raw);
    let parsed = JSON.parse(jsonResp.choices[0].message.content);
    return normalizujLinkiWZestawie(parsed, source.url);
  } catch (e) {
    Logger.log("Błąd DeepSeek (Lokalne): " + e.message);
    return null;
  }
}

function zapytajDeepSeekZbiorczoGlobalne(source, trescZrodla, kontekstCzasowy, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY w Ustawieniach Projektu.");

  const url = "https://api.deepseek.com/chat/completions";
  const systemPrompt =
    "Jesteś precyzyjnym asystentem analitycznym. Przeanalizuj treść źródła i wyodrębnij pozycje do 2 kategorii:\n" +
    "1. 'globalne_przeszle': CO SIĘ WYDARZYŁO W MINIONYCH 7 DNIACH (KRAJ/ŚWIAT) - kluczowe dane rynkowe, banki centralne, geopolityka.\n" +
    "2. 'globalne_przyszle': CO JEST W PLANACH (KRAJ/ŚWIAT) - zaplanowane publikacje danych makro (CPI, PKB), posiedzenia stóp procentowych, szczyty.\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    "REGUŁY DOTYCZĄCE KOLUMN:\n" +
    "- Struktura obu kategorii: [\"Obszar\", \"Gdzie\", \"Data / Dzień\", \"Godzina\", \"Kategoria\", \"Tytuł / Temat\", \"Streszczenie merytoryczne\", \"Dla kogo\", \"Link\"]\n" +
    "- 'Obszar': Wpisz DOKŁADNIE jedno z: Polska, Unia Europejska lub Świat.\n" +
    "- Streszczenie merytoryczne: MAKSYMALNIE 1 konkretne zdanie (do 160 znaków)!\n" +
    "- W kolumnie 'Link': podaj bezpośredni adres URL. Jeśli brak, wstaw: '" + source.url + "'.\n\n" +
    "Zwróć poprawny JSON o strukturze:\n" +
    "{\n" +
    "  \"globalne_przeszle\": [[...]],\n" +
    "  \"globalne_przyszle\": [[...]]\n" +
    "}\nJeśli brak wpisów w danej kategorii, zwróć pustą tablicę []. Maksymalnie po 6-8 najistotniejszych wpisów.";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Tekst źródła (" + source.url + "):\n\"\"\"" + trescZrodla + "\"\"\"" }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096
  };

  try {
    let response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    let code = response.getResponseCode();
    let raw = response.getContentText();
    if (code !== 200) {
      Logger.log(`[DeepSeek BŁĄD HTTP ${code}] dla ${source.url}: ${raw}`);
      return null;
    }

    let jsonResp = JSON.parse(raw);
    let parsed = JSON.parse(jsonResp.choices[0].message.content);
    return normalizujLinkiWZestawie(parsed, source.url);
  } catch (e) {
    Logger.log("Błąd DeepSeek (Globalne): " + e.message);
    return null;
  }
}

function normalizujLinkiWZestawie(obiektDanych, domyslnyUrl) {
  if (!obiektDanych) return null;
  for (let klucz in obiektDanych) {
    if (Array.isArray(obiektDanych[klucz])) {
      obiektDanych[klucz] = obiektDanych[klucz].map(row => {
        if (!Array.isArray(row) || row.length === 0) return row;
        let lastIdx = row.length - 1;
        let czystyUrl = wyodrebnijCzystyUrl(row[lastIdx]);
        if (!czystyUrl) {
          for (let i = 0; i < row.length - 1; i++) {
            let u = wyodrebnijCzystyUrl(row[i]);
            if (u) {
              czystyUrl = u;
              break;
            }
          }
        }
        row[lastIdx] = czystyUrl || domyslnyUrl;
        return row;
      });
    }
  }
  return obiektDanych;
}

// ============================================================================
// GENEROWANIE SZABLONU EMAIL HTML
// ============================================================================

function generujCialoRaportuEmailHtml(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, mapaUrlIkon, urlLogo, subRodziny, subSwiat) {
  mapaUrlIkon = mapaUrlIkon || {};

  const resztaKolumnRodziny = ["Data / Dzień", "Godzina", "Tytuł / Wydarzenie", "Streszczenie merytoryczne", "Dla kogo", "Warunki wstępu", "Link"];
  const resztaKolumnOgolne = ["Data / Dzień", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"];

  const konfiguracjaRodziny = [
    { nazwaPliku: "01_herb_krakowa.jpg", etykieta: "Kraków", filtr: ["kraków", "krakow"] },
    { nazwaPliku: "04_herb_myslenice.jpg", etykieta: "Myślenice", filtr: ["myślenic", "myslenic"] },
    { nazwaPliku: "05_herb_tarnow_1.jpg", etykieta: "Tarnów", filtr: ["tarnów", "tarnow"] }
  ];

  const konfiguracjaOgolna = [
    { nazwaPliku: "01_herb_krakowa.jpg", etykieta: "Kraków", filtr: ["kraków", "krakow"] },
    { nazwaPliku: "03_herb_malopolska.jpg", etykieta: "Małopolska", filtr: ["małopolsk", "malopolsk"] },
    { nazwaPliku: "07_flaga_polska_1.jpg", etykieta: "Polska", filtr: ["polska", "kraj", "rpp"] },
    { nazwaPliku: "09_flaga_ue_gwiazdy.jpg", etykieta: "Unia Europejska", filtr: ["unia", "ue", "europejsk", "ebc", "bruksela"] },
    { nazwaPliku: "10_symbol_swiat_globus.jpg", etykieta: "Świat", filtr: ["świat", "swiat", "global", "usa", "fed", "rynki", "azja"] }
  ];

  let logoTag = urlLogo ? `<img src="${urlLogo}" alt="Logo" style="height: 60px; width: auto; vertical-align: middle; margin-right: 16px; border-radius: 6px; display: block;" />` : "";

  let sekcjeHtml = "";

  if (subRodziny) {
    sekcjeHtml += `
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 15px; color: #7f4448; margin: 0 0 12px 0; border-bottom: 2px solid #AB6D70; padding-bottom: 5px; font-weight: 700;">
          1. Wydarzenia dla Rodzin z Dziećmi (Kraków i Region)
        </h3>
        ${budujTabeleZHerbamiWKolumnie(daneRodziny, resztaKolumnRodziny, konfiguracjaRodziny, "#AB6D70", "#fcf8f8", mapaUrlIkon, 8)}
      </div>
    `;
  }

  if (subSwiat) {
    sekcjeHtml += `
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 15px; color: #8e6c31; margin: 0 0 12px 0; border-bottom: 2px solid #C39D5C; padding-bottom: 5px; font-weight: 700;">
          2. Co się wydarzyło w minionym tygodniu (Polska, Europa, Świat)
        </h3>
        ${budujTabeleZHerbamiWKolumnie(daneWydarzylo, resztaKolumnOgolne, konfiguracjaOgolna, "#C39D5C", "#fdfbf7", mapaUrlIkon, 6)}
      </div>

      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 15px; color: #1b3325; margin: 0 0 12px 0; border-bottom: 2px solid #264533; padding-bottom: 5px; font-weight: 700;">
          3. Co jest w planach? (Kluczowe wydarzenia nadchodzącego tygodnia)
        </h3>
        ${budujTabeleZHerbamiWKolumnie(danePlany, resztaKolumnOgolne, konfiguracjaOgolna, "#264533", "#f5f8f6", mapaUrlIkon, 6)}
      </div>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 960px; margin: 0 auto; font-size: 12px; line-height: 1.5;">
      <div style="border-top: 3px solid #AB6F71; border-bottom: 2px solid #e2e8f0; padding-top: 14px; padding-bottom: 14px; margin-bottom: 24px; display: flex; align-items: center;">
        ${logoTag}
        <div>
          <h2 style="font-size: 22px; color: #0f172a; margin: 0; padding: 0; font-weight: 700; line-height: 1.2; letter-spacing: -0.3px;">
            Migawka Wydarzeń
          </h2>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">
            Wydanie z dnia: ${dzisiajStr} &bull; Tygodniowy raport analityczny wspierany przez DeepSeek AI
          </p>
        </div>
      </div>
      ${sekcjeHtml}
    </div>
  `;
}

function budujTabeleZHerbamiWKolumnie(dane, pozostaleNaglowki, konfiguracja, kolorAkcentu, kolorWierszaAlt, mapaUrlIkon, limitWpisow) {
  let html = "";
  let pozostale = [...(dane || [])];

  konfiguracja.forEach(pozycja => {
    let wierszeDlaPozycji = pozostale.filter(row => {
      let obszar = String(row[0] || "").toLowerCase();
      return pozycja.filtr.some(slowo => obszar.includes(slowo));
    });

    pozostale = pozostale.filter(row => !wierszeDlaPozycji.includes(row));

    let imgUrl = mapaUrlIkon[pozycja.nazwaPliku] || "";
    let imgTag = imgUrl ? `<img src="${imgUrl}" alt="${pozycja.etykieta}" style="height: 18px; width: auto; vertical-align: middle; margin-right: 6px; border-radius: 2px;" />` : "";

    let naglowekPierwszejKolumny = `<span style="display: inline-flex; align-items: center;">${imgTag}<strong>${pozycja.etykieta}</strong></span>`;
    let pelneNaglowkiTabeli = [naglowekPierwszejKolumny, ...pozostaleNaglowki];
    let oczekiwanaLiczbaKolumn = pelneNaglowkiTabeli.length;

    let wierszeDoEmaila = wierszeDlaPozycji.map(row => {
      let r = Array.isArray(row) ? [...row] : [];
      let link = r[r.length - 1];
      let srodek = r.slice(1, r.length - 1);

      let docelowaLiczbaPrzedLinkiem = oczekiwanaLiczbaKolumn - 2;
      while (srodek.length < docelowaLiczbaPrzedLinkiem) {
        srodek.push("—");
      }
      if (srodek.length > docelowaLiczbaPrzedLinkiem) {
        srodek = srodek.slice(0, docelowaLiczbaPrzedLinkiem);
      }

      srodek.push(link);
      return srodek;
    });

    html += `
      <div style="margin-top: 10px; margin-bottom: 14px;">
        ${wierszeDoEmaila.length > 0 
          ? budujTabeleEmail(wierszeDoEmaila.slice(0, limitWpisow), pelneNaglowkiTabeli, kolorAkcentu, kolorWierszaAlt)
          : `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin: 4px 0 8px 6px;">${imgTag}<strong>${pozycja.etykieta}</strong>: Brak nowych wpisów w tym okresie.</p>`
        }
      </div>
    `;
  });

  return html;
}

function budujTabeleEmail(dane, naglowki, kolorAkcentu, kolorWierszaAlt) {
  if (!dane || dane.length === 0) return "";

  let html = `<table style="border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 4px; margin-bottom: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">`;
  html += `<thead><tr style="background-color: #ffffff; color: #0f172a; border-top: 3px solid ${kolorAkcentu}; border-bottom: 2px solid #cbd5e1;">`;
  naglowki.forEach((naglowek, idx) => {
    let stylPierwszej = (idx === 0) ? "white-space: nowrap; min-width: 130px;" : "";
    html += `<th style="border: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; ${stylPierwszej}">${naglowek}</th>`;
  });
  html += `</tr></thead><tbody>`;

  dane.forEach((wiersz, idx) => {
    let tlo = (idx % 2 === 1) ? `background-color: ${kolorWierszaAlt};` : `background-color: #ffffff;`;
    html += `<tr style="${tlo}">`;
    wiersz.forEach((komorka, colIdx) => {
      let tekst = String(komorka || "").trim();
      let jestOstatniaKolumna = (colIdx === wiersz.length - 1);

      if (jestOstatniaKolumna) {
        tekst = formatujKomorkeZLinkiem(tekst, kolorAkcentu);
      } else if (tekst.startsWith("http://") || tekst.startsWith("https://")) {
        tekst = formatujKomorkeZLinkiem(tekst, kolorAkcentu);
      } else if (tekst.length > 220) {
        tekst = tekst.substring(0, 220) + "...";
      }

      html += `<td style="border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; line-height: 1.35; color: #334155;">${tekst}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function wyodrebnijCzystyUrl(tekst) {
  if (!tekst) return "";
  let str = String(tekst).trim();

  let matchZdublowany = str.match(/https?:\/\/[^\/]+\/+(?:https?:\/\/|www\.)([^\s"'<>\)\]]+)/i);
  if (matchZdublowany) {
    return "https://" + matchZdublowany[1].replace(/[.,;:\)\]>]+$/, "").trim();
  }

  if (str.startsWith("//")) str = "https:" + str;
  else if (str.startsWith("www.")) str = "https://" + str;

  let match = str.match(/https?:\/\/[^\s"'<>\)\]]+/i);
  if (!match) return "";
  let url = match[0];
  url = url.replace(/[.,;:\)\]>]+$/, "").trim();
  return url;
}

function formatujKomorkeZLinkiem(tekst, kolor) {
  let url = wyodrebnijCzystyUrl(tekst);
  if (url) {
    return `<a href="${url}" target="_blank" style="background-color: ${kolor}; color: #ffffff; text-decoration: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-block;">Link ↗</a>`;
  }
  return "—";
}

function wyslijRaportEmailTabelaryczny(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, listaSubskrybentow, mapaUrlIkon, urlLogo, isTest = false) {
  let odbiorcy = Array.isArray(listaSubskrybentow) ? listaSubskrybentow : [listaSubskrybentow];
  if (odbiorcy.length === 0) return;

  let prefiks = isTest ? "[TEST] " : "";
  let temat = prefiks + "Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  odbiorcy.forEach((sub, index) => {
    let emailCzysty = (typeof sub === "string" ? sub : sub.email).trim();
    if (!emailCzysty) return;

    let subRodziny = typeof sub.subRodziny !== "undefined" ? sub.subRodziny : true;
    let subSwiat = typeof sub.subSwiat !== "undefined" ? sub.subSwiat : true;

    if (!subRodziny && !subSwiat) return;

    let cialoRaportuHtml = generujCialoRaportuEmailHtml(
      daneRodziny,
      daneWydarzylo,
      danePlany,
      dzisiajStr,
      mapaUrlIkon,
      urlLogo,
      subRodziny,
      subSwiat
    );

    let unsubscribeLink = webAppUrl ? `${webAppUrl}?action=unsubscribe&email=${encodeURIComponent(emailCzysty)}` : "#";

    let emailHtml = `
      <div style="max-width: 960px; margin: 0 auto; background-color: #ffffff; padding: 16px;">
        ${cialoRaportuHtml}
        <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          Raport wyselekcjonowany z użyciem sztucznej inteligencji DeepSeek dla: <strong>${emailCzysty}</strong>.<br/>
          <a href="${unsubscribeLink}" target="_blank" style="color: #64748b; margin-top: 6px; display: inline-block;">Wypisz się z subskrypcji</a>
        </div>
      </div>
    `;

    try {
      MailApp.sendEmail({
        to: emailCzysty,
        subject: temat,
        htmlBody: emailHtml
      });
      Logger.log(`[${index + 1}/${odbiorcy.length}] Wysłano do: ${emailCzysty} (Rodziny: ${subRodziny}, Świat: ${subSwiat})`);
      if (index < odbiorcy.length - 1) Utilities.sleep(300);
    } catch (err) {
      Logger.log(`Błąd wysyłki do ${emailCzysty}: ${err.message}`);
    }
  });
}

// ============================================================================
// OBSŁUGA PLIKU emails.txt W NOWEJ ŚCIEŻCE
// ============================================================================

function wczytajSubskrybentowZPlikuPoSciezce(sciezkaKatalogu, nazwaPliku) {
  let zawartosc = wczytajPlikPoSciezce(sciezkaKatalogu, nazwaPliku);
  if (!zawartosc) return null;

  let linie = zawartosc.split(/[\r\n]+/);
  let wynik = [];
  let widziane = new Set();

  linie.forEach(l => {
    let trimmed = l.trim();
    if (!trimmed || !trimmed.includes("@")) return;

    let czesci = trimmed.split(";");
    let em = czesci[0].trim();
    let klucz = em.toLowerCase();
    if (widziane.has(klucz)) return;
    widziane.add(klucz);

    let pref = czesci[1] ? czesci[1].toLowerCase() : "rodziny,swiat";
    let subRodziny = pref.includes("rodziny");
    let subSwiat = pref.includes("swiat");

    if (!czesci[1]) {
      subRodziny = true;
      subSwiat = true;
    }

    wynik.push({
      email: em,
      subRodziny: subRodziny,
      subSwiat: subSwiat
    });
  });

  return wynik;
}

function dodajAdresEmailDoPliku(sciezkaKatalogu, nazwaPliku, nowyEmail, subRodziny, subSwiat) {
  try {
    let folder = pobierzFolderPoSciezce(sciezkaKatalogu);
    if (!folder) return { sukces: false };

    let pliki = folder.getFilesByName(nazwaPliku);
    let plik = pliki.hasNext() ? pliki.next() : folder.createFile(nazwaPliku, "");

    let linie = plik.getBlob().getDataAsString().split(/[\r\n]+/);
    let mapa = new Map();
    let duplikat = false;

    linie.forEach(l => {
      let trimmed = l.trim();
      if (!trimmed || !trimmed.includes("@")) return;
      let czesci = trimmed.split(";");
      let em = czesci[0].trim().toLowerCase();
      let pref = czesci[1] ? czesci[1].trim() : "rodziny,swiat";
      mapa.set(em, pref);
    });

    let klucz = nowyEmail.trim().toLowerCase();
    if (mapa.has(klucz)) {
      duplikat = true;
    }

    let prefList = [];
    if (subRodziny) prefList.push("rodziny");
    if (subSwiat) prefList.push("swiat");
    let nowaWartoscPref = prefList.join(",");

    mapa.set(klucz, nowaWartoscPref);

    let noweWiersze = [];
    mapa.forEach((pref, em) => {
      noweWiersze.push(`${em};${pref}`);
    });

    plik.setContent(noweWiersze.join("\n"));
    return { sukces: true, duplikat: duplikat };
  } catch (err) {
    Logger.log("Błąd dodawania e-maila: " + err.message);
    return { sukces: false };
  }
}

function usunAdresEmailZPliku(sciezkaKatalogu, nazwaPliku, emailDoUsuniecia) {
  try {
    let folder = pobierzFolderPoSciezce(sciezkaKatalogu);
    if (!folder) return false;

    let pliki = folder.getFilesByName(nazwaPliku);
    if (!pliki.hasNext()) return false;
    let plik = pliki.next();

    let emailCel = emailDoUsuniecia.trim().toLowerCase();
    let linie = plik.getBlob().getDataAsString().split(/[\r\n]+/);
    let noweLinie = linie.filter(l => {
      let trimmed = l.trim();
      if (!trimmed || !trimmed.includes("@")) return false;
      let em = trimmed.split(";")[0].trim().toLowerCase();
      return em !== emailCel;
    });

    plik.setContent(noweLinie.join("\n"));
    return true;
  } catch (err) {
    Logger.log("Błąd usuwania e-maila: " + err.message);
    return false;
  }
}

// ============================================================================
// WEB APP: SUBSKRYPCJA I UNSUBSCRIBE
// ============================================================================

function doGet(e) {
  let parametry = e ? e.parameter : null;
  let email = parametry ? parametry.email : null;
  let akcja = parametry ? parametry.action : null;

  if (akcja === "unsubscribe" && email) {
    let sukces = usunAdresEmailZPliku(SCIEZKA_BAZOWA, "emails.txt", email.trim());
    let tytul = sukces ? "Wypisano z subskrypcji" : "Wystąpił błąd";
    let kolor = sukces ? "#059669" : "#dc2626";
    let komunikat = sukces
      ? `Twój adres <strong>${email}</strong> został pomyślnie usunięty z listy odbiorców newslettera.`
      : `Nie udało się usunąć adresu <strong>${email}</strong>.`;

    let html = generujKomunikatKartyHtml(tytul, kolor, komunikat);
    return HtmlService.createHtmlOutput(html)
      .setTitle(tytul)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  let urlLogo = wczytajLogoZDrive();
  return HtmlService.createHtmlOutput(generujFormularzZapisuHtml(urlLogo))
    .setTitle("Zapisz się do Migawki Wydarzeń")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let postData = e ? e.parameter : null;
  if (!postData) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Brak przesłanych danych." })).setMimeType(ContentService.MimeType.JSON);
  }

  let email = postData.email ? postData.email.trim() : "";
  let captchaToken = postData["cf-turnstile-response"] || postData["g-recaptcha-response"] || "";

  if (!zweryfikujCaptcha(captchaToken)) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Błąd weryfikacji antyspamowej Captcha." })).setMimeType(ContentService.MimeType.JSON);
  }

  if (!email || !email.includes("@")) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Wprowadź prawidłowy adres e-mail." })).setMimeType(ContentService.MimeType.JSON);
  }

  let subRodziny = postData.opcja_rodziny === "1" || postData.opcja_rodziny === "on";
  let subSwiat = postData.opcja_swiat === "1" || postData.opcja_swiat === "on";

  if (!subRodziny && !subSwiat) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Zaznacz co najmniej jeden raport do subskrypcji." })).setMimeType(ContentService.MimeType.JSON);
  }

  let wynik = dodajAdresEmailDoPliku(SCIEZKA_BAZOWA, "emails.txt", email, subRodziny, subSwiat);
  return ContentService.createTextOutput(JSON.stringify({
    sukces: wynik.sukces,
    komunikat: wynik.sukces
      ? `Dziękujemy! Twój adres został pomyślnie zapisany.`
      : (wynik.duplikat ? "Ten adres e-mail jest już zarejestrowany. Zaktualizowaliśmy Twoje preferencje." : "Wystąpił błąd podczas zapisu.")
  })).setMimeType(ContentService.MimeType.JSON);
}

function zweryfikujCaptcha(token) {
  const secretKey = PropertiesService.getScriptProperties().getProperty("CAPTCHA_SECRET_KEY");
  if (!secretKey || secretKey === "TWÓJ_SECRET_KEY_CAPTCHA") return true;
  if (!token) return false;

  try {
    let resp = UrlFetchApp.fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "post",
      payload: { secret: secretKey, response: token },
      muteHttpExceptions: true
    });
    return JSON.parse(resp.getContentText()).success === true;
  } catch (err) {
    return false;
  }
}

// ============================================================================
// STRONA ZAPISU (HTML + CSS)
// ============================================================================

function generujFormularzZapisuHtml(urlLogo) {
  const siteKey = PropertiesService.getScriptProperties().getProperty("CAPTCHA_SITE_KEY") || "";
  let webAppUrl = "";
  try { webAppUrl = ScriptApp.getService().getUrl(); } catch(e) {}

  let kontaktEmail = "";
  try { kontaktEmail = Session.getActiveUser().getEmail(); } catch(e) {}

  let logoImgHtml = urlLogo
    ? `<img src="${urlLogo}" alt="Logo Migawka Wydarzeń" style="max-height: 160px; max-width: 100%; height: auto; margin: 0 auto 20px auto; display: block; border-radius: 8px;">`
    : `<div style="font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.5px;">Migawka Wydarzeń</div>`;

  let linkZgloszenia = kontaktEmail
    ? `mailto:${kontaktEmail}?subject=Propozycja%20nowego%20źródła%20-%20Migawka%20Wydarzeń`
    : "#";

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>Migawka Wydarzeń – Cotygodniowy newsletter analityczny AI</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${siteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ''}
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #f8fafc;
          color: #1e293b;
          margin: 0;
          padding: 32px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .container {
          background: #ffffff;
          max-width: 640px;
          width: 100%;
          padding: 40px 36px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.04), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
        }
        .header {
          text-align: center;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 24px;
          margin-bottom: 24px;
        }
        .badge {
          display: inline-block;
          background: #fdf2f2;
          color: #991b1b;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid #fecaca;
          margin-bottom: 14px;
        }
        .schedule-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f0fdf4;
          color: #166534;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 8px;
          border: 1px solid #bbf7d0;
          margin-top: 12px;
        }
        h1 {
          font-size: 24px;
          color: #0f172a;
          margin: 0 0 10px 0;
          font-weight: 700;
          line-height: 1.3;
          letter-spacing: -0.4px;
        }
        p.subtitle {
          font-size: 14px;
          color: #475569;
          margin: 0;
          line-height: 1.55;
        }
        .intro-box {
          background: #fafaf9;
          border-left: 3px solid #AB6F71;
          padding: 16px 18px;
          border-radius: 0 8px 8px 0;
          font-size: 12.5px;
          color: #334155;
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .preview-trigger-container {
          text-align: center;
          margin-bottom: 24px;
        }
        .btn-preview {
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }
        .btn-preview:hover {
          background: #e2e8f0;
          color: #0f172a;
          border-color: #94a3b8;
        }
        .options-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 12px;
        }
        .option-box {
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 18px;
          margin-bottom: 14px;
          display: flex;
          align-items: flex-start;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #ffffff;
        }
        .option-box:hover {
          border-color: #cbd5e1;
          background: #fbfcfe;
        }
        .option-box input[type="checkbox"] {
          margin-top: 3px;
          margin-right: 14px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: #AB6F71;
          flex-shrink: 0;
        }
        .option-content h3 {
          font-size: 14.5px;
          margin: 0 0 5px 0;
          color: #0f172a;
          font-weight: 700;
        }
        .option-content p {
          font-size: 12.5px;
          color: #475569;
          margin: 0 0 8px 0;
          line-height: 1.5;
        }
        .option-sources {
          font-size: 11px;
          color: #64748b;
          background: #f1f5f9;
          padding: 5px 10px;
          border-radius: 6px;
          line-height: 1.45;
        }
        .email-field {
          margin-top: 24px;
        }
        .email-field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }
        input[type="email"] {
          width: 100%;
          padding: 12px 14px;
          font-size: 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input[type="email"]:focus {
          border-color: #AB6F71;
          box-shadow: 0 0 0 3px rgba(171, 111, 113, 0.15);
        }
        .submit-btn {
          width: 100%;
          background: #AB6F71;
          color: #ffffff;
          border: none;
          padding: 14px;
          font-size: 14.5px;
          font-weight: 700;
          border-radius: 7px;
          cursor: pointer;
          margin-top: 18px;
          transition: background 0.2s;
        }
        .submit-btn:hover {
          background: #945759;
        }
        .msg-box {
          display: none;
          padding: 12px;
          border-radius: 6px;
          font-size: 13px;
          text-align: center;
          margin-top: 14px;
        }
        .msg-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .msg-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .feedback-box {
          margin-top: 28px;
          background: #fdfaf6;
          border: 1px dashed #d6c3b3;
          border-radius: 8px;
          padding: 16px;
          font-size: 12px;
          color: #57463a;
          line-height: 1.55;
        }
        .feedback-box strong { color: #3d2b20; }
        .feedback-box a { color: #8a4b4e; font-weight: 600; text-decoration: underline; }
        .disclaimer-box {
          margin-top: 20px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          font-size: 11px;
          color: #64748b;
          line-height: 1.6;
        }
        .disclaimer-box p { margin: 0 0 7px 0; }
        .disclaimer-box p:last-child { margin-bottom: 0; }

        .modal-overlay {
          display: none;
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(3px);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 12px;
          max-width: 860px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .modal-header {
          padding: 14px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        }
        .modal-header h3 { margin: 0; font-size: 15px; color: #0f172a; }
        .modal-close { background: transparent; border: none; font-size: 22px; line-height: 1; color: #64748b; cursor: pointer; }
        .modal-close:hover { color: #0f172a; }
        .modal-body { padding: 24px; overflow-y: auto; font-size: 12px; }
        .sample-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; font-size: 11px; }
        .sample-table th, .sample-table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: top; }
        .sample-table th { background: #f8fafc; font-weight: 700; color: #334155; }
        .sample-tag { background: #AB6F71; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-decoration: none; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoImgHtml}
          <div class="badge">Inicjatywa Prywatna &bull; Bezpłatny Raport</div>
          <h1>Konkretne informacje zamiast szumu</h1>
          <p class="subtitle">Wszystko, co ważne w Twoim regionie i na świecie — przejrzysty, selekcjonowany raport prosto na skrzynkę e-mail.</p>
          <div class="schedule-badge">📅 Wysyłka w każdy poniedziałek między 7:00 a 8:00 rano (czasu polskiego)</div>
        </div>

        <div class="intro-box">
          <strong>Jak powstaje ten newsletter?</strong><br>
          Co tydzień silnik sztucznej inteligencji (<strong>DeepSeek</strong>) analizuje wybrane witryny instytucjonalne i branżowe. AI eliminuje clickbait, sensację oraz powierzchowne notki prasowe, wyodrębniając wyłącznie wartościowe inicjatywy rodzinne oraz kluczowe fakty rynkowo-gospodarcze wraz z bezpośrednimi źródłami.
        </div>

        <div class="preview-trigger-container">
          <button type="button" id="openPreviewBtn" class="btn-preview">👁️ Zobacz przykładowy raport (podgląd)</button>
        </div>

        <form id="subscribeForm">
          <div class="options-title">Wybierz zakres subskrypcji:</div>

          <label class="option-box">
            <input type="checkbox" name="opcja_rodziny" value="1" checked>
            <div class="option-content">
              <h3>Raport 1: Wydarzenia dla Rodzin z Dziećmi</h3>
              <p>Wyselekcjonowane spektakle, warsztaty, wystawy, pikniki i inicjatywy edukacyjne w Krakowie i Małopolsce na nadchodzące 7 dni oraz stale trwające wystawy.</p>
              <div class="option-sources">
                <strong>Przeszukiwane źródła:</strong> CK Podgórza (Sokolska, Fort Borek, Iskierka), Dzielnica IX Łagiewniki-Borek Fałęcki, SM Cegielniana, Samorządowe Przedszkole 140, CSM Tarnów, Kultura Tarnów, Wydarzenia Miasto-Info (Myślenice), Małopolska.pl.
              </div>
            </div>
          </label>

          <label class="option-box">
            <input type="checkbox" name="opcja_swiat" value="1" checked>
            <div class="option-content">
              <h3>Raport 2 & 3: Przegląd Informacyjny – Polska i Świat</h3>
              <p>Zwięzłe podsumowanie kluczowych wydarzeń minionego tygodnia oraz harmonogram najważniejszych decyzji makroekonomicznych, rynkowych i politycznych na kolejny tydzień.</p>
              <div class="option-sources">
                <strong>Przeszukiwane źródła:</strong> Forsal.pl (Gospodarka i finanse), Biznes PAP, Politico.eu (Europa i regulacje), Rzeczpospolita Świat (Geopolityka), Zero.pl (Kraj).
              </div>
            </div>
          </label>

          <div class="email-field">
            <label for="email">Twój adres e-mail:</label>
            <input type="email" id="email" name="email" placeholder="twoj@adres.pl" required>
          </div>

          ${siteKey ? `<div class="cf-turnstile" data-sitekey="${siteKey}" style="margin-top:14px;"></div>` : ''}

          <button type="submit" id="submitBtn" class="submit-btn">Zapisz się bezpłatnie</button>
        </form>

        <div id="statusMsg" class="msg-box"></div>

        <div class="feedback-box">
          <strong>Masz propozycję wartościowego źródła?</strong><br>
          Projekt ma charakter otwarty na rozwój bazy wiedzy. Jeżeli znasz interesującą stronę, napisz do mnie: 
          <a href="${linkZgloszenia}">${kontaktEmail ? kontaktEmail : "skontaktuj się ze mną"}</a>. Wystarczy, że podasz link i w <strong>2 zwięzłych zdaniach</strong> wyjaśnisz, dlaczego warto go uwzględnić w analizie AI.<br>
          <em>Uwaga: Zgodnie z profilem projektu, baza wydarzeń lokalnych dotyczy <strong>wyłącznie regionu Małopolski</strong>.</em>
        </div>

        <div class="disclaimer-box">
          <p><strong>Harmonogram wysyłki:</strong> Newsletter przesyłany jest regularnie raz w tygodniu, w każdy poniedziałek w przedziale godzinowym 7:00 – 8:00 rano czasu polskiego.</p>
          <p><strong>Charakter projektu:</strong> Newsletter jest całkowicie niekomercyjną inicjatywą prywatną, stworzoną i prowadzoną na własne potrzeby organizacyjne. Raport nie zawiera materiałów sponsorowanych ani reklam.</p>
          <p><strong>Bezpieczeństwo danych:</strong> Przekazane adresy e-mail są bezpiecznie przechowywane i służą wyłącznie do bezpośredniej wysyłki zestawień. Nigdy nie były i nie będą udostępniane podmiotom trzecim.</p>
          <p><strong>Rezygnacja z subskrypcji:</strong> Możesz wycofać zgodę w dowolnym momencie jednym kliknięciem — link do wypisania znajduje się na dole każdego maila.</p>
        </div>
      </div>

      <div id="previewModal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Podgląd przykładowego wydania Migawki Wydarzeń</h3>
            <button type="button" id="closePreviewBtn" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="border-top: 3px solid #AB6F71; border-bottom: 2px solid #e2e8f0; padding: 10px 0; margin-bottom: 16px;">
              <h4 style="margin: 0; font-size: 18px; color: #0f172a;">Migawka Wydarzeń</h4>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Wydanie z poniedziałku &bull; 07:15 &bull; Wyselekcjonowane przez DeepSeek AI</p>
            </div>
            <h5 style="color: #7f4448; border-bottom: 2px solid #AB6D70; padding-bottom: 4px; margin: 16px 0 8px 0; font-size: 13px;">1. Wydarzenia dla Rodzin z Dziećmi (Kraków i Region)</h5>
            <table class="sample-table">
              <thead><tr><th>Obszar</th><th>Gdzie</th><th>Data / Dzień</th><th>Godzina</th><th>Wydarzenie</th><th>Opis merytoryczny</th><th>Wstęp</th><th>Źródło</th></tr></thead>
              <tbody>
                <tr>
                  <td><strong>Kraków</strong></td><td>Fort Borek</td><td>Niedziela</td><td>11:00</td><td>Warsztaty ceramiczne dla rodzin</td><td>Twórcze lepienie z gliny i modelowanie figurek dla dzieci z rodzicami.</td><td>Bilety</td><td><span class="sample-tag">Link ↗</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <script>
        const form = document.getElementById("subscribeForm");
        const submitBtn = document.getElementById("submitBtn");
        const statusMsg = document.getElementById("statusMsg");
        const openPreviewBtn = document.getElementById("openPreviewBtn");
        const closePreviewBtn = document.getElementById("closePreviewBtn");
        const previewModal = document.getElementById("previewModal");

        openPreviewBtn.addEventListener("click", () => { previewModal.style.display = "flex"; });
        closePreviewBtn.addEventListener("click", () => { previewModal.style.display = "none"; });
        window.addEventListener("click", (e) => { if (e.target === previewModal) previewModal.style.display = "none"; });

        form.addEventListener("submit", function(e) {
          e.preventDefault();
          submitBtn.disabled = true;
          submitBtn.innerText = "Zapisywanie...";
          statusMsg.style.display = "none";

          fetch("${webAppUrl}", {
            method: "POST",
            body: new FormData(form)
          })
          .then(resp => resp.json())
          .then(data => {
            statusMsg.innerText = data.komunikat;
            if (data.sukces) {
              statusMsg.className = "msg-box msg-success";
              form.reset();
            } else {
              statusMsg.className = "msg-box msg-error";
            }
            statusMsg.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.innerText = "Zapisz się bezpłatnie";
          })
          .catch(err => {
            statusMsg.innerText = "Wystąpił błąd komunikacji. Spróbuj ponownie za chwilę.";
            statusMsg.className = "msg-box msg-error";
            statusMsg.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.innerText = "Zapisz się bezpłatnie";
          });
        });
      </script>
    </body>
    </html>
  `;
}

function generujKomunikatKartyHtml(tytul, kolor, tresc) {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>${tytul}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
        .box { background: #ffffff; padding: 40px 32px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.04); }
        h2 { color: ${kolor}; margin-top: 0; font-size: 20px; }
        p { color: #475569; font-size: 14px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>${tytul}</h2>
        <p>${tresc}</p>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

function sortujIGrupujWyniki(dane, indeksGlowny, indeksPodrzedny) {
  if (!dane || dane.length === 0) return;
  dane.sort((a, b) => {
    let elA = String(a[indeksGlowny] || "");
    let elB = String(b[indeksGlowny] || "");
    if (elA !== elB) return elA.localeCompare(elB);
    return String(a[indeksPodrzedny] || "").localeCompare(String(b[indeksPodrzedny] || ""));
  });
}

function zapiszDoArkusza(ss, nazwaZakladki, dane, naglowki) {
  let sheet = ss.getSheetByName(nazwaZakladki) || ss.insertSheet(nazwaZakladki);
  sheet.clear();
  sheet.appendRow(naglowki);
  sheet.getRange(1, 1, 1, naglowki.length).setFontWeight("bold").setBackground("#f1f5f9");
  if (dane && dane.length > 0) {
    let startRow = (dane[0][0] === naglowki[0]) ? 1 : 0;
    for (let i = startRow; i < dane.length; i++) {
      sheet.appendRow(dane[i]);
    }
  }
  sheet.autoResizeColumns(1, naglowki.length);
}

function wyczyscHtmlZZachowaniemLinkow(html, baseUrl) {
  let domain = "";
  try {
    let match = baseUrl.match(/^(https?:\/\/[^\/]+)/);
    if (match) domain = match[1];
  } catch (e) {}

  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
                 .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
                 .replace(/<\/(div|p|li|article|section|tr|h\d)>/gi, "\n");

  text = text.replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, function(match, href, anchorText) {
    let czystyAnchor = anchorText.replace(/<[^>]+>/g, "").trim();
    if (!czystyAnchor || czystyAnchor.length < 3) return "";

    let pelnyUrl = href.trim();
    if (pelnyUrl.startsWith("//")) {
      pelnyUrl = "https:" + pelnyUrl;
    } else if (pelnyUrl.startsWith("/")) {
      pelnyUrl = domain + pelnyUrl;
    } else if (!pelnyUrl.startsWith("http://") && !pelnyUrl.startsWith("https://")) {
      if (pelnyUrl.startsWith("www.")) {
        pelnyUrl = "https://" + pelnyUrl;
      } else {
        pelnyUrl = baseUrl.replace(/\/?$/, "/") + pelnyUrl;
      }
    }

    if (pelnyUrl.includes("javascript:") || pelnyUrl.includes("#")) return czystyAnchor;
    return czystyAnchor + " [Link: " + pelnyUrl + "] ";
  });

  return text.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}

// ============================================================================
// FUNKCJA TESTOWO-DIAGNOSTYCZNA NOWYCH ŚCIEŻEK
// ============================================================================

function TESTUJ_LADOWANIE_PLIKOW() {
  Logger.log("=== TEST ODCZYTU Z NOWEJ ŚCIEŻKI ===");
  Logger.log("Ścieżka bazowa: " + SCIEZKA_BAZOWA);

  let zrodlaLokalne = wczytajJsonPoSciezce(SCIEZKA_BAZOWA, "zrodla_lokalne.json");
  Logger.log("1. zrodla_lokalne.json: " + (zrodlaLokalne ? `✅ OK (${zrodlaLokalne.length} pozycji)` : "❌ BŁĄD"));

  let zrodlaGlobalne = wczytajJsonPoSciezce(SCIEZKA_BAZOWA, "zrodla_globalne.json");
  Logger.log("2. zrodla_globalne.json: " + (zrodlaGlobalne ? `✅ OK (${zrodlaGlobalne.length} pozycji)` : "❌ BŁĄD"));

  let prompt = wczytajPlikPoSciezce(SCIEZKA_BAZOWA, "prompt_migawka_wydarzen.txt");
  Logger.log("3. prompt_migawka_wydarzen.txt: " + (prompt ? `✅ OK (${prompt.length} znaków)` : "❌ BŁĄD"));

  let subskrybenci = wczytajSubskrybentowZPlikuPoSciezce(SCIEZKA_BAZOWA, "emails.txt");
  Logger.log("4. emails.txt: " + (subskrybenci ? `✅ OK (${subskrybenci.length} odbiorców)` : "❌ BŁĄD"));

  let logoUrl = wczytajLogoZDrive();
  Logger.log("5. Logo URL: " + (logoUrl ? "✅ OK (" + logoUrl.substring(0, 45) + "...)" : "❌ Brak lub błąd"));

  let ikony = wczytajIkonyHerbowZDrive();
  Logger.log("6. Ikony herbowe: ✅ Wczytano " + Object.keys(ikony).length + " ikon");
  Logger.log("=== KONIEC TESTU ===");
}

// ============================================================================
// MENU DLA ARKUSZA GOOGLE SHEETS (URUCHAMIANIE Z POZIOMU ARKUSZA)
// ============================================================================

function onOpen() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("📰 Migawka Wydarzeń")
      .addItem("🧪 Wyślij raport testowy (tylko do mnie)", "menuWyslijRaportTestowy")
      .addItem("🚀 Wyślij raport do WSZYSTKICH subskrybentów", "menuWyslijRaportDoWszystkich")
      .addSeparator()
      .addItem("🔍 Testuj ścieżki i pliki", "TESTUJ_LADOWANIE_PLIKOW")
      .addToUi();
  } catch (e) {
    Logger.log("Menu onOpen pominięte (brak kontekstu UI arkusza): " + e.message);
  }
}

function menuWyslijRaportTestowy() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    const odp = ui.alert(
      "Potwierdzenie – Raport Testowy",
      `Czy chcesz wygenerować i wysłać raport testowy WYŁĄCZNIE na Twój adres e-mail (${MOJ_EMAIL_TESTOWY})?`,
      ui.ButtonSet.YES_NO
    );
    if (odp === ui.Button.YES) {
      if (ss) ss.toast("Generowanie raportu testowego... Może to potrwać 1-2 minuty.", "Migawka Wydarzeń", 20);
      generujRaportWiadomosciTest();
      if (ss) ss.toast("Raport testowy został pomyślnie wysłany!", "Sukces", 5);
    }
  } catch (e) {
    Logger.log("Błąd menuRaportTestowy: " + e.message);
  }
}

function menuWyslijRaportDoWszystkich() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    const odp = ui.alert(
      "⚠️ OSTRZEŻENIE – Wysyłka produkcyjna",
      "Czy na pewno chcesz wygenerować i wysłać raport do WSZYSTKICH zapisanych odbiorców newslettera z pliku emails.txt?",
      ui.ButtonSet.YES_NO
    );
    if (odp === ui.Button.YES) {
      if (ss) ss.toast("Generowanie i wysyłka do wszystkich odbiorców w toku...", "Migawka Wydarzeń", 30);
      generujRaportWiadomosciWszyscy();
      if (ss) ss.toast("Raport produkcyjny został pomyślnie wysłany do subskrybentów!", "Sukces", 5);
    }
  } catch (e) {
    Logger.log("Błąd menuRaportDoWszystkich: " + e.message);
  }
}