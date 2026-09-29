/**
 * MIGAWKA WYDARZEŃ - WERSJA Z WEKTORAMI SVG Z DYSKU GOOGLE
 * Ścieżka: Automation/Migawka Wydarzeń/Brand/ikony_herby_i_symbole/SVG/
 */

function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  let odbiorcyEmail = wczytajAdresyEmailZPliku("Automation", "Migawka Wydarzeń", "emails.txt");
  if (!odbiorcyEmail || odbiorcyEmail.length === 0) {
    odbiorcyEmail = [Session.getActiveUser().getEmail()];
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

  sortujIGrupujWyniki(sekcja1_Rodziny, 0, 1);
  sortujIGrupujWyniki(sekcja2_WydarzyloSie, 0, 1);
  sortujIGrupujWyniki(sekcja3_WPlanach, 0, 1);

  let naglowkiArkuszRodziny = ["Obszar", "Gdzie", "Data / Dzień", "Godzina", "Tytuł / Wydarzenie", "Streszczenie merytoryczne", "Dla kogo", "Warunki wstępu", "Link"];
  let naglowkiArkuszOgolne = ["Obszar", "Gdzie", "Data", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"];

  zapiszDoArkusza(ss, "1. Wydarzenia dla Rodzin", sekcja1_Rodziny, naglowkiArkuszRodziny);
  zapiszDoArkusza(ss, "2. Co się wydarzyło", sekcja2_WydarzyloSie, naglowkiArkuszOgolne);
  zapiszDoArkusza(ss, "3. Co jest w planach", sekcja3_WPlanach, naglowkiArkuszOgolne);

  // Wczytanie ikon wektorowych SVG z Google Drive jako Data URI (Base64)
  let mapaIkonSvg = wczytajIkonySvgZDrive();

  wyslijRaportEmailTabelaryczny(
    sekcja1_Rodziny, 
    sekcja2_WydarzyloSie, 
    sekcja3_WPlanach, 
    dzisiajStr, 
    odbiorcyEmail, 
    mapaIkonSvg
  );
}

// ============================================================================
// WCZYTYWANIE PLIKÓW SVG Z DYSKU GOOGLE JAKO BASE64 DATA URI
// ============================================================================

function wczytajIkonySvgZDrive() {
  const mapowanieNazw = {
    "01_herb_krakowa.svg": "01_herb_krakowa.svg",
    "02_herb_malopolski.svg": "02_herb_malopolski.svg",
    "03_flaga_polski.svg": "03_flaga_polski.svg",
    "04_herb_myslenic.svg": "04_herb_myslenic.svg",
    "05_herb_tarnowa.svg": "05_herb_tarnowa.svg",
    "06_flaga_ue.svg": "06_flaga_ue.svg",
    "07_oznaczenie_swiata_globus.svg": "07_oznaczenie_swiata_globus.svg"
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
    let fSvg = fIkony.next().getFoldersByName("SVG");
    if (!fSvg.hasNext()) return urleIkon;
    let folderDocelowy = fSvg.next();

    for (let plikKlucz in mapowanieNazw) {
      let nazwaPliku = mapowanieNazw[plikKlucz];
      let pliki = folderDocelowy.getFilesByName(nazwaPliku);
      if (pliki.hasNext()) {
        let plik = pliki.next();
        let svgZawartosc = plik.getBlob().getDataAsString();
        let base64Svg = Utilities.base64Encode(svgZawartosc, Utilities.Charset.UTF_8);
        urleIkon[plikKlucz] = "data:image/svg+xml;base64," + base64Svg;
      }
    }
  } catch (e) {
    Logger.log("Błąd odczytu wektorów SVG: " + e.message);
  }

  return urleIkon;
}

// ============================================================================
// GENEROWANIE STRUKTURY RAPORTU EMAIL HTML (Z WEKTORAMI SVG)
// ============================================================================

function generujCialoRaportuEmailHtml(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, mapaUrlIkon) {
  mapaUrlIkon = mapaUrlIkon || {};

  const resztaKolumnRodziny = ["Data / Dzień", "Godzina", "Tytuł / Wydarzenie", "Streszczenie merytoryczne", "Dla kogo", "Warunki wstępu", "Link"];
  const resztaKolumnOgolne = ["Data", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"];

  // Dokładne nazwy plików SVG z Twojego folderu
  const konfiguracjaRodziny = [
    { nazwaPliku: "01_herb_krakowa.svg", etykieta: "Kraków", filtr: ["kraków", "krakow"] },
    { nazwaPliku: "04_herb_myslenic.svg", etykieta: "Myślenice", filtr: ["myślenic", "myslenic"] },
    { nazwaPliku: "05_herb_tarnowa.svg", etykieta: "Tarnów", filtr: ["tarnów", "tarnow"] }
  ];

  const konfiguracjaOgolna = [
    { nazwaPliku: "01_herb_krakowa.svg", etykieta: "Kraków", filtr: ["kraków", "krakow"] },
    { nazwaPliku: "02_herb_malopolski.svg", etykieta: "Małopolska", filtr: ["małopolsk", "malopolsk"] },
    { nazwaPliku: "03_flaga_polski.svg", etykieta: "Polska", filtr: ["polska", "kraj", "rpp"] },
    { nazwaPliku: "06_flaga_ue.svg", etykieta: "Unia Europejska", filtr: ["unia", "ue", "europejsk", "ebc", "bruksela"] },
    { nazwaPliku: "07_oznaczenie_swiata_globus.svg", etykieta: "Świat", filtr: ["świat", "swiat", "global", "usa", "fed", "rynki", "azja"] }
  ];

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 960px; margin: 0 auto; font-size: 12px; line-height: 1.5;">
      <h2 style="font-size: 20px; color: #0f172a; margin-bottom: 4px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
        🎯 Migawka Wydarzeń (${dzisiajStr})
      </h2>
      <p style="font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 24px;">
        Cotygodniowy raport wydarzeń i informacji.
      </p>

      <!-- 1. WYDARZENIA DLA RODZIN -->
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 16px; color: #065f46; margin: 0 0 14px 0; border-bottom: 2px solid #059669; padding-bottom: 5px;">
          1. Wydarzenia dla Rodzin
        </h3>
        ${budujTabeleZHerbamiWKolumnie(daneRodziny, resztaKolumnRodziny, konfiguracjaRodziny, "#059669", "#f0fdf4", mapaUrlIkon, 8)}
      </div>

      <!-- 2. CO SIĘ WYDARZYŁO (MINIONE 7 DNI) -->
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 16px; color: #1e3a8a; margin: 0 0 14px 0; border-bottom: 2px solid #2563eb; padding-bottom: 5px;">
          2. Co się wydarzyło (Minione 7 dni)
        </h3>
        ${budujTabeleZHerbamiWKolumnie(daneWydarzylo, resztaKolumnOgolne, konfiguracjaOgolna, "#2563eb", "#f8fafc", mapaUrlIkon, 6)}
      </div>

      <!-- 3. CO JEST W PLANACH ? -->
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 16px; color: #9a3412; margin: 0 0 14px 0; border-bottom: 2px solid #d97706; padding-bottom: 5px;">
          3. Co jest w planach ?
        </h3>
        ${budujTabeleZHerbamiWKolumnie(danePlany, resztaKolumnOgolne, konfiguracjaOgolna, "#d97706", "#fffbeb", mapaUrlIkon, 6)}
      </div>
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
    let imgTag = imgUrl ? `<img src="${imgUrl}" alt="" style="height: 18px; width: auto; vertical-align: middle; margin-right: 6px;" />` : "";

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

  let html = `<table style="border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 4px; margin-bottom: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden;">`;
  
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
  if (str.startsWith("www.")) str = "https://" + str;
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

function wyslijRaportEmailTabelaryczny(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, listaOdbiorcow, mapaUrlIkon) {
  let odbiorcy = Array.isArray(listaOdbiorcow) ? listaOdbiorcow : [listaOdbiorcow];
  if (odbiorcy.length === 0) return;

  let temat = "🎯 Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {}

  let cialoRaportuHtml = generujCialoRaportuEmailHtml(daneRodziny, daneWydarzylo, danePlany, dzisiajStr, mapaUrlIkon);

  odbiorcy.forEach((adresat, index) => {
    let emailCzysty = adresat.trim();
    if (!emailCzysty) return;

    let unsubscribeLink = webAppUrl ? `${webAppUrl}?action=unsubscribe&email=${encodeURIComponent(emailCzysty)}` : "#";

    let emailHtml = `
      <div style="max-width: 960px; margin: 0 auto; background-color: #ffffff; padding: 16px;">
        ${cialoRaportuHtml}
        <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
          Raport przygotowany przez DeepSeek AI dla ${emailCzysty}. 
          <a href="${unsubscribeLink}" target="_blank" style="color: #64748b; margin-left: 8px;">Wypisz się z subskrypcji</a>
        </div>
      </div>
    `;

    try {
      MailApp.sendEmail({
        to: emailCzysty,
        subject: temat,
        htmlBody: emailHtml
      });
      Logger.log(`[${index + 1}/${odbiorcy.length}] Wysłano do: ${emailCzysty}`);
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
      instrukcjaZadaniowa = "NADCHODZĄCE WYDARZENIA DLA RODZIN NA 7 DNI: spektakle, warsztaty, pikniki w Krakowie, Myślenicach i Tarnowie. W kolumnie 'Obszar' wpisz: 'Kraków', 'Myślenice' lub 'Tarnów'.";
    }
  } else {
    strukturaKolumn = '["Obszar", "Gdzie", "Data", "Godzina", "Kategoria", "Tytuł / Temat", "Streszczenie merytoryczne", "Dla kogo", "Link"]';

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
    "3. Streszczenie merytoryczne: MAKSYMALNIE 1 konkretne zdanie (do 160 znaków)!\n" +
    "4. 'Warunki wstępu': wpisz 'Bezpłatne', 'Bilety' lub 'Rejestracja'.\n" +
    "5. W kolumnie 'Link': podaj bezpośredni adres URL. Jeśli brak, wstaw: '" + source.url + "'.\n\n" +
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
      ? `Twój adres <strong>${email}</strong> został pomyślnie usunięty z listy odbiorców.` 
      : `Nie udało się usunąć adresu <strong>${email}</strong>.`;

    let html = generujKomunikatKartyHtml(tytul, kolor, komunikat);
    return HtmlService.createHtmlOutput(html)
      .setTitle(tytul)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createHtmlOutput(generujFormularzZapisuHtml())
    .setTitle("Zapisz się do Migawki Wydarzeń")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let postData = e ? e.parameter : null;
  if (!postData) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Brak danych." })).setMimeType(ContentService.MimeType.JSON);
  }

  let email = postData.email ? postData.email.trim() : "";
  let captchaToken = postData["cf-turnstile-response"] || postData["g-recaptcha-response"] || "";

  if (!zweryfikujCaptcha(captchaToken)) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Błąd weryfikacji Captcha." })).setMimeType(ContentService.MimeType.JSON);
  }

  if (!email || !email.includes("@")) {
    return ContentService.createTextOutput(JSON.stringify({ sukces: false, komunikat: "Niepoprawny e-mail." })).setMimeType(ContentService.MimeType.JSON);
  }

  let wynik = dodajAdresEmailDoPliku("Automation", "Migawka Wydarzeń", "emails.txt", email);
  return ContentService.createTextOutput(JSON.stringify({ 
    sukces: wynik.sukces, 
    komunikat: wynik.sukces ? `Adres zapisany!` : (wynik.duplikat ? "Adres już znajduje się na liście." : "Błąd zapisu.") 
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

function generujFormularzZapisuHtml() {
  const siteKey = PropertiesService.getScriptProperties().getProperty("CAPTCHA_SITE_KEY") || "";
  let webAppUrl = "";
  try { webAppUrl = ScriptApp.getService().getUrl(); } catch(e) {}

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>Zapisz się do Migawki Wydarzeń</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
        .card { background: #ffffff; padding: 32px; border-radius: 10px; max-width: 400px; width: 100%; border: 1px solid #e2e8f0; }
        input[type="email"] { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 5px; margin-bottom: 12px; box-sizing: border-box; }
        button { width: 100%; background: #0284c7; color: white; border: none; padding: 10px; font-weight: bold; border-radius: 5px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🎯 Migawka Wydarzeń</h2>
        <form id="f">
          <input type="email" id="email" name="email" placeholder="twoj@email.com" required>
          <div class="cf-turnstile" data-sitekey="${siteKey}"></div>
          <button type="submit" style="margin-top:10px;">Zapisz się</button>
        </form>
      </div>
      <script>
        document.getElementById("f").addEventListener("submit", function(e) {
          e.preventDefault();
          fetch("${webAppUrl}", { method: "POST", body: new FormData(this) })
            .then(r => r.json())
            .then(d => alert(d.komunikat));
        });
      </script>
    </body>
    </html>
  `;
}

function generujKomunikatKartyHtml(tytul, kolor, tresc) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h2 style="color:${kolor}">${tytul}</h2><p>${tresc}</p></body></html>`;
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
    let pelnyUrl = href;
    if (href.startsWith("/")) pelnyUrl = domain + href;
    else if (!href.startsWith("http")) pelnyUrl = baseUrl.replace(/\/?$/, "/") + href;
    if (pelnyUrl.includes("javascript:") || pelnyUrl.includes("#")) return czystyAnchor;
    return czystyAnchor + " [Link: " + pelnyUrl + "] ";
  });

  return text.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}

function dodajAdresEmailDoPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku, nowyEmail) {
  try {
    let f1 = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!f1.hasNext()) return { sukces: false };
    let f2 = f1.next().getFoldersByName(nazwaPodfolderu);
    if (!f2.hasNext()) return { sukces: false };
    let podfolder = f2.next();
    let pliki = podfolder.getFilesByName(nazwaPliku);
    let plik = pliki.hasNext() ? pliki.next() : podfolder.createFile(nazwaPliku, "");

    let suroweWpisy = plik.getBlob().getDataAsString().split(/[\r\n,;]+/);
    let unikalne = [];
    let juzJest = false;

    suroweWpisy.forEach(w => {
      let adr = w.trim();
      if (adr.includes("@")) {
        if (adr.toLowerCase() === nowyEmail.toLowerCase()) juzJest = true;
        unikalne.push(adr);
      }
    });

    if (juzJest) return { sukces: false, duplikat: true };
    unikalne.push(nowyEmail.toLowerCase());
    plik.setContent(unikalne.join("\n"));
    return { sukces: true };
  } catch (err) {
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

    let suroweWpisy = plik.getBlob().getDataAsString().split(/[\r\n,;]+/);
    let nowaLista = suroweWpisy.map(s => s.trim()).filter(adr => adr.includes("@") && adr.toLowerCase() !== emailDoUsuniecia.toLowerCase());
    plik.setContent(nowaLista.join("\n"));
    return true;
  } catch (err) {
    return false;
  }
}

function wczytajAdresyEmailZPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku) {
  let zawartosc = wczytajPlikTekstowyWFolderze(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku);
  if (!zawartosc) return null;
  return [...new Set(zawartosc.split(/[\r\n,;]+/).map(s => s.trim()).filter(s => s.includes("@")))];
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