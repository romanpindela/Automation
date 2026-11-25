# WORKFLOW 01: Obsługa nowego dokumentu, pytania lub korespondencji wejściowej

## Kiedy uruchomić
Zawsze, gdy użytkownik doda nowe pliki do strefy `0X` (`00 BAZA WIEDZY`, `01 INPUT AKTUALNE DOKUMENTY`) lub strefy `1X` (`10 INPUT PYTANIA`, `11 INPUT KORESPONDENCJA`, `12 INPUT DOKUMENTY SZKIC`, `13 INPUT KATALOG ROBOCZY`).

## Kroki procedury

1. **Odczyt stanu bieżącego:**
   * Przeczytaj `25 AI ROBOCZY\STATE.json`, `STATUS.md` oraz `DECISIONS.md`.
2. **Indeksowanie i ekstrakcja:**
   * Wykonaj `22 AI SKILLS\skill_00_indeksowanie_dokumentow.md` wyłącznie dla nowych lub zmodyfikowanych plików (ignorując `99 ARCHIWUM\`).
   * Zaktualizuj `00_INDEX_DOKUMENTOW.md`.
3. **Analiza merytoryczna:**
   * Jeśli nowy plik pochodzi z `10 INPUT PYTANIA\` lub `11 INPUT KORESPONDENCJA\` → uruchom `22 AI SKILLS\skill_01_analiza_korespondencji.md`.
   * Jeśli nowy plik pochodzi z `01 INPUT AKTUALNE DOKUMENTY\` lub `12 INPUT DOKUMENTY SZKIC\` i wymaga weryfikacji → uruchom `22 AI SKILLS\skill_02_analiza_luk_i_zgodnosci.md`.
4. **Przygotowanie szkicu wyjściowego (Strefa `3X`):**
   * Poprawione lub nowe dokumenty → `30 OUTPUT DOKUMENTY DO AKCEPTACJI\`.
   * Odpowiedzi na pytania → `31 OUTPUT ODPOWIEDZI NA PYTANIA\`.
   * Szkice e-maili i pism → `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI\`.
   * Jeśli wymagany jest format `.docx`/`.pdf`, sprawdź wzory w `00 BAZA WIEDZY\SZABLONY FIRMOWE\`, a pomocnicze skrypty zapisuj w `25 AI ROBOCZY\SCRIPTS\`.
5. **Zamknięcie kroku i zapis pamięci:**
   * Zaktualizuj `25 AI ROBOCZY\STATE.json`, `STATUS.md` oraz (jeśli zapadły ustalenia) `DECISIONS.md`.
   * Przedstaw użytkownikowi zwięzłe podsumowanie i listę decyzji wymagających akceptacji przed przeniesieniem finalnych plików do `40 OUTPUT WYSLANE FINAL\`.
