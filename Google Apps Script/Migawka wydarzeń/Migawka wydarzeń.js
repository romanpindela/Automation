/**
 * MIGAWKA WYDARZEŃ - KOMPLETNY KOD Z OBSŁUGĄ PREFERENCJI ODBIORCÓW,
 * Logo MW v2.jpg ORAZ NOWYM FORMULARZEM ZAPISU.
 */

function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  // Wczytanie listy subskrybentów wraz z preferencjami: [{ email: "...", subRodziny: true, subSwiat: true }]
  let subskrybenci = wczytajSubskrybentowZPliku("Automation", "Migawka Wydarzeń", "emails.txt");
  if (!subskrybenci || subskrybenci.length === 0) {
    subskrybenci = [{ email: Session.getActiveUser().getEmail(), subRodziny: true, subSwiat: true }];
  }

  if (!filtrProfilu) {
    filtrProfilu = "Domyślny tryb: Ojciec 2 córek (czas wolny/dzieci w Krakowie, Myślenicach i Tarnowie), inwestor śledzący rynki i kluczowe zmiany lokalne, krajowe i globalne. Całkowity zakaz szumu informacyjnego.";
  }

  let dzisiaj = new Date();
  let dzisiajStr = dzisiaj.toISOString().split('T')[0];
  
  let za7Dni = new Date(dzisiaj);
  za7Dni.setDate(dzisiaj.getDate() + 7);
  
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
        tresciStron[url] = tekstZLinkami.length > 25000 ? tekstZLinkami.substring(0, 25000) : tekstZLinkami;
      } else {
        tresciStron[url] = ""; 
      }
    });
  } catch (e) {
    Logger.log("Błąd pobierania stron: " + e.message);
  }

  let sekcja1_Rodziny = [];
  let sekcja2_WydarzyloSie = [];
  let sekcja3_WPlanach = [];

  // 1. ŹRÓDŁA LOKALNE
  SOURCES_LOKALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let rRodzinyTrwajace = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "rodziny_trwajace", filtrProfilu);
      if (rRodzinyTrwajace && Array.isArray(rRodzinyTrwajace)) {
        sekcja1_Rodziny = sekcja1_Rodziny.concat(rRodzinyTrwajace.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }

      let rRodzinyPrzyszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "rodziny_przyszle", filtrProfilu);
      if (rRodzinyPrzyszle && Array.isArray(rRodzinyPrzyszle)) {
        sekcja1_Rodziny = sekcja1_Rodziny.concat(rRodzinyPrzyszle.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }

      let rLokalnePrzeszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_przeszle", filtrProfilu);
      if (rLokalnePrzeszle && Array.isArray(rLokalnePrzeszle)) {
        sekcja2_WydarzyloSie = sekcja2_WydarzyloSie.concat(rLokalnePrzeszle.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }

      let rLokalnePlany = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "lokalne_plany", filtrProfilu);
      if (rLokalnePlany && Array.isArray(rLokalnePlany)) {
        sekcja3_WPlanach = sekcja3_WPlanach.concat(rLokalnePlany.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }
    }
  });

  // 2. ŹRÓDŁA GLOBALNE / KRAJOWE
  SOURCES_GLOBALNE.forEach(source => {
    let tresc = tresciStron[source.url] || "";
    if (tresc.length > 0) {
      let rGlobalnePrzeszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przeszle", filtrProfilu);
      if (rGlobalnePrzeszle && Array.isArray(rGlobalnePrzeszle)) {
        sekcja2_WydarzyloSie = sekcja2_WydarzyloSie.concat(rGlobalnePrzeszle.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }

      let rGlobalnePrzyszle = zapytajDeepSeekDlaTresc(source, tresc, kontekstCzasowy, "globalne_przyszle", filtrProfilu);
      if (rGlobalnePrzyszle && Array.isArray(rGlobalnePrzyszle)) {
        sekcja3_WPlanach = sekcja3_WPlanach.concat(rGlobalnePrzyszle.filter(row => row && !row.join(" ").toUpperCase().includes("ODRZUCONE")));
      }
    }
  });

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

  // Uzupełnienie dnia tygodnia w kolumnie z datą
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
    urlLogo
  );
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
// POBIERANIE LOGO Z DYSKU GOOGLE (Automation/Migawka Wydarzeń/Brand/LOGO.jpg)
// ============================================================================

