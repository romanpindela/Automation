const CALENDAR_ID = 'uu4lpj700dqiluenje72jansro@group.calendar.google.com';

function syncPaymentsToCalendar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  
  if (!calendar) {
    Logger.log('BŁĄD: Nie znaleziono kalendarza o ID: ' + CALENDAR_ID);
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('Brak danych do przetworzenia.');
    return;
  }

  // Odczytujemy indeksy kolumn z nagłówka
  const headers = data[0].map(h => String(h).trim().toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const colKontrahent = headers.indexOf('kontrahent');
  const colTytul = headers.indexOf('tytul przelewu');
  const colKwota = headers.indexOf('kwota');
  const colWaluta = headers.indexOf('waluta');
  const colTermin = headers.indexOf('termin platnosci');
  const colStatus = headers.indexOf('status');
  const colEventId = headers.indexOf('id wydarzenia kalendarza');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const kontrahent = row[colKontrahent];
    const tytul = row[colTytul];
    const kwota = row[colKwota];
    const waluta = row[colWaluta];
    const rawTermin = row[colTermin];
    const rawStatus = String(row[colStatus] || '').trim().toLowerCase();
    let eventId = String(row[colEventId] || '').trim();
    const rowIndex = i + 1;

    if (eventId && !eventId.includes('@google.com')) {
      eventId = '';
    }

    const termin = parsePaymentDate(rawTermin);
    
    // Zamiana 'ł' na 'l' oraz usunięcie pozostałych ogonków
    const status = rawStatus.replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    Logger.log(`Wiersz ${rowIndex}: status="${status}", termin=${Boolean(termin)}, brak_eventId=${!eventId}`);

    // 1. DO ZAPŁATY
    if ((status === 'do zaplaty' || status === 'do zapłaty') && termin && !eventId) {
      const eventTitle = `💰 Płatność: ${kontrahent} (${kwota} ${waluta})`;
      const eventDesc = `Kontrahent: ${kontrahent}\nTytuł: ${tytul}\nKwota: ${kwota} ${waluta}\nTermin: ${termin.toISOString().slice(0, 10)}`;
      
      const event = calendar.createAllDayEvent(eventTitle, termin, { description: eventDesc });
      const newId = event.getId();
      sheet.getRange(rowIndex, colEventId + 1).setValue(newId);
      Logger.log(`SUKCES: Utworzono wydarzenie w kalendarzu, ID: ${newId}`);
    }
    
    // 2. ZAPŁACONE / ANULOWANE
    const isPaidOrCancelled = ['zaplacone', 'zaplacona', 'oplacone', 'oplacona', 'anulowane', 'anulowana'].includes(status);
    if (isPaidOrCancelled && eventId) {
      try {
        const event = calendar.getEventById(eventId);
        if (event) {
          event.deleteEvent();
          Logger.log(`Wiersz ${rowIndex}: Usunięto wydarzenie z kalendarza.`);
        }
      } catch (e) {
        Logger.log(`Błąd usuwania: ${e.message}`);
      }
      sheet.getRange(rowIndex, colEventId + 1).setValue('');
    }
  }
}

function parsePaymentDate(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) return value;
  
  const str = String(value).trim();
  const dmyMatch = str.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})$/);
  if (dmyMatch) {
    return new Date(dmyMatch[3], dmyMatch[2] - 1, dmyMatch[1]);
  }
  
  const parsed = new Date(str);
  return isNaN(parsed) ? null : parsed;
}



// --- REJESTR PŁATNOŚCI Z GMAILA (HYBRYDA: GEMINI + FALLBACK REGEX) ---
// Bezpieczne pobranie klucza z magazynu właściwości projektu:
function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!key) {
    throw new Error("Brak klucza 'GEMINI_API_KEY' w Script Properties! Ustaw go w Ustawieniach projektu.");
  }
  return key;
}
// Nazwy etykiet z hierarchią z Twojego konta:
const LABEL_PARENT = "Rejestr Płatności i Przelewów";
const LABEL_TO_PROCESS_NAME = `${LABEL_PARENT}/Rejestr płatności`;
const LABEL_PROCESSED_NAME = `${LABEL_PARENT}/Zarejestrowano w płatnościach`;

