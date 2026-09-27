# Market Data Tracker & Reporter

Skrypt Google Apps Script do automatycznego śledzenia i raportowania wybranych aktywów finansowych. Pobiera aktualne kursy rynkowe z bezpłatnych, publicznych interfejsów API, loguje je w arkuszu Google Sheets i wysyła profesjonalny raport w formacie HTML bezpośrednio na Twój e-mail[cite: 1].

## Główne funkcje
* **Brak konieczności używania kluczy API:** Wykorzystuje wyłącznie publicznie dostępne, nielimitowane endpointy[cite: 1].
* **Automatyczna archiwizacja:** Każde uruchomienie dodaje nowy wiersz z datą i pobranymi cenami do aktywnego arkusza kalkulacyjnego[cite: 1].
* **Estetyczny raport e-mail:** Generuje czytelną, minimalistyczną wiadomość HTML z podziałem na kategorie aktywów[cite: 1].
* **Odporność na błędy:** Wbudowane bloki `try...catch` zapobiegają przerwaniu działania skryptu w przypadku tymczasowej niedostępności jednego ze źródeł (zwraca wartość "Brak danych")[cite: 1].

## Obsługiwane aktywa i źródła danych
* **Coinbase API:** Polkadot (DOT), Bitcoin (BTC), Ethereum (ETH)[cite: 1]
* **Yahoo Finance API:** Akcje (SABR), Waluty (USD/PLN, EUR/PLN), Surowce (Złoto, Srebro, Ropa Brent, Miedź, Kawa, Aluminium)[cite: 1]
* **CoinLore API:** Dominacja BTC, Całkowita kapitalizacja rynku krypto[cite: 1]
* **CNBC API:** Indeksy giełdowe (S&P 500, NASDAQ 100), Rentowność obligacji skarbowych (US 10Y, US 20Y, US 30Y, Niemcy 10Y, Japonia 10Y)[cite: 1]

## Instrukcja instalacji
1. Otwórz swój plik w Google Sheets.
2. W górnym menu wybierz **Rozszerzenia** ➔ **Apps Script**.
3. Usuń domyślny kod i wklej w jego miejsce całą zawartość pliku `Market Raport.js`.
4. Kliknij ikonę dyskietki w górnym menu, aby zapisać projekt.
5. Kliknij przycisk **Uruchom**. Przy pierwszym uruchomieniu Google poprosi Cię o autoryzację. Wybierz swoje konto Google, kliknij *Zaawansowane*, a następnie *Przejdź do projektu (niebezpieczne)*.
    
## Konfiguracja harmonogramu (Automatyzacja)
Aby skrypt uruchamiał się samoczynnie w wybranym interwale (np. co tydzień):
1. W edytorze Apps Script przejdź do zakładki **Wyzwalacze** (ikona zegara w menu po lewej stronie).
2. Kliknij niebieski przycisk **Dodaj wyzwalacz** w prawym dolnym rogu.
3. Skonfiguruj następująco:
   * *Wybierz funkcję, która ma zostać uruchomiona:* `checkMarketData`
   * *Wybierz źródło zdarzenia:* `Sterowane czasem`
   * *Wybierz typ wyzwalacza na podstawie czasu:* `Wyzwalacz tygodniowy`
   * *Wybierz dzień tygodnia:* np. `Poniedziałek`
   * *Wybierz godzinę:* np. `08:00 - 09:00 rano`
4. Kliknij **Zapisz**.

## Struktura arkusza
Skrypt automatycznie przypisuje i dopisuje zebrane zmienne do ostatniego pustego wiersza za pomocą funkcji `appendRow()`. Pamiętaj, aby nie zmieniać kolejności kolumn w Twoim bazowym arkuszu po jego wstępnym skonfigurowaniu, ponieważ skrypt przekazuje dane w stałej, zdefiniowanej sekwencji (od daty, przez krypto, indeksy, aż po obligacje)[cite: 1].