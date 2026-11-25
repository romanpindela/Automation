# SKILL: Zarządzanie stanem projektu (`STATE.json`, `STATUS.md`, `DECISIONS.md`)

## Cel
Utrzymanie aktualnej pamięci maszynowej (`STATE.json`), czytelnego podsumowania dla człowieka (`STATUS.md`) oraz dziennika decyzji (`DECISIONS.md`) w katalogu `25 AI ROBOCZY\`, aby każda kolejna sesja AI zaczynała się z pełnym kontekstem bez ponownego skanowania wszystkich plików.

## Lokalizacja plików pamięci
* `25 AI ROBOCZY\STATE.json`
* `25 AI ROBOCZY\STATUS.md`
* `25 AI ROBOCZY\DECISIONS.md`

## Instrukcja wykonania krok po kroku

### Krok 1: Odczyt bieżącego stanu
Wczytaj aktualną zawartość `STATE.json`, `STATUS.md` i `DECISIONS.md`.

### Krok 2: Aktualizacja `25 AI ROBOCZY\STATE.json`
Zapisuj dane w czystym formacie JSON (UTF-8), aktualizując:
* `last_updated` (znacznik czasu ISO 8601 `YYYY-MM-DDTHH:MM:SS`)
* `processed_inputs` (lista przeanalizowanych plików ze stref `0X`/`1X` wraz ze ścieżkami raportów w `24 AI RAPORTY\`)
* `open_tasks_and_issues` (lista otwartych zadań/braków ze statusem: `BRAK_DOWODU | W_TRAKCIE | DO_AKCEPTACJI | WYSLANE | ZAMKNIETE`, właścicielem i ścieżką szkicu w strefie `3X`)
* `deliverables_pending_approval` (pliki czekające na akceptację w `30`, `31`, `32`)
* `deliverables_sent_final` (pliki wysłane i zarchiwizowane jako finalne w `40 OUTPUT WYSLANE FINAL\`)
* `next_recommended_actions` (1–3 konkretne kolejne kroki dla agenta lub użytkownika)

### Krok 3: Aktualizacja `25 AI ROBOCZY\STATUS.md`
Zaktualizuj czytelny raport stanu zawierający:
1. Datę ostatniej aktualizacji i status ogólny projektu.
2. Ostatnio wygenerowane raporty (`24 AI RAPORTY\`), szkice do akceptacji (`30`, `31`, `32`) oraz dokumenty wysłane (`40 OUTPUT WYSLANE FINAL\`).
3. Tabelę otwartych zadań / braków / ryzyk z podziałem na właścicieli.
4. Najbliższe terminy (deadlines) i rekomendowane kolejne kroki.

### Krok 4: Aktualizacja `25 AI ROBOCZY\DECISIONS.md` (jeśli zapadły nowe ustalenia)
Jeśli podczas sesji podjęto istotną decyzję merytoryczną, biznesową lub formalną, dopisz nowy wiersz do tabeli w `DECISIONS.md` (`ID` | `Data` | `Decyzja` | `Uzasadnienie / Źródło` | `Kto zatwierdził`).
