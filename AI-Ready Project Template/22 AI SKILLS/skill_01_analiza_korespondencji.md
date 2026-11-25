# SKILL: Analiza korespondencji lub pytań i przygotowanie odpowiedzi

## Cel
Kompleksowa analiza wskazanej wiadomości z `11 INPUT KORESPONDENCJA\` lub zestawu pytań/uwag z `10 INPUT PYTANIA\`, weryfikacja stanu faktycznego w dokumentacji projektu oraz wygenerowanie:
1. Raportu analitycznego w `24 AI RAPORTY\`.
2. Gotowego projektu odpowiedzi w `31 OUTPUT ODPOWIEDZI NA PYTANIA\` (dla pytań/formularzy) lub `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI\` (dla e-maili/pism).

## Dane wejściowe
Wskazany przez użytkownika plik z `10 INPUT PYTANIA\` lub `11 INPUT KORESPONDENCJA\` (bądź jego wersja tekstowa w `25 AI ROBOCZY\PARSED_MD\`).

## Instrukcja wykonania krok po kroku

### Krok 1: Dekompozycja wiadomości wejściowej
Przeczytaj dokładnie treść i wyodrębnij:
* Metadane: Nadawca, Data, Temat, Termin odpowiedzi (uwzględnij ograniczenia z `PROJECT_CONTEXT.md`).
* **Listę wszystkich pytań, żądań i wątpliwości** — ponumeruj je jako `Q-01`, `Q-02`, `Q-03`...
* Powiązane wymagania, punkty umowy lub normy (jeśli są wskazane wprost lub wynikają z kontekstu).

### Krok 2: Weryfikacja w dokumentacji i bazie wiedzy
Dla każdego punktu `Q-XX`:
1. Sprawdź `00_INDEX_DOKUMENTOW.md` i przeszukaj odpowiednie pliki w `25 AI ROBOCZY\PARSED_MD\`, `00 BAZA WIEDZY\`, `01 INPUT AKTUALNE DOKUMENTY\`, `12 INPUT DOKUMENTY SZKIC\` oraz `40 OUTPUT WYSLANE FINAL\` (ignoruj `99 ARCHIWUM\`).
2. Przypisz status dowodowy:
   * **`[POTWIERDZONE W DOKUMENTACJI]`** — podaj dokładną ścieżkę pliku, stronę/sekcję i cytat.
   * **`[CZĘŚCIOWY DOWÓD / WYMAGA UZUPEŁNIENIA]`** — wskaż, co już jest, a czego brakuje.
   * **`[BRAK DOWODU W DOKUMENTACJI]`** — wskaż precyzyjnie, jaki dokument lub decyzję należy pozyskać i od kogo (wg `PROJECT_CONTEXT.md`).

### Krok 3: Generowanie raportu analitycznego w `24 AI RAPORTY\`
Zapisz raport (`YYYY-MM-DD_analiza_korespondencji_<skrot_tematu>_v1_<JEZYK>.md`, w językach wg `PROJECT_CONTEXT.md`):
1. Nagłówek kontrolny (Data, Język, Status: `SZKIC AI — WYMAGA WERYFIKACJI`, Plik źródłowy).
2. Streszczenie wykonawcze (główny cel wiadomości i poziom pilności).
3. Tabelę analizy punkt po punkcie (`ID` | `Pytanie / Wymaganie` | `Status dowodowy` | `Źródło` | `Rekomendowane działanie`).
4. Listę zadań wewnętrznych dla zespołu (co trzeba dosłać/uzupełnić przed wysłaniem odpowiedzi).

### Krok 4: Przygotowanie projektu odpowiedzi (Strefa `3X`)
* Dla zestawów pytań/uwag z portalu → zapisz w `31 OUTPUT ODPOWIEDZI NA PYTANIA\`.
* Dla wiadomości e-mail i korespondencji → zapisz w `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI\`.
* Nazwa pliku: `YYYY-MM-DD_szkic_odpowiedzi_<skrot_tematu>_v1_<JEZYK>.md`.

Struktura pliku odpowiedzi:
1. **Streszczenie po polsku (dla zespołu):** Krótka informacja, co zawiera odpowiedź oraz lista miejsc oznaczonych jako `[DO UZUPEŁNIENIA PRZEZ ZESPÓŁ]`.
2. **Gotowa treść odpowiedzi** (w języku i tonie określonym w `PROJECT_CONTEXT.md`, z odniesieniem do każdego punktu `Q-01..Q-XX` oraz listą załączników).

*Po akceptacji i wysyłce przez użytkownika finalna wersja trafia do `40 OUTPUT WYSLANE FINAL\`.*

### Krok 5: Aktualizacja stanu
Zaktualizuj `25 AI ROBOCZY\STATE.json`, `STATUS.md` oraz (jeśli dotyczy) `DECISIONS.md`.
