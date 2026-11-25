# SKILL: Analiza luk i zgodności (Gap Analysis)

## Cel
Szczegółowa weryfikacja wskazanego dokumentu z `01 INPUT AKTUALNE DOKUMENTY\` lub `12 INPUT DOKUMENTY SZKIC\` (ew. `30 OUTPUT DOKUMENTY DO AKCEPTACJI\`) pod kątem spełnienia określonych wymagań, norm, zapisów umowy lub checklisty z `00 BAZA WIEDZY\` (lub `10 INPUT PYTANIA\`).

## Dane wejściowe
1. Dokument badany (np. `01 INPUT AKTUALNE DOKUMENTY\<nazwa_pliku>` lub `12 INPUT DOKUMENTY SZKIC\<nazwa_pliku>`).
2. Wskazana sekcja / lista wymagań / norma z `00 BAZA WIEDZY\` lub `10 INPUT PYTANIA\`.

## Instrukcja wykonania krok po kroku

### Krok 1: Ekstrakcja wymagań kontrolnych
Odczytaj źródło wymagań i rozbij je na atomowe kryteria kontrolne: `REQ-01`, `REQ-02`, `REQ-03`...
Zwróć szczególną uwagę na wymagania formalne (terminy, podpisy, wersjonowanie, obowiązkowe załączniki, wskaźniki, odpowiedzialności).

### Krok 2: Weryfikacja dokumentu badanego
Przeanalizuj dokument badany pod kątem każdego kryterium `REQ-XX`. Dla każdego punktu określ:
* **Ocena zgodności:**
  * `ZGODNY (COMPLIANT)` — dokument w pełni realizuje wymóg.
  * `CZĘŚCIOWO ZGODNY (PARTIAL)` — zapis istnieje, ale brakuje elementu formalnego lub merytorycznego.
  * `NIEZGODNY / BRAK (NON-COMPLIANT)` — **`[BRAK DOWODU W DOKUMENTACJI]`**.
* **Dowód z tekstu:** Dokładny cytat lub numer sekcji w badanym dokumencie.
* **Analiza luki:** Konkretne wyjaśnienie, co może zostać zakwestionowane i jakie jest ryzyko.

### Krok 3: Opracowanie rekomendacji naprawczych
Dla każdego punktu oznaczonego jako `CZĘŚCIOWO ZGODNY` lub `NIEZGODNY` przygotuj:
1. Konkretną propozycję zapisu/treści do dopisania lub poprawy w dokumencie.
2. Wskazanie wymaganego dowodu wdrożenia oraz osoby odpowiedzialnej (wg `PROJECT_CONTEXT.md`).
3. Jeśli użytkownik poprosi o wygenerowanie poprawionej wersji dokumentu, zapisz ją w `30 OUTPUT DOKUMENTY DO AKCEPTACJI\` (nigdy nie nadpisuj oryginału w `01` ani `12`).

### Krok 4: Zapis raportu z analizy luk w `24 AI RAPORTY\`
Zapisz raport (`YYYY-MM-DD_analiza_luk_<obszar>_v1_<JEZYK>.md`, w językach wg `PROJECT_CONTEXT.md`):
1. Nagłówek kontrolny (Data, Język, Status: `SZKIC AI — WYMAGA WERYFIKACJI`, Badany plik, Źródło wymagań).
2. Podsumowanie punktowe (Procent spełnienia wymagań, liczba luk krytycznych i formalnych).
3. Matryca zgodności (`ID` | `Wymóg` | `Status` | `Dowód w dokumencie` | `Opis luki`).
4. Gotowe propozycje poprawek i uzupełnień do wdrożenia.

### Krok 5: Aktualizacja stanu
Zaktualizuj `25 AI ROBOCZY\STATE.json` oraz `25 AI ROBOCZY\STATUS.md`, dopisując wykryte luki do listy otwartych zadań.
