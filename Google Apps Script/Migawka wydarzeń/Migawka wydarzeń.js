/**
 * MIGAWKA WYDARZEŃ - KOMPLETNY SYSTEM AGREGACJI, FILTRACJI I WYSYŁKI (BEZ PDF)
 * 
 * Moduły:
 * 1. Web Scraping & DeepSeek AI (3 rundy analizy czasowej, filtr antyszumowy, linki bezpośrednie)[cite: 1].
 * 2. Zarządzanie danymi (3 dedykowane tabele w Google Sheets)[cite: 1].
 * 3. Dystrybucja e-mail (sekwencyjna wysyłka wiadomości HTML, linki Unsubscribe, brak załącznika PDF)[cite: 1].
 * 4. Web App (doGet / doPost: formularz zapisu z Captcha, obsługa wypisania z emails.txt)[cite: 1].
 */

// ============================================================================
// 1. GŁÓWNY PROCES PRZYGOTOWANIA I WYSYŁKI RAPORTU
// ============================================================================

function generujRaportWiadomosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Wczytanie konfiguracji źródeł i promptu z Google Drive[cite: 1]
  const SOURCES_LOKALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_lokalne.json") || [];
  const SOURCES_GLOBALNE = wczytajJsonZPlikuWFolderze("Automation", "Migawka Wydarzeń", "zrodla_globalne.json") || [];
  let filtrProfilu = wczytajPlikTekstowyWFolderze("Automation", "Migawka Wydarzeń", "prompt_migawka_wydarzen.txt");
  
  // Wczytanie listy subskrybentów z emails.txt[cite: 1]
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

  let lokalneTrwajace = [];
  let lokalnePrzyszle = [];

  let globalnePrzeszle = [];
  let globalneTrwajace = [];
  let globalnePrzyszle = [];

  // Źródła Lokalne (Kraków i Małopolska)[cite: 1]
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

  // Źródła Globalne (Rynki, Makroekonomia, Świat)[cite: 1]
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

  // Deduplikacja wpisów lokalnych[cite: 1]
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

  // Zapis do dokładnie 3 zakładek w Arkuszu Google[cite: 1]
  zapiszDoArkusza(ss, "1. Lokalne - Trwające i przyszłe (w tym tygdoniu)", tabela1Lokalne, naglowkiLokalne);
  zapiszDoArkusza(ss, "2. Świat - Co się wydarzyło", tabela2GlobalnePrzeszle, naglowkiGlobalne);
  zapiszDoArkusza(ss, "3. Świat - Co się wydarzy", tabela3GlobalnePrzyszle, naglowkiGlobalne);

  // Wysłanie raportu (sekwencyjnie, tabelarycznie w HTML, z linkiem wypisania, bez PDF)[cite: 1]
  wyslijRaportEmailTabelaryczny(tabela1Lokalne, tabela2GlobalnePrzeszle, tabela3GlobalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr, odbiorcyEmail);
}

// ============================================================================
// 2. MODUŁ WEB APP: ZAPIS PRZEZ FORMULARZ Z CAPTCHA ORAZ UNSUBSCRIBE[cite: 1]
// ============================================================================

/**
 * Obsługa żądań HTTP GET (widok formularza rejestracji lub kliknięcie wypisania)[cite: 1]
 */
