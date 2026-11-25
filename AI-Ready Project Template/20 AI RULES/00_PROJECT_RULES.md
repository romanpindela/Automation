# 00_PROJECT_RULES.md — Standardy Jakości, Bezpieczeństwa i Pracy AI

> **Zakres obowiązywania:** Wszystkie sesje i zadania realizowane przez agentów AI w tym projekcie.  
> **Powiązanie:** Plik uzupełnia architekturę katalogów z `AGENTS.md` oraz dane z `PROJECT_CONTEXT.md`. W razie konfliktu reguł stosuj zasadę wyższego rygoru bezpieczeństwa.

---

## 1. Hierarchia źródeł prawdy (Source of Truth)

Gdy różne dokumenty w projekcie zawierają rozbieżne informacje (np. inne daty, wersje procedur, ustalenia), agent stosuje następującą kolejność ważności:

1. **Jawne decyzje użytkownika i zatwierdzone ustalenia** (`25 AI ROBOCZY\DECISIONS.md` oraz bieżące polecenie).
2. **Normy, przepisy i oficjalne wytyczne** (`00 BAZA WIEDZY\`).
3. **Dokumenty już wysłane i zakomunikowane na zewnątrz** (`40 OUTPUT WYSLANE FINAL\`) — stanowią stan formalnie przekazany odbiorcy.
4. **Aktualne dokumenty bazowe** (`01 INPUT AKTUALNE DOKUMENTY\`).
5. **Bieżące wejścia i projekty w trakcie uzgodnień** (`10 INPUT PYTANIA\`, `11 INPUT KORESPONDENCJA\`, `12 INPUT DOKUMENTY SZKIC\`, `13 INPUT KATALOG ROBOCZY\`).
6. **`99 ARCHIWUM\` — WYŁĄCZONE Z ANALIZY.** Plików z archiwum nie wolno cytować ani traktować jako obowiązujących, chyba że użytkownik wyraźnie poprosi o weryfikację historyczną.

**Zasada sprzeczności:** Jeśli wykryjesz rozbieżność między dokumentami (np. inną datę w raporcie i w mailu), **nie wybieraj jednej wersji po cichu** — oznacz ją jawnie tagiem `[WYKRYTA SPRZECZNOŚĆ: <plik A> vs <plik B>]` i wskaż użytkownikowi do rozstrzygnięcia.

---

## 2. Rygor faktograficzny i polityka „Zero Halucynacji”

1. **Zakaz zgadywania:** Nigdy nie wymyślaj ani nie uzupełniaj z pamięci dat, kwot, numerów umów/certyfikatów, nazwisk, stanowisk, artykułów prawnych ani cytatów.
2. **Obowiązkowe tagi kontrolne:** W analizach (`24 AI RAPORTY\`) i szkicach (`3X`) stosuj jednolite znaczniki:
   * `[POTWIERDZONE: <ścieżka pliku>, <sekcja/strona>]` — teza w pełni udokumentowana.
   * `[BRAK DOWODU W DOKUMENTACJI]` — brak potwierdzenia w materiałach `0X`/`1X`.
   * `[DO UZUPEŁNIENIA PRZEZ ZESPÓŁ]` — miejsce wymagające wklejenia danych, podpisu lub załącznika przez człowieka.
   * `[WYKRYTA SPRZECZNOŚĆ: ...]` — niezgodność między dwoma źródłami.
3. **Oddzielanie faktów od interpretacji:** W raportach analitycznych wyraźnie rozdzielaj:
   * **Stan faktyczny** (co wynika wprost z dokumentów),
   * **Ocenę / Ryzyko** (wniosek analityczny AI),
   * **Rekomendację** (konkretne działanie naprawcze wraz ze wskazaniem właściciela wg `PROJECT_CONTEXT.md`).
4. **Zakaz lania wody:** Pisz konkretnie, zwięźle i rzeczowo. Preferuj tabele, listy punktowane i mierzalne wnioski zamiast ogólnych akapitów.

---

## 3. Standardy dokumentów wyjściowych (Strefa `3X`) i poufność

Dokumenty w `30 OUTPUT DOKUMENTY DO AKCEPTACJI\`, `31 OUTPUT ODPOWIEDZI NA PYTANIA\` i `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI\` są przeznaczone do przekazania na zewnątrz po akceptacji człowieka. Obowiązują je podwyższone rygory:

1. **Czystość treści (Zero wycieków wewnętrznych):**
   * Nie umieszczaj w treści przeznaczonej dla odbiorcy wewnętrznych notatek AI, komentarzy o brakach zespołu, dyskusji wewnętrznych ani nazwisk osób trzecich niepowiązanych z odbiorcą.
   * Uwagi dla naszego zespołu (np. streszczenie po polsku dla pisma w języku obcym, lista brakujących załączników) umieszczaj wyłącznie w wyraźnie oddzielonej sekcji na górze pliku Markdown pod nagłówkiem `> [NOTATKA WEWNĘTRZNA — USUNĄĆ PRZED WYSYŁKĄ]`.
2. **Nagłówek kontrolny w szkicach Markdown:** Każdy szkic w `24 AI RAPORTY\` i strefie `3X` musi zawierać blok metadanych:
   * `Data:` `YYYY-MM-DD`
   * `Wersja:` `v1` (kolejne rewizje: `v2`, `v3`...)
3. **Spójność formalna:** Przed zapisaniem dokumentu wyjściowego zweryfikuj zgodność nazw firm, numerów spraw, dat, adresatów i wersji norm z `PROJECT_CONTEXT.md`, `25 AI ROBOCZY\STATE.json` i `DECISIONS.md`.
4. **Formaty końcowe (DOCX / PDF):** Jeśli generujesz dokumenty oficjalne, wykorzystuj w pierwszej kolejności wzory, logo i styl z `00 BAZA WIEDZY\SZABLONY FIRMOWE\`.
5. **Minimalizacja danych wrażliwych (PII / RODO):** Nie kopiuj zbędnych danych osobowych (PESEL, prywatne telefony, adresy zamieszkania, dane medyczne/finansowe) do raportów ani pism, jeśli nie są one wyraźnie wymagane przez cel dokumentu.

---

## 4. Wersjonowanie, nazewnictwo i niezmienność (Immutability)

1. **Format nazw plików generowanych przez AI:**
   `YYYY-MM-DD_<temat>_v<wersja>_<JEZYK>.<rozszerzenie>`  
   *(bez spacji i bez polskich znaków w nazwie pliku, np. `2026-11-25_analiza_umowy_v1_PL.md`)*.
2. **Niezmienność źródeł i plików wysłanych:**
   * Nigdy nie modyfikuj plików w `00`, `01`, `10`, `11`, `12`, `13` (z wyjątkiem `13` wyłącznie na wyraźne polecenie) oraz `40 OUTPUT WYSLANE FINAL`.
   * Jeśli poprawiasz dokument dostarczony przez zespół z `12 INPUT DOKUMENTY SZKIC\`, zawsze zapisz nową wersję w `30 OUTPUT DOKUMENTY DO AKCEPTACJI\`.
3. **Śledzenie zmian przy kolejnych wersjach:** Tworząc `v2`, `v3` istniejącego szkicu w `3X`, nie usuwaj pochopnie kluczowych sekcji bez uzasadnienia — dodaj krótkie podsumowanie zmian (`Changelog`) na górze lub w odpowiedzi dla użytkownika.

---

## 5. Zasady techniczne i automatyzacji

1. **Izolacja artefaktów technicznych:**
   * Wszelkie skrypty pomocnicze (Python, PowerShell) zapisuj wyłącznie w `25 AI ROBOCZY\SCRIPTS\`.
   * Wyekstrahowany tekst z PDF/DOCX/XLSX/MSG zapisuj wyłącznie w `25 AI ROBOCZY\PARSED_MD\`.
2. **Kodowanie i ścieżki:** Zawsze używaj kodowania **UTF-8** (z pełnym zachowaniem polskich znaków w treści plików). W skryptach i poleceniach zawsze ujmuj ścieżki katalogów w cudzysłowy (nazwy folderów zawierają spacje).
3. **Zakaz operacji destrukcyjnych:** Nie usuwaj plików, nie nadpisuj historii i nie wykonuj masowych zmian nazw bez wyraźnego potwierdzenia użytkownika.

---

## 6. Protokół eskalacji — kiedy agent MUSI zapytać zamiast zgadywać

Zatrzymaj się i poproś użytkownika o decyzję przed wygenerowaniem finalnego dokumentu, gdy wystąpi którykolwiek z poniższych przypadków:
* Wykryto istotną sprzeczność między dokumentami źródłowymi.
* Brakuje kluczowych danych merytorycznych, bez których treść pisma/odpowiedzi może wprowadzać odbiorcę w błąd.
* Zadanie wymaga podjęcia decyzji zarządczej, prawnej, finansowej lub zobowiązania terminowego wobec drugiej strony.
* Nie jest jasne, w jakim języku, tonie lub formacie (`.md` / `.docx` / `.pdf`) ma powstać dokument końcowy.

---

## 7. Checklista przed zakończeniem każdego zadania (Definition of Done)

Przed oddaniem odpowiedzi użytkownikowi zweryfikuj wszystkie poniższe punkty:
- [ ] Czy wszystkie kluczowe fakty mają wskazane dokładne źródło w `0X`/`1X`, a braki oznaczono jako `[BRAK DOWODU W DOKUMENTACJI]`?
- [ ] Czy żaden plik w katalogach READ-ONLY (`0X`, `1X`, `40`) nie został zmodyfikowany oraz czy zignorowano `99 ARCHIWUM`?
- [ ] Czy wygenerowane pliki trafiły do właściwych katalogów (`24` raporty, `30–32` szkice do akceptacji, `25` pliki robocze AI) z poprawną konwencją nazewnictwa?
- [ ] Czy dokumenty wyjściowe w strefie `3X` są wolne od wewnętrznych uwag AI?
- [ ] Czy zaktualizowano `25 AI ROBOCZY\STATE.json`, `STATUS.md` oraz (jeśli zapadły ustalenia) `DECISIONS.md`?
- [ ] Czy w podsumowaniu dla użytkownika wskazano jasno, jakie decyzje lub uzupełnienia są po jego stronie?

---

## 8. Reguły specyficzne dla tego projektu *(do uzupełnienia po skopiowaniu szablonu)*

* **Obowiązująca norma / wersja standardu:** `[DO UZUPEŁNIENIA lub ND]`
* **Wymagane formaty plików końcowych:** `[np. zawsze generuj parę .docx + .pdf na bazie szablonu z 00 BAZA WIEDZY\SZABLONY FIRMOWE\]`
* **Sformułowania zakazane / wymagane:** `[DO UZUPEŁNIENIA lub ND]`
* **Dodatkowe ograniczenia branżowe / prawne:** `[DO UZUPEŁNIENIA lub ND]`
