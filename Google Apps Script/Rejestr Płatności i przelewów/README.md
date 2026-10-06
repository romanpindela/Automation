# Rejestr Płatności i Przelewów – Integracja Google Sheets z Google Calendar & Gmail AI

Skrypt zawarty w projekcie to kompleksowe narzędzie automatyzujące zarządzanie domowymi i firmowymi płatnościami[cite: 2]. Łączy skrzynkę pocztową Gmail, arkusz kalkulacyjny Google Sheets oraz Kalendarz Google w jeden spójny ekosystem[cite: 2].

---

## Główne moduły systemu

### 1. Inteligentna rejestracja płatności z e-maili (Gmail + Gemini AI + Fallback)
Skrypt przeszukuje oznaczone wiadomości w Gmailu i automatycznie dodaje nowe wiersze do rejestru:
* **Wykrywanie przez etykiety:** Przetwarza wiadomości oznaczone podetykietą `Rejestr Płatności i Przelewów/Rejestr płatności`.
* **Ekstrakcja przez Gemini AI:** Wykorzystuje modele Google Gemini do inteligentnego parsowania nieustrukturyzowanego tekstu (kwoty, kontrahenci, tytuły przelewów, dedykowane numery rachunków, terminy).
* **Obsługa wielu pozycji w jednym mailu:** Bez problemu rozbija wiadomości zbiorcze (np. opłaty za dwoje dzieci w przedszkolu/szkole) na osobne wiersze tabeli.
* **Własne instrukcje:** Umożliwia przekazanie maila dalej do siebie z własną notatką (np. *„termin wydarzenia 10. dzień miesiąca”*), którą AI uwzględnia przy kalkulacji dat.
* **Bezpośredni link do e-maila:** W kolumnie `Uwagi` automatycznie zapisuje klikalny link prowadzący bezpośrednio do źródłowego wątku w Gmailu.
* **Niezawodny fallback:** W przypadku przeciążenia API (błędy 503/429) lub problemów z modelem, skrypt przełącza się na zapasowe reguły heurystyczne/regex, gwarantując ciągłość rejestracji bez pomijania opłat.
* **Brak duplikatów:** Po poprawnym przetworzeniu etykieta wejściowa zostaje zdjęta, a wątek otrzymuje status `Rejestr Płatności i Przelewów/Zarejestrowano w płatnościach`.

### 2. Dwukierunkowa synchronizacja z Kalendarzem Google[cite: 2]
Skrypt zarządza wydarzeniami w kalendarzu na podstawie statusu płatności[cite: 2]:
* **Wpisy „Do zapłaty”:** Tworzy całodniowe wydarzenie w kalendarzu z powiadomieniem o nadchodzącym terminie i zapisuje `ID Wydarzenia Kalendarza` w arkuszu[cite: 2].
* **Wpisy „Zapłacone” / „Anulowane”:** Usuwa skojarzone wydarzenie z kalendarza, zwalniając harmonogram[cite: 2].
* **Identyfikacja kolumn:** Niezależna od wielkości liter czy polskich znaków diakrytycznych[cite: 2].

---

## Wymagana struktura arkusza (Kolumny)

Arkusz musi zawierać w pierwszym wierszu następujące nagłówki[cite: 2]:

* `ID`
* `Data transakcji`
* `Kontrahent`[cite: 2]
* `Tytuł przelewu`[cite: 2]
* `Kwota`[cite: 2]
* `Waluta`[cite: 2]
* `Termin płatności`[cite: 2]
* `Status` (*Do zapłaty, Zapłacone, Zapłacona, Opłacone, Opłacona, Anulowane, Anulowana*)[cite: 2]
* `ID Wydarzenia Kalendarza` (zarządzane automatycznie przez skrypt)[cite: 2]
* `Uwagi` (podsumowanie AI oraz link do e-maila)

---

## Pełna instrukcja uruchomienia

### Krok 1: Przygotowanie etykiet w Gmailu
Utwórz strukturę etykiet (hierarchiczną):
1. Etykieta główna: `Rejestr Płatności i Przelewów`
2. Podetykieta wejściowa: `Rejestr Płatności i Przelewów/Rejestr płatności`
3. Podetykieta archiwalna: `Rejestr Płatności i Przelewów/Zarejestrowano w płatnościach`

*(Opcjonalnie)* Skonfiguruj filtr Gmaila: jeśli mail od zaufanego nadawcy lub przekazany przez Ciebie zawiera w treści `#rejestr`, automatycznie nadaj etykietę `Rejestr Płatności i Przelewów/Rejestr płatności`.

### Krok 2: Konfiguracja Kalendarza Google[cite: 2]
1. Przejdź do **Ustawień** wybranego Kalendarza Google[cite: 2].
2. Z sekcji **Integrowanie kalendarza** skopiuj **Identyfikator kalendarza**[cite: 2].

### Krok 3: Konfiguracja kodu Apps Script
1. Otwórz arkusz Google Sheets z tabelą płatności[cite: 2].
2. Wejdź w **Rozszerzenia** -> **Apps Script**[cite: 2].
3. Wklej kod źródłowy projektu.
4. Uzupełnij parametry konfiguracyjne:
   * `CALENDAR_ID` – identyfikator Twojego kalendarza[cite: 2].
   * `GEMINI_API_KEY` – darmowy klucz pobrany z [Google AI Studio](https://aistudio.google.com/).
5. Zapisz projekt (`Ctrl + S`)[cite: 2].

### Krok 4: Autoryzacja i wyzwalacze czasowe
1. Wybierz funkcję `przetworzOznaczonePlatnosci` i kliknij **Uruchom**. Zaakceptuj uprawnienia do konta Google.
2. Przejdź do zakładki **Wyzwalacze** (ikona zegara po lewej stronie):
   * Dodaj wyzwalacz dla `przetworzOznaczonePlatnosci` (np. co 10–15 minut ze sterowaniem czasowym).
   * Dodaj wyzwalacz dla `syncPaymentsToCalendar` (np. raz na godzinę lub raz dziennie)[cite: 2].

---

## Zrzuty ekranu

### Kalendarz Google - wydarzenie stworzone automatycznie z tabeli gsheet[cite: 2]
![Standard Run](assets/Kalendarz_google.jpg)[cite: 2]

### Tabela w formacie gsheet[cite: 2]
![Standard Run](assets/Tabeta_w_gsheet.jpg)[cite: 2]

Dane_o_przelewach_w_emailu.jpg

### Dane o przelewach w emailu [cite: 2]
![Standard Run](assets/Dane_o_przelewach_w_emailu.jpg)[cite: 2]

### Zarejestrowane płatności z emaila[cite: 2]
![Standard Run](assets/Zarejestrowane_płatności_z_emaila.jpg)[cite: 2]

---

## Autor i Wersja

* **Autor:** Roman Pindela[cite: 2]
* **Email:** [roman.pindela@gmail.com](mailto:roman.pindela@gmail.com)[cite: 2]
* **GitHub:** [@romanpindela](https://github.com/romanpindela)[cite: 2]
* **Wersja:** 1.7.0