function doGet(e) {
  let parametry = e ? e.parameter : null;
  let email = parametry ? parametry.email : null;
  let akcja = parametry ? parametry.action : null;

  // 1. Wypisanie z subskrypcji[cite: 1]
  if (akcja === "unsubscribe" && email) {
    let sukces = usunAdresEmailZPliku("Automation", "Migawka Wydarzeń", "emails.txt", email.trim());
    let tytul = sukces ? "Wypisano z subskrypcji" : "Wystąpił błąd";
    let kolor = sukces ? "#059669" : "#dc2626";
    let komunikat = sukces 
      ? `Twój adres <strong>${email}</strong> został pomyślnie usunięty z listy odbiorców raportu.` 
      : `Nie udało się przetworzyć wypisania adresu <strong>${email}</strong> (możliwe, że został już usunięty wcześniej).`;

    let html = generujKomunikatKartyHtml(tytul, kolor, komunikat);
    return HtmlService.createHtmlOutput(html)
      .setTitle(tytul)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 2. Formularz zapisu na newsletter z zabezpieczeniem Captcha
  return HtmlService.createHtmlOutput(generujFormularzZapisuHtml())
    .setTitle("Zapisz się do Migawki Wydarzeń")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Obsługa żądań HTTP POST (odebranie formularza w tle przez fetch i weryfikacja Captcha)
 */
function doPost(e) {
  let postData = e ? e.parameter : null;
  if (!postData) {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: false, 
      komunikat: "Brak danych formularza." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let email = postData.email ? postData.email.trim() : "";
  let captchaToken = postData["cf-turnstile-response"] || postData["g-recaptcha-response"] || "";

  // 1. Sprawdzenie Captcha przez API
  let captchaOk = zweryfikujCaptcha(captchaToken);
  if (!captchaOk) {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: false, 
      komunikat: "Weryfikacja antyspamowa Captcha zakończyła się niepowodzeniem. Spróbuj ponownie." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Walidacja formatu adresu e-mail
  if (!email || !email.includes("@") || !email.includes(".")) {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: false, 
      komunikat: "Wprowadzony adres e-mail jest niepoprawny." 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Dodanie adresu do emails.txt[cite: 1]
  let wynik = dodajAdresEmailDoPliku("Automation", "Migawka Wydarzeń", "emails.txt", email);

  if (wynik.sukces) {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: true, 
      komunikat: `Adres ${email} został pomyślnie dopisany do listy subskrybentów!` 
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (wynik.duplikat) {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: true, 
      komunikat: `Adres ${email} znajduje się już na liście subskrybentów.` 
    })).setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ 
      sukces: false, 
      komunikat: "Wystąpił problem techniczny podczas zapisu pliku na Dysku Google." 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Weryfikuje token Captcha przez Cloudflare Turnstile lub Google reCAPTCHA
 */
function zweryfikujCaptcha(token) {
  const secretKey = PropertiesService.getScriptProperties().getProperty("CAPTCHA_SECRET_KEY");
  
  if (!secretKey || secretKey === "TWÓJ_SECRET_KEY_CAPTCHA") {
    Logger.log("Brak CAPTCHA_SECRET_KEY w Script Properties - akceptacja w trybie testowym.");
    return true;
  }

  if (!token) {
    Logger.log("Odrzucono: brak tokena Captcha.");
    return false;
  }

  const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

  try {
    let payload = {
      secret: secretKey,
      response: token
    };

    let opcje = {
      method: "post",
      payload: payload,
      muteHttpExceptions: true
    };

    let resp = UrlFetchApp.fetch(verifyUrl, opcje);
    let wynikJson = JSON.parse(resp.getContentText());
    return wynikJson.success === true;
  } catch (err) {
    Logger.log("Błąd zapytania weryfikacji Captcha: " + err.message);
    return false;
  }
}

/**
 * Dopisuje adres e-mail do pliku tekstowego na Dysku Google (tworzy plik jeśli nie istnieje)[cite: 1]
 */
function dodajAdresEmailDoPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku, nowyEmail) {
  try {
    let folderyGlowne = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!folderyGlowne.hasNext()) {
      Logger.log("Błąd: Nie znaleziono folderu głównego: " + nazwaGlownegoFolderu);
      return { sukces: false };
    }
    let folderGlowny = folderyGlowne.next();

    let podfoldery = folderGlowny.getFoldersByName(nazwaPodfolderu);
    if (!podfoldery.hasNext()) {
      Logger.log("Błąd: Nie znaleziono podfolderu: " + nazwaPodfolderu);
      return { sukces: false };
    }
    let podfolder = podfoldery.next();

    let pliki = podfolder.getFilesByName(nazwaPliku);
    let plik;

    if (!pliki.hasNext()) {
      Logger.log("Plik " + nazwaPliku + " nie istniał - tworzenie nowego.");
      plik = podfolder.createFile(nazwaPliku, "");
    } else {
      plik = pliki.next();
    }

    let zawartosc = plik.getBlob().getDataAsString();
    let suroweWpisy = zawartosc.split(/[\r\n,;]+/);
    let unikalneAdresy = [];

    let juzIstnieje = false;
    suroweWpisy.forEach(wpis => {
      let adr = wpis.trim();
      if (adr && adr.includes("@")) {
        if (adr.toLowerCase() === nowyEmail.toLowerCase()) {
          juzIstnieje = true;
        }
        unikalneAdresy.push(adr);
      }
    });

    if (juzIstnieje) {
      Logger.log("Adres " + nowyEmail + " już istnieje na liście.");
      return { sukces: false, duplikat: true };
    }

    unikalneAdresy.push(nowyEmail.toLowerCase());
    plik.setContent(unikalneAdresy.join("\n"));
    Logger.log("Pomyślnie zapisano email do pliku: " + nowyEmail);
    return { sukces: true, duplikat: false };
  } catch (err) {
    Logger.log("Błąd zapisu nowego emaila: " + err.message);
    return { sukces: false };
  }
}

/**
 * Usuwa adres e-mail z pliku tekstowego na Dysku Google[cite: 1]
 */
function usunAdresEmailZPliku(nazwaGlownegoFolderu, nazwaPodfolderu, nazwaPliku, emailDoUsuniecia) {
  try {
    let folderyGlowne = DriveApp.getFoldersByName(nazwaGlownegoFolderu);
    if (!folderyGlowne.hasNext()) return false;
    let folderGlowny = folderyGlowne.next();

    let podfoldery = folderGlowny.getFoldersByName(nazwaPodfolderu);
    if (!podfoldery.hasNext()) return false;
    let podfolder = podfoldery.next();

    let pliki = podfolder.getFilesByName(nazwaPliku);
    if (!pliki.hasNext()) return false;
    let plik = pliki.next();

    let zawartosc = plik.getBlob().getDataAsString();
    let suroweWpisy = zawartosc.split(/[\r\n,;]+/);
    
    let nowaLista = [];
    let znaleziono = false;

    suroweWpisy.forEach(wpis => {
      let adr = wpis.trim();
      if (adr && adr.includes("@")) {
        if (adr.toLowerCase() === emailDoUsuniecia.toLowerCase()) {
          znaleziono = true;
        } else {
          nowaLista.push(adr);
        }
      }
    });

    if (znaleziono) {
      plik.setContent(nowaLista.join("\n"));
      Logger.log(`Usunięto adres ${emailDoUsuniecia} z pliku ${nazwaPliku}`);
      return true;
    }
    return false;
  } catch (err) {
    Logger.log(`Błąd podczas usuwania emaila: ${err.message}`);
    return false;
  }
}

/**
 * Zwraca stronę HTML z asynchronicznym formularzem zapisu i widgetem Cloudflare Turnstile
 */
function generujFormularzZapisuHtml() {
  const siteKey = PropertiesService.getScriptProperties().getProperty("CAPTCHA_SITE_KEY") || "";
  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch(e) {}

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>Zapisz się do Migawki Wydarzeń</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          color: #1e293b;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 16px;
          box-sizing: border-box;
        }
        .card {
          background: #ffffff;
          padding: 36px;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
          max-width: 440px;
          width: 100%;
          border: 1px solid #e2e8f0;
        }
        h1 { font-size: 20px; margin-top: 0; margin-bottom: 8px; color: #0f172a; }
        p { font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px; }
        label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; }
        input[type="email"] {
          width: 100%; padding: 12px 14px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none;
        }
        input[type="email"]:focus { border-color: #0284c7; }
        .captcha-wrapper { margin: 20px 0; display: flex; justify-content: center; }
        button {
          width: 100%; background-color: #0284c7; color: white; border: none; padding: 12px; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer;
        }
        button:hover { background-color: #0369a1; }
        button:disabled { background-color: #94a3b8; cursor: not-allowed; }
        .note { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 16px; margin-bottom: 0; }
        #komunikat {
          display: none; padding: 14px; border-radius: 6px; font-size: 13px; line-height: 1.4; margin-top: 16px; text-align: center;
        }
        .sukces { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .blad { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🎯 Migawka Wydarzeń</h1>
        <p>Cotygodniowy raport wydarzeń rodzinnych w Krakowie oraz kluczowych wieści makroekonomicznych.</p>
        
        <form id="formularzZapisu">
          <label for="email">Twój adres e-mail</label>
          <input type="email" id="email" name="email" placeholder="twoj.email@example.com" required>
          
          <div class="captcha-wrapper">
            <div class="cf-turnstile" data-sitekey="${siteKey}"></div>
          </div>
          
          <button type="submit" id="btnSubmit">Zapisz się do newslettera</button>
          <div id="komunikat"></div>
          <p class="note">Możesz wypisać się w dowolnym momencie jednym kliknięciem.</p>
        </form>
      </div>

      <script>
        document.getElementById("formularzZapisu").addEventListener("submit", function(e) {
          e.preventDefault();
          const btn = document.getElementById("btnSubmit");
          const box = document.getElementById("komunikat");
          const emailInput = document.getElementById("email");
          
          btn.disabled = true;
          btn.innerText = "Zapisywanie...";
          box.style.display = "none";

          const formData = new FormData(this);

          fetch("${webAppUrl}", {
            method: "POST",
            body: formData
          })
          .then(resp => resp.json())
          .then(data => {
            box.style.display = "block";
            box.className = data.sukces ? "sukces" : "blad";
            box.innerText = data.komunikat;
            if (data.sukces) {
              emailInput.value = "";
              if (window.turnstile) turnstile.reset();
            }
          })
          .catch(err => {
            box.style.display = "block";
            box.className = "blad";
            box.innerText = "Zapisano adres lub przetworzono żądanie.";
          })
          .finally(() => {
            btn.disabled = false;
            btn.innerText = "Zapisz się do newslettera";
          });
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Szablon ekranów informacyjnych
 */
function generujKomunikatKartyHtml(tytul, kolor, tresc) {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <title>${tytul}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
        }
        .card {
          background: #ffffff;
          padding: 36px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          max-width: 460px;
          width: 100%;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        h2 { color: ${kolor}; margin-top: 0; font-size: 20px; }
        p { color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
        a {
          display: inline-block;
          background: #f1f5f9;
          color: #334155;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>${tytul}</h2>
        <p>${tresc}</p>
        <a href="javascript:window.history.back()">Wróć</a>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// 3. KOMUNIKACJA Z DEEPSEEK AI I WALIDACJA REKORDÓW[cite: 1]
// ============================================================================

/**
 * Wysyła zapytanie do API DeepSeek[cite: 1]
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
 * Automatycznie wyszukuje komórkę z datą bez względu na kolejność kolumn w wierszu[cite: 1]
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
 * Weryfikacja zakresu daty w JavaScript[cite: 1]
 */
function czyDataWMiasteczkuCzasowym(dataStr, typOkna, dzisiaj, przed7Dni, za7Dni) {
  if (!dataStr) return false;
  let str = String(dataStr).trim();

  if (str.toLowerCase().includes("trwa") || str.toLowerCase().includes("dzisiaj") || str.toLowerCase().includes("bieżący")) {
    return (typOkna === "trwajace" || typOkna === "przyszle");
  }

  let match = str.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!match) {
    let matchPL = str.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (matchPL) {
      match = [null, matchPL[3], matchPL[2], matchPL[1]];
    } else {
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
 * Czyści HTML z zachowaniem struktury blokowej oraz linków <a>[cite: 1]
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

// ============================================================================
// 4. GENEROWANIE TABEL I WYSYŁKA EMAIL (BEZ PDF)[cite: 1]
// ============================================================================

/**
 * Buduje zoptymalizowany pod kątem poczty e-mail HTML raportu
 */
function generujCialoRaportuEmailHtml(lokalne, globalnePrzeszle, globalnePrzyszle, naglowkiLokalne, naglowkiGlobalne, dzisiajStr) {
  let html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b;">
      <h2 style="font-size: 18px; color: #0f172a; margin-bottom: 4px;">🎯 Migawka Wydarzeń (${dzisiajStr})</h2>
      <p style="font-size: 12px; color: #64748b; margin-top: 0; margin-bottom: 16px;">
        Wyselekcjonowane wydarzenia rodzinne w Krakowie oraz kluczowe informacje makroekonomiczne.
      </p>

      <h3 style="font-size: 14px; color: #047857; border-bottom: 2px solid #047857; padding-bottom: 4px; margin-bottom: 6px;">
        🎠 1. Lokalne — Trwające i przyszłe (w tym tygodniu)
      </h3>
      ${budujTabeleEmail(lokalne, naglowkiLokalne, "#047857", "#ecfdf5")}

      <h3 style="font-size: 14px; color: #4338ca; border-bottom: 2px solid #4338ca; padding-bottom: 4px; margin-bottom: 6px; margin-top: 24px;">
        📊 2. Świat — Co się wydarzyło (Minione 7 dni)
      </h3>
      ${budujTabeleEmail(globalnePrzeszle, naglowkiGlobalne, "#4338ca", "#e0e7ff")}

      <h3 style="font-size: 14px; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 4px; margin-bottom: 6px; margin-top: 24px;">
        🔮 3. Świat — Co się wydarzy (Trwające procesy & Najbliższe 7 dni)
      </h3>
      ${budujTabeleEmail(globalnePrzyszle, naglowkiGlobalne, "#b45309", "#fef3c7")}
    </div>
  `;
  return html;
}

/**
 * Renderuje tabelę HTML do maila[cite: 1]
 */
function budujTabeleEmail(dane, naglowki, kolorGlowny, kolorWierszaAlt) {
  if (!dane || dane.length === 0) {
    return `<p style="font-size: 11px; color: #94a3b8; font-style: italic; margin-bottom: 16px;">Brak odnotowanych pozycji w tej kategorii.</p>`;
  }

  let html = `<table style="border-collapse: collapse; width: 100%; font-size: 11px; margin-top: 10px; margin-bottom: 16px;">`;
  
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
        tekst = formatujKomorkeZLinkiem(tekst, kolorGlowny);
      }
      
      html += `<td style="border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; line-height: 1.35;">${tekst}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

/**
 * Formatuje link w komórce tabeli[cite: 1]
 */
function formatujKomorkeZLinkiem(tekst, kolor) {
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

    return `<a href="${url}" target="_blank" style="background-color: ${kolor}; color: #ffffff; text-decoration: none; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; display: inline-block;">${etykieta} ↗</a>`;
  }
  return tekst;
}

/**
 * Sekwencyjna wysyłka wiadomości z unikalną stopką Unsubscribe (bez PDF)[cite: 1]
 */
function wyslijRaportEmailTabelaryczny(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr, listaOdbiorcow) {
  let odbiorcy = Array.isArray(listaOdbiorcow) ? listaOdbiorcow : [listaOdbiorcow];
  if (odbiorcy.length === 0) {
    Logger.log("Brak odbiorców do wysyłki.");
    return;
  }

  let temat = "🎯 Migawka Wydarzeń (" + dzisiajStr + ") - Raport Tygodniowy";

  let webAppUrl = "";
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (e) {
    Logger.log("Web App nie został jeszcze wdrożony: " + e.message);
  }

  let cialoRaportuHtml = generujCialoRaportuEmailHtml(lokalne, globalnePrzeszle, globalnePrzyszle, naglowki1, naglowki2, dzisiajStr);

  odbiorcy.forEach((adresat, index) => {
    let emailCzysty = adresat.trim();
    if (!emailCzysty) return;

    let unsubscribeLink = webAppUrl 
      ? `${webAppUrl}?action=unsubscribe&email=${encodeURIComponent(emailCzysty)}` 
      : "#";

    let stopkaHtml = `
      <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 14px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
        Raport wygenerowany przez DeepSeek AI. Wszystkie pozycje zawierają bezpośrednie odnośniki do źródeł.<br>
        Otrzymujesz tę wiadomość, ponieważ Twój adres (${emailCzysty}) znajduje się na liście subskrybentów.<br>
        <a href="${unsubscribeLink}" target="_blank" style="color: #64748b; text-decoration: underline; font-weight: bold; margin-top: 4px; display: inline-block;">
          Wypisz się z subskrypcji
        </a>
      </div>
    `;

    let emailHtml = `
      <div style="max-width: 980px; margin: 0 auto; background-color: #ffffff; padding: 15px;">
        ${cialoRaportuHtml}
        ${stopkaHtml}
      </div>
    `;

    let emailOptions = {
      to: emailCzysty,
      subject: temat,
      htmlBody: emailHtml
    };

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

// ============================================================================
// 5. FUNKCJE POMOCNICZE (DYSK GOOGLE, SPREADSHEET, SORTOWANIE)[cite: 1]
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