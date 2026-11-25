# SKILL: Indeksowanie dokumentów źródłowych (`00_INDEX_DOKUMENTOW.md`)

## Cel
Przeskanowanie wszystkich katalogów źródłowych (`00`, `01`, `10`, `11`, `12`, `13`), opcjonalna ekstrakcja treści plików binarnych do `25 AI ROBOCZY\PARSED_MD\` oraz wygenerowanie w katalogu głównym aktualnego spisu treści: `00_INDEX_DOKUMENTOW.md`.

## Instrukcja wykonania krok po kroku

### Krok 1: Skanowanie drzewa katalogów wejściowych (READ-ONLY)
Przeszukaj rekurencyjnie katalogi:
* `00 BAZA WIEDZY\` (w tym `00 BAZA WIEDZY\SZABLONY FIRMOWE\`)
* `01 INPUT AKTUALNE DOKUMENTY\`
* `10 INPUT PYTANIA\`
* `11 INPUT KORESPONDENCJA\`
* `12 INPUT DOKUMENTY SZKIC\`
* `13 INPUT KATALOG ROBOCZY\`

**Uwaga:** Ignoruj katalog `99 ARCHIWUM\` oraz pliki tymczasowe (`~$*`). **Nie modyfikuj żadnego pliku w strefach `0X` i `1X`.**

### Krok 2: Normalizacja treści do Markdown (w `25 AI ROBOCZY\PARSED_MD\`)
Dla każdego nowego lub zmienionego pliku binarnego (`.pdf`, `.docx`, `.msg`, `.xlsx`, `.pptx`), którego nie ma jeszcze w `25 AI ROBOCZY\PARSED_MD\`:
* Wyodrębnij czystą treść tekstową (z zachowaniem nagłówków i tabel) i zapisz jako `25 AI ROBOCZY\PARSED_MD\<nazwa_oryginalna>.md`.
* Jeśli piszesz pomocniczy skrypt konwertujący (Python/PowerShell), zapisz go wyłącznie w `25 AI ROBOCZY\SCRIPTS\`.
* Na górze skonwertowanego pliku dodaj metadane:
  * `source_path: <oryginalna sciezka>`
  * `parsed_date: YYYY-MM-DD`

### Krok 3: Generowanie pliku `00_INDEX_DOKUMENTOW.md` w katalogu głównym
Utwórz lub nadpisz plik `00_INDEX_DOKUMENTOW.md` według struktury:
1. Nagłówek z datą ostatniej aktualizacji (`YYYY-MM-DD HH:MM`).
2. Tabela dla strefy `0X` (`Katalog` | `Nazwa pliku` | `Data / Rozmiar` | `Wersja tekstowa (AI)` | `Streszczenie / Zakres merytoryczny`).
3. Tabela dla strefy `1X` (`Katalog` | `Nazwa pliku` | `Data / Rozmiar` | `Wersja tekstowa (AI)` | `Streszczenie zawartości (1–2 zdania)`).

### Krok 4: Aktualizacja stanu
Zaktualizuj `25 AI ROBOCZY\STATE.json` oraz `25 AI ROBOCZY\STATUS.md` zgodnie ze skillem `22 AI SKILLS\skill_00_zarzadzanie_stanem.md`.