function wczytajLogoZDrive() {
  try {
    let fGlowny = DriveApp.getFoldersByName("Automation");
    if (!fGlowny.hasNext()) return "";
    let fMigawka = fGlowny.next().getFoldersByName("Migawka Wydarzeń");
    if (!fMigawka.hasNext()) return "";
    let fBrand = fMigawka.next().getFoldersByName("Brand");
    if (!fBrand.hasNext()) return "";
    let folderBrand = fBrand.next();

    // Preferencja dla Logo MW v2.jpg
    let pliki = folderBrand.getFilesByName("Logo MW v2.jpg");
    if (!pliki.hasNext()) {
      pliki = folderBrand.getFilesByName("Logo MW v2.jpg");
    }
    if (pliki.hasNext()) {
      let plik = pliki.next();
      plik.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return "https://drive.google.com/thumbnail?id=" + plik.getId() + "&sz=w500";
    }
  } catch (e) {
    Logger.log("Błąd odczytu Logo MW v2.jpg: " + e.message);
  }
  return "";
}

// ============================================================================
// POBIERANIE LINKÓW DO HERBÓW
// ============================================================================

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
    let fGlowny = DriveApp.getFoldersByName("Automation");
    if (!fGlowny.hasNext()) return urleIkon;
    let fMigawka = fGlowny.next().getFoldersByName("Migawka Wydarzeń");
    if (!fMigawka.hasNext()) return urleIkon;
    let fBrand = fMigawka.next().getFoldersByName("Brand");
    if (!fBrand.hasNext()) return urleIkon;
    let fIkony = fBrand.next().getFoldersByName("ikony_herby_i_symbole");
    if (!fIkony.hasNext()) return urleIkon;
    let fJpg = fIkony.next().getFoldersByName("JPG");
    if (!fJpg.hasNext()) return urleIkon;
    let folderDocelowy = fJpg.next();

    for (let plikKlucz in mapowanieNazw) {
      let nazwaPliku = mapowanieNazw[plikKlucz];
      let pliki = folderDocelowy.getFilesByName(nazwaPliku);
      if (pliki.hasNext()) {
        let plik = pliki.next();
        plik.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        urleIkon[plikKlucz] = "https://drive.google.com/thumbnail?id=" + plik.getId() + "&sz=w160";
      }
    }
  } catch (e) {
    Logger.log("Błąd odczytu ikon JPG: " + e.message);
  }

  return urleIkon;
}

// ============================================================================
// GENEROWANIE STRUKTURY RAPORTU EMAIL DLA KONKRETNEGO ODBIORCY
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
      
      <!-- NAGŁÓWEK GŁÓWNY -->
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
      
      let docelowaLiczbaPrzedLinkiem = oczekiwanaLiczbaKolumn - 1;
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

function wyslijRaportEmailTabelaryczny(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, listaSubskrybentow, mapaUrlIkon, urlLogo) {
  let odbiorcy = Array.isArray(listaSubskrybentow) ? listaSubskrybentow : [listaSubskrybentow];
  if (odbiorcy.length === 0) return;

  let temat = "Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  odbiorcy.forEach((sub, index) => {
    let emailCzysty = (typeof sub === "string" ? sub : sub.email).trim();
    if (!emailCzysty) return;

    let subRodziny = typeof sub.subRodziny !== "undefined" ? sub.subRodziny : true;
    let subSwiat = typeof sub.subSwiat !== "undefined" ? sub.subSwiat : true;

    // Jeżeli subskrybent odznaczył wszystko, nie wysyłamy pustej wiadomości
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
      if (index < odbiorcy.length - 1) Utilities.sleep(500);
    } catch (err) {
      Logger.log(`Błąd wysyłki do ${emailCzysty}: ${err.message}`);
    }
  });
}

// ============================================================================
// KOMUNIKACJA Z DEEPSEEK AI
// ============================================================================