const SHEET_NAME = "Rejestr Płatności i Przelewów";

function przetworzOznaczonePlatnosci() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log("Błąd: Nie znaleziono arkusza o nazwie " + SHEET_NAME);
    return;
  }

  let labelInput = GmailApp.getUserLabelByName(LABEL_TO_PROCESS_NAME);
  if (!labelInput) labelInput = GmailApp.createLabel(LABEL_TO_PROCESS_NAME);
  
  let labelDone = GmailApp.getUserLabelByName(LABEL_PROCESSED_NAME);
  if (!labelDone) labelDone = GmailApp.createLabel(LABEL_PROCESSED_NAME);

  const searchQuery = `label:"${LABEL_TO_PROCESS_NAME}" -label:"${LABEL_PROCESSED_NAME}"`;
  const threads = GmailApp.search(searchQuery, 0, 10);

  if (threads.length === 0) {
    Logger.log("Brak nowych wątków z etykietą: " + LABEL_TO_PROCESS_NAME);
    return;
  }

  Logger.log(`Znaleziono ${threads.length} wątków do przetworzenia.`);

  for (const thread of threads) {
    const threadId = thread.getId();
    const emailLink = `https://mail.google.com/mail/u/0/#all/${threadId}`;
    const messages = thread.getMessages();
    
    let threadContent = "";
    messages.forEach((msg, idx) => {
      let plain = (msg.getPlainBody() || "").trim();
      let html = msg.getBody() || "";
      let htmlStripped = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();

      let bestBody = plain.length >= 30 ? plain : htmlStripped;
      threadContent += `--- WIADOMOŚĆ ${idx + 1} | Od: ${msg.getFrom()} | Temat: ${msg.getSubject()} ---\n${bestBody}\n\n`;
    });

    Logger.log("Pobrana treść wątku:\n" + threadContent);

    let entries = [];
    
    // 1. Próba analizy przez Gemini
    try {
      entries = wyciagnijDaneGemini(threadContent);
    } catch (e) {
      Logger.log("Gemini API niedostępne lub błąd: " + e.toString());
    }

    // 2. Jeśli Gemini nie zwróciło danych (np. 503 lub puste []), uruchamiamy regułę zapasową
    if (!entries || entries.length === 0) {
      Logger.log("Uruchamiam regułę awaryjną (regex/heurystyka) dla e-maila...");
      entries = awaryjnaEkstrakcja(threadContent, thread.getFirstMessageSubject());
    }

    if (entries && entries.length > 0) {
      const lastRow = sheet.getLastRow();
      let currentId = 1;
      if (lastRow > 1) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(v => typeof v === 'number');
        if (ids.length > 0) currentId = Math.max(...ids) + 1;
      }

      entries.forEach(item => {
        const uwagiTekst = item.uwagi ? `${item.uwagi} | E-mail: ${emailLink}` : `E-mail: ${emailLink}`;

        // Kolumny: ID, Data transakcji, Kontrahent, Tytuł przelewu, Kwota, Waluta, Termin płatności, Status, ID Wydarzenia Kalendarza, Uwagi
        sheet.appendRow([
          currentId++,
          item.data_transakcji || "",
          item.kontrahent || "",
          item.tytul_przelewu || "",
          item.kwota || 0,
          item.waluta || "zł",
          item.termin_platnosci || "",
          "Do zapłaty",
          "",
          uwagiTekst
        ]);
      });

      thread.removeLabel(labelInput);
      thread.addLabel(labelDone);
      Logger.log(`SUKCES: Dodano ${entries.length} pozycji do rejestru.`);
    } else {
      Logger.log("Nie udało się odczytać kwot ani przez AI, ani przez reguły awaryjne.");
    }
  }
}

/**
 * Główna ekstrakcja przez Gemini API
 */