function zapytajDeepSeekDlaTresc(source, trescZrodla, kontekstCzasowy, typRaportu, filtrProfilu) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("Brak klucza DEEPSEEK_API_KEY.");

  const url = "https://api.deepseek.com/chat/completions";
  let instrukcjaZadaniowa = "";
  let strukturaKolumn = "";

  if (typRaportu.startsWith("rodziny")) {
    strukturaKolumn = '["Obszar", "Gdzie", "Data / Dzień", "Godzina", "Tytuł / Wydarzenie", "Streszczenie merytoryczne", "Dla kogo", "Warunki wstępu", "Link"]';
    
    if (typRaportu === "rodziny_trwajace") {
      instrukcjaZadaniowa = "WYSTAWY I ATRAKCJE DLA RODZIN TRWAJĄCE OBECNIE: wyszukaj wystawy, spektakle, place zabaw w Krakowie, Myślenicach i Tarnowie. W kolumnie 'Obszar' wpisz: 'Kraków', 'Myślenice' lub 'Tarnów'. W kolumnie 'Data / Dzień' wpisz: 'Trwa'.";
    } else {
      instrukcjaZadaniowa = "NADCHODZĄCE WYDARZENIA DLA RODZIN NA 7 DNI: spektakle, warsztaty, pikniki w Krakowie, Myślenicach i Tarnowie. W kolumnie 'Obszar' wpisz: 'Kraków', 'Myślenice' lub 'Tarnów'. W kolumnie 'Data / Dzień' podaj datę (np. 2026-10-24 lub 24.10.2026).";
    }
  } else {
    strukturaKolumn = '["Obszar", "Gdzie", "Data / Dzień", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"]';

    if (typRaportu === "lokalne_przeszle") {
      instrukcjaZadaniowa = "CO SIĘ WYDARZYŁO W MINIONYCH 7 DNIACH (LOKALNIE): ważne uchwały, inwestycje, remonty lub wydarzenia. W kolumnie 'Obszar' wpisz: 'Kraków' lub 'Małopolska'.";
    } else if (typRaportu === "lokalne_plany") {
      instrukcjaZadaniowa = "CO JEST W PLANACH (LOKALNIE): zapowiedzi inwestycji, konsultacje, startujące remonty. W kolumnie 'Obszar' wpisz: 'Kraków' lub 'Małopolska'.";
    } else if (typRaportu === "globalne_przeszle") {
      instrukcjaZadaniowa = "CO SIĘ WYDARZYŁO W MINIONYCH 7 DNIACH (KRAJ/ŚWIAT): kluczowe dane rynkowe, banki centralne, geopolityka. W kolumnie 'Obszar' wpisz: 'Polska', 'Unia Europejska' lub 'Świat'.";
    } else if (typRaportu === "globalne_przyszle") {
      instrukcjaZadaniowa = "CO JEST W PLANACH (KRAJ/ŚWIAT): zaplanowane publikacje danych makro (CPI, PKB), posiedzenia stóp, szczyty. W kolumnie 'Obszar' wpisz: 'Polska', 'Unia Europejska' lub 'Świat'.";
    }
  }

  let systemPrompt = 
    "Jesteś precyzyjnym asystentem analitycznym. Wybieraj wyłącznie najważniejsze pozycje (maksymalnie po 6-8 wpisów).\n\n" +
    kontekstCzasowy + "\n\n" +
    filtrProfilu + "\n\n" +
    instrukcjaZadaniowa + "\n\n" +
    "REGUŁY DOTYCZĄCE KOLUMN:\n" +
    "1. 'Obszar': wyłącznie nazwa ogólna (Kraków, Myślenice, Tarnów, Małopolska, Polska, Unia Europejska, Świat).\n" +
    "2. 'Gdzie': dokładne miejsce (np. 'Teatr Groteska', 'Fort Borek'). Jeśli dotyczy całego obszaru lub brak punktu, wpisz '—'.\n" +
    "3. 'Data / Dzień': wpisz datę (np. 2026-10-24 lub 24.10.2026) albo 'Trwa'.\n" +
    "4. Streszczenie merytoryczne: MAKSYMALNIE 1 konkretne zdanie (do 160 znaków)!\n" +
    "5. 'Warunki wstępu': wpisz 'Bezpłatne', 'Bilety' lub 'Rejestracja'.\n" +
    "6. W kolumnie 'Link': podaj bezpośredni adres URL. Jeśli brak, wstaw: '" + source.url + "'.\n\n" +
    "Tekst źródła (" + source.url + "):\n\"\"\"" + trescZrodla + "\"\"\"\n\n" +
    "Zwróć poprawny JSON: {\"dane\": [[...], [...]]}. Układ pól w każdym wierszu musi ściśle odpowiadać tablicy: " + strukturaKolumn + ".";

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Wyodrębnij pozycje w formacie JSON." }
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
    
    let jsonResp = JSON.parse(response.getContentText());
    if (jsonResp.error) {
      Logger.log("API Error: " + JSON.stringify(jsonResp.error));
      return [];
    }

    let content = jsonResp.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
    let rows = bezpiecznyParseJson(content);
    
    return rows.map(row => {
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
      row[lastIdx] = czystyUrl || source.url;
      return row;
    });
  } catch (e) {
    Logger.log("Błąd DeepSeek: " + e.message);
    return [];
  }
}

function bezpiecznyParseJson(surowyTekst) {
  try {
    return JSON.parse(surowyTekst).dane || [];
  } catch (e) {
    try {
      let idxDanych = surowyTekst.indexOf('"dane"');
      if (idxDanych !== -1) {
        let fragment = surowyTekst.substring(idxDanych);
        let ostatniPelnyWiersz = fragment.lastIndexOf("]");
        if (ostatniPelnyWiersz !== -1) {
          let odzyskany = "{" + fragment.substring(0, ostatniPelnyWiersz + 1) + "]}";
          return JSON.parse(odzyskany).dane || [];
        }
      }
    } catch (e2) {}
    return [];
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
    let sukces = usunAdresEmailZPliku("Automation", "Migawka Wydarzeń", "emails.txt", email.trim());
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

  let wynik = dodajAdresEmailDoPliku("Automation", "Migawka Wydarzeń", "emails.txt", email, subRodziny, subSwiat);
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
// WIDOK STRONY ZAPISU (HTML + CSS)
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

        /* MODAL PODGLĄDU RAPORTU */
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
        .modal-header h3 {
          margin: 0;
          font-size: 15px;
          color: #0f172a;
        }
        .modal-close {
          background: transparent;
          border: none;
          font-size: 22px;
          line-height: 1;
          color: #64748b;
          cursor: pointer;
        }
        .modal-close:hover { color: #0f172a; }
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          font-size: 12px;
        }
        .sample-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          margin-bottom: 16px;
          font-size: 11px;
        }
        .sample-table th, .sample-table td {
          border: 1px solid #e2e8f0;
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }
        .sample-table th {
          background: #f8fafc;
          font-weight: 700;
          color: #334155;
        }
        .sample-tag {
          background: #AB6F71;
          color: #fff;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          text-decoration: none;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <div class="header">
          ${logoImgHtml}
          <div class="badge">Inicjatywa Prywatna &bull; Bezpłatny Raport</div>
          <h1>Konkretne informacje zamiast szumu</h1>
          <p class="subtitle">Wszystko, co ważne w Twoim regionie i na świecie — przejrzysty, selekcjonowany raport prosto na skrzynkę e-mail.</p>
          <div class="schedule-badge">
            📅 Wysyłka w każdy poniedziałek między 7:00 a 8:00 rano (czasu polskiego)
          </div>
        </div>

        <div class="intro-box">
          <strong>Jak powstaje ten newsletter?</strong><br>
          Co tydzień silnik sztucznej inteligencji (<strong>DeepSeek</strong>) analizuje wybrane witryny instytucjonalne i branżowe. AI eliminuje clickbait, sensację oraz powierzchowne notki prasowe, wyodrębniając wyłącznie wartościowe inicjatywy rodzinne oraz kluczowe fakty rynkowo-gospodarcze wraz z bezpośrednimi źródłami.
        </div>

        <!-- PRZYCISK PODGLĄDU RAPORTU -->
        <div class="preview-trigger-container">
          <button type="button" id="openPreviewBtn" class="btn-preview">
            👁️ Zobacz przykładowy raport (podgląd)
          </button>
        </div>

        <form id="subscribeForm">
          <div class="options-title">Wybierz zakres subskrypcji:</div>

          <!-- OPCJA 1 -->
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

          <!-- OPCJA 2 -->
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

        <!-- BLOK PROPOZYCJI NOWYCH ŹRÓDEŁ -->
        <div class="feedback-box">
          <strong>Masz propozycję wartościowego źródła?</strong><br>
          Projekt ma charakter otwarty na rozwój bazy wiedzy. Jeżeli znasz interesującą stronę (np. dom kultury, bibliotekę, lokalną instytucję edukacyjną lub artystyczną), napisz do mnie: 
          <a href="${linkZgloszenia}">${kontaktEmail ? kontaktEmail : "skontaktuj się ze mną"}</a>. 
          Wystarczy, że podasz link i w <strong>2 zwięzłych zdaniach</strong> wyjaśnisz, dlaczego warto go uwzględnić w analizie AI.<br>
          <em>Uwaga: Zgodnie z profilem projektu, baza wydarzeń lokalnych dotyczy <strong>wyłącznie regionu Małopolski</strong> — proszę o uszanowanie tego kryterium.</em>
        </div>

        <!-- NOTA PRAWNA I OCHRONA PRYWATNOŚCI -->
        <div class="disclaimer-box">
          <p>
            <strong>Harmonogram wysyłki:</strong> Newsletter przesyłany jest regularnie raz w tygodniu, w każdy poniedziałek w przedziale godzinowym 7:00 – 8:00 rano czasu polskiego.
          </p>
          <p>
            <strong>Charakter projektu:</strong> Newsletter jest całkowicie niekomercyjną inicjatywą prywatną, stworzoną i prowadzoną na własne potrzeby organizacyjne. Raport nie zawiera materiałów sponsorowanych ani treści reklamowych.
          </p>
          <p>
            <strong>Bezpieczeństwo danych:</strong> Przekazane adresy e-mail są bezpiecznie przechowywane i służą wyłącznie do bezpośredniej wysyłki zestawień. Nigdy nie były i nie będą udostępniane jakimkolwiek podmiotom trzecim.
          </p>
          <p>
            <strong>Finansowanie:</strong> Wszystkie opłaty związane z utrzymaniem infrastruktury i działaniem modeli analitycznych pokrywane są w całości z własnych środków prywatnych.
          </p>
          <p>
            <strong>Rezygnacja z subskrypcji:</strong> Szanujemy Twój czas. Możesz wycofać zgodę w dowolnym momencie jednym kliknięciem — link do wypisania znajduje się na samym dole każdego newslettera.
          </p>
        </div>

      </div>

      <!-- OKNO MODALNE Z PRZYKŁADOWYM RAPORTEM -->
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

            <!-- PRZYKŁAD SEKCJI 1 -->
            <h5 style="color: #7f4448; border-bottom: 2px solid #AB6D70; padding-bottom: 4px; margin: 16px 0 8px 0; font-size: 13px;">
              1. Wydarzenia dla Rodzin z Dziećmi (Kraków i Region)
            </h5>
            <table class="sample-table">
              <thead>
                <tr>
                  <th>Obszar</th><th>Gdzie</th><th>Data / Dzień</th><th>Godzina</th><th>Wydarzenie</th><th>Opis merytoryczny</th><th>Wstęp</th><th>Źródło</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Kraków</strong></td>
                  <td>Fort Borek</td>
                  <td>11.10.2026 niedziela</td>
                  <td>11:00</td>
                  <td>Warsztaty ceramiczne dla rodzin</td>
                  <td>Twórcze lepienie z gliny i modelowanie figurek dla dzieci z rodzicami.</td>
                  <td>Bilety</td>
                  <td><span class="sample-tag">Link ↗</span></td>
                </tr>
                <tr>
                  <td><strong>Kraków</strong></td>
                  <td>Centrum Kultury Podgórza</td>
                  <td>Trwa</td>
                  <td>—</td>
                  <td>Interaktywna wystawa zabawek dawnych</td>
                  <td>Ekspozycja edukacyjna prezentująca gry i tradycyjne zabawki z XX wieku.</td>
                  <td>Bezpłatne</td>
                  <td><span class="sample-tag">Link ↗</span></td>
                </tr>
              </tbody>
            </table>

            <!-- PRZYKŁAD SEKCJI 2 I 3 -->
            <h5 style="color: #8e6c31; border-bottom: 2px solid #C39D5C; padding-bottom: 4px; margin: 16px 0 8px 0; font-size: 13px;">
              2. Co się wydarzyło w minionym tygodniu (Polska, Europa, Świat)
            </h5>
            <table class="sample-table">
              <thead>
                <tr>
                  <th>Obszar</th><th>Data / Dzień</th><th>Kategoria</th><th>Temat</th><th>Streszczenie</th><th>Dla kogo</th><th>Źródło</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Polska</strong></td>
                  <td>06.10.2026 wtorek</td>
                  <td>Gospodarka</td>
                  <td>Decyzja RPP ws. stóp</td>
                  <td>Rada Polityki Pieniężnej pozostawiła stopy procentowe bez zmian.</td>
                  <td>Inwestorzy</td>
                  <td><span class="sample-tag" style="background:#C39D5C;">Link ↗</span></td>
                </tr>
              </tbody>
            </table>

            <h5 style="color: #1b3325; border-bottom: 2px solid #264533; padding-bottom: 4px; margin: 16px 0 8px 0; font-size: 13px;">
              3. Co jest w planach? (Kolejny tydzień)
            </h5>
            <table class="sample-table">
              <thead>
                <tr>
                  <th>Obszar</th><th>Data / Dzień</th><th>Kategoria</th><th>Temat</th><th>Streszczenie</th><th>Dla kogo</th><th>Źródło</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Świat</strong></td>
                  <td>15.10.2026 czwartek</td>
                  <td>Rynki USA</td>
                  <td>Odczyt inflacji CPI w USA</td>
                  <td>Kluczowe dane makroekonomiczne wpływające na oczekiwania co do stóp procentowych.</td>
                  <td>Inwestorzy</td>
                  <td><span class="sample-tag" style="background:#264533;">Link ↗</span></td>
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

        // Obsługa modala podglądu
        const openPreviewBtn = document.getElementById("openPreviewBtn");
        const closePreviewBtn = document.getElementById("closePreviewBtn");
        const previewModal = document.getElementById("previewModal");

        openPreviewBtn.addEventListener("click", () => {
          previewModal.style.display = "flex";
        });

        closePreviewBtn.addEventListener("click", () => {
          previewModal.style.display = "none";
        });

        window.addEventListener("click", (e) => {
          if (e.target === previewModal) {
            previewModal.style.display = "none";
          }
        });

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
// OBSŁUGA PLIKU emails.txt Z PREFERENCJAMI ODBIORCÓW
// ============================================================================

/**
 * Format zapisu w emails.txt:
 * email@domena.pl;rodziny,swiat
 * email2@domena.pl;rodziny
 * email3@domena.pl;swiat
 */
function dodajAdresEmailDoPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku, nowyEmail, subRodziny, subSwiat) {
  try {
    let f1 = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!f1.hasNext()) return { sukces: false };
    let f2 = f1.next().getFoldersByName(nazwaPodfolderu);
    if (!f2.hasNext()) return { sukces: false };
    let podfolder = f2.next();
    let pliki = podfolder.getFilesByName(nazwaPliku);
    let plik = pliki.hasNext() ? pliki.next() : podfolder.createFile(nazwaPliku, "");

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

function usunAdresEmailZPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku, emailDoUsuniecia) {
  try {
    let f1 = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!f1.hasNext()) return false;
    let f2 = f1.next().getFoldersByName(nazwaPodfolderu);
    if (!f2.hasNext()) return false;
    let pliki = f2.next().getFilesByName(nazwaPliku);
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

function wczytajSubskrybentowZPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let zawartosc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
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

    // Jeśli w pliku były zapisane same emaile (starszy format), domyślnie wysyłaj oba raporty
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

function wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  try {
    let f1 = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!f1.hasNext()) return null;
    let f2 = f1.next().getFoldersByName(nazwaPodfolderu);
    if (!f2.hasNext()) return null;
    let pliki = f2.next().getFilesByName(nazwaPliku);
    return pliki.hasNext() ? pliki.next().getBlob().getDataAsString() : null;
  } catch (e) {
    return null;
  }
}

function wczytajJsonZPlikuWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let tresc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
  if (!tresc) return null;
  try {
    return JSON.parse(tresc);
  } catch (e) {
    return null;
  }
}
function gdzieJestMojPlikEmails() {
  let f1 = DriveApp.getFoldersByName("Automation");
  if (!f1.hasNext()) {
    Logger.log("BŁĄD: Nie znaleziono folderu Automation!");
    return;
  }
  let folderAutomation = f1.next();
  Logger.log("Folder Automation ID: " + folderAutomation.getId());

  let f2 = folderAutomation.getFoldersByName("Migawka Wydarzeń");
  if (!f2.hasNext()) {
    Logger.log("BŁĄD: Nie znaleziono folderu Migawka Wydarzeń!");
    return;
  }
  let folderMigawka = f2.next();
  Logger.log("Folder Migawka Wydarzeń ID: " + folderMigawka.getId());

  let pliki = folderMigawka.getFilesByName("emails.txt");
  let licznik = 0;
  while (pliki.hasNext()) {
    licznik++;
    let plik = pliki.next();
    Logger.log("--- Znaleziony plik #" + licznik + " ---");
    Logger.log("ID pliku: " + plik.getId());
    Logger.log("Link do otwarcia: " + plik.getUrl());
    Logger.log("Zawartość:\n" + plik.getBlob().getDataAsString());
  }

  if (licznik === 0) {
    Logger.log("W folderze nie ma żadnego pliku emails.txt!");
  }
}