function wyciagnijDaneGemini(emailText) {
  const models = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];
  
  const prompt = `Jesteś asystentem finansowym. Wyciągnij WSZYSTKIE opłaty/rachunki z poniższego maila.
Wymogi:
- Jeśli mail dotyczy dwojga dzieci (np. Adrianna i Maja), ZWRÓĆ 2 OSOBNE OBIEKTY.
- "data_transakcji": format "YYYY-MM-DD", jeśli wskazano termin 10. dzień miesiąca, ustaw 10. dzień danego miesiąca płatności.
- "kontrahent": nazwa placówki/odbiorcy + imię osoby/dziecka.
- "tytul_przelewu": tytuł wpłaty oraz indywidualny numer konta bankowego.
- "kwota": liczba (np. 351.36).
- "waluta": "zł".
- "termin_platnosci": oficjalny termin zapłaty ("YYYY-MM-DD").
- "uwagi": dodatkowe informacje.

Treść e-maila:
${emailText}`;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      };

      const res = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() === 200) {
        const data = JSON.parse(res.getContentText());
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
          let txt = data.candidates[0].content.parts[0].text.trim()
            .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
          let parsed = JSON.parse(txt);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].kwota) {
            Logger.log(`Sukces z modelu: ${model}`);
            return parsed;
          }
        }
      }
    } catch (e) {
      Logger.log(`Błąd zapytania do ${model}: ${e.toString()}`);
    }
  }
  return null;
}

/**
 * Mechanizm zapasowy (fallback): działa w 100% lokalnie w Google Apps Script, bez zewnętrznego API,
 * wyciągając dane o płatnościach za dzieci z przedszkola/szkoły/rachunków.
 */
function awaryjnaEkstrakcja(text, subject) {
  const wyniki = [];
  
  // Szukanie terminu płatności w treści
  let terminPlatnosci = "";
  const matchTermin = text.match(/termin\s*p[łl]atno[śs]ci[:\s]*(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})/i);
  let rok = new Date().getFullYear();
  let miesiac = new Date().getMonth() + 1;
  
  if (matchTermin) {
    rok = parseInt(matchTermin[3], 10);
    miesiac = parseInt(matchTermin[2], 10);
    terminPlatnosci = `${rok}-${String(miesiac).padStart(2, '0')}-${String(matchTermin[1]).padStart(2, '0')}`;
  } else {
    terminPlatnosci = `${rok}-${String(miesiac).padStart(2, '0')}-14`;
  }
  
  const dataWydarzenia = `${rok}-${String(miesiac).padStart(2, '0')}-10`;

  // Szukanie wzorców dla Adrianny i Mai
  const dzieci = [
    { imie: "Adrianna", re: /Adriann[ay]?/i },
    { imie: "Maja", re: /Maj[aięe]/i }
  ];

  dzieci.forEach(d => {
    // Szukanie kwoty w pobliżu imienia dziecka (np. 351,36 zł Adrianna lub Adrianna ... 351,36 zł)
    const reKwota = new RegExp(`(?:${d.imie}[^\\d]{0,40}(\\d+[,\\.]\\d{2})|(\\d+[,\\.]\\d{2})\\s*z[łl][^\\n]{0,30}${d.imie})`, 'i');
    const matchKw = text.match(reKwota);
    
    if (matchKw) {
      const kwotaStr = (matchKw[1] || matchKw[2]).replace(',', '.');
      const kwota = parseFloat(kwotaStr);

      // Szukanie konta bankowego (26 cyfr) w pobliżu
      let konto = "";
      const matchKonto = text.match(/(\d{2}(?:\s*\d{4}){6})/);
      if (matchKonto) {
        konto = matchKonto[1].replace(/\s+/g, ' ');
      }

      wyniki.push({
        data_transakcji: dataWydarzenia,
        kontrahent: `Samorządowe Przedszkole nr 140 (${d.imie})`,
        tytul_przelewu: `Opłata przedszkole - ${d.imie}${konto ? '\nKonto: ' + konto : ''}`,
        kwota: kwota,
        waluta: "zł",
        termin_platnosci: terminPlatnosci,
        uwagi: `Przetworzono automatycznie (${subject || 'Płatność'})`
      });
    }
  });

  return wyniki;
}

function testDostepnychModeli() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log("Status: " + response.getResponseCode());
  
  if (response.getResponseCode() === 200) {
    const data = JSON.parse(response.getContentText());
    const models = data.models
      ? data.models.map(m => m.name.replace("models/", ""))
      : [];
    Logger.log("Dostępne modele dla Twojego klucza:");
    models.forEach(m => Logger.log(" -> " + m));
  } else {
    Logger.log("Błąd odpowiedzi: " + response.getContentText());
  }
}