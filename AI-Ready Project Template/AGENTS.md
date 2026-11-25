# AGENTS.md — Architektura Workspace'u i Reguły Operacyjne AI (v2)

## 1. Mapa katalogów i uprawnienia (Read / Write)

Przestrzeń robocza podzielona jest na 6 stref operacyjnych (`0X` → `1X` → `2X` → `3X` → `40` → `99`). Przestrzegaj bezwzględnie przypisanych uprawnień i używaj dokładnych nazw katalogów ze spacjami:

| Strefa | Katalog | Rola w procesie | Uprawnienia agenta | Opis zawartości |
| :--- | :--- | :--- | :--- | :--- |
| **0X** | `00 BAZA WIEDZY` | Baza wiedzy (Fundament) | **READ-ONLY** | Normy, wytyczne, checklisty, przepisy prawne, wzorce. Podfolder `SZABLONY FIRMOWE\` zawiera logo, papier firmowy i wzory DOCX. **Zakaz modyfikacji.** |
| **0X** | `01 INPUT AKTUALNE DOKUMENTY` | Stan bazowy (Input) | **READ-ONLY** | Obowiązujące dokumenty firmowe, umowy, procedury, raporty zewnętrzne, specyfikacje. **Zakaz modyfikacji.** |
| **1X** | `10 INPUT PYTANIA` | Wejście / Pytania | **READ-ONLY** | Pytania od klienta/audytora, formularze z portali, listy uwag i wymagań do odpowiedzi. **Zakaz modyfikacji.** |
| **1X** | `11 INPUT KORESPONDENCJA` | Wejście / Korespondencja | **READ-ONLY** | Otrzymane wiadomości e-mail, ustalenia, notatki ze spotkań. **Zakaz modyfikacji.** |
| **1X** | `12 INPUT DOKUMENTY SZKIC` | Wejście / Projekty zespołu | **READ-ONLY** | Projekty dokumentów dostarczone przez zespół do weryfikacji/recenzji AI. Poprawione wersje AI zapisuje wyłącznie w `30 OUTPUT DOKUMENTY DO AKCEPTACJI`. |
| **1X** | `13 INPUT KATALOG ROBOCZY` | Brudnopis użytkownika | **READ-ONLY (zapis tylko na polecenie)** | Przestrzeń robocza człowieka (notatki, robocze pliki zespołu). Nie zapisuj tu plików pomocniczych AI (AI ma własny `25 AI ROBOCZY`). |
| **2X** | `20 AI RULES` | Reguły projektu | **READ-ONLY (chyba że polecono)** | Dodatkowe zasady domenowe, ograniczenia, standardy stylu i jakości dla tego projektu. |
| **2X** | `21 AI PROMPTY` | Prompty | **READ / WRITE** | Szablony promptów startowych i wielokrotnego użytku. |
| **2X** | `22 AI SKILLS` | Skille i SOP | **READ / WRITE** | Modułowe instrukcje zadań (`skill_*.md`) określające krok po kroku sposób pracy agenta. |
| **2X** | `23 AI WORKFLOWS` | Procesy (Workflows) | **READ / WRITE** | Powtarzalne wielokrokowe procedury łączące kilka skilli i etapów pracy. |
| **2X** | `24 AI RAPORTY` | Wyniki analityczne | **WRITE (Raporty)** | Wewnętrzne raporty AI, analizy luk, analizy korespondencji, zestawienia (w językach określonych w `PROJECT_CONTEXT.md`). |
| **2X** | `25 AI ROBOCZY` | Strefa robocza AI | **FULL ACCESS (AI)** | Przestrzeń operacyjna agenta: pamięć stanu (`STATE.json`, `STATUS.md`, `DECISIONS.md`), konwersje z PDF/DOCX/XLSX (`PARSED_MD\`), skrypty pomocnicze (`SCRIPTS\`). |
| **3X** | `30 OUTPUT DOKUMENTY DO AKCEPTACJI` | Output / Szkice dokumentów | **READ / WRITE** | Wygenerowane lub poprawione przez AI projekty dokumentów do przeglądu i akceptacji człowieka. |
| **3X** | `31 OUTPUT ODPOWIEDZI NA PYTANIA` | Output / Szkice odpowiedzi | **READ / WRITE** | Projekty odpowiedzi na pytania i uwagi z `10 INPUT PYTANIA` (do akceptacji człowieka). |
| **3X** | `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI` | Output / Szkice maili | **READ / WRITE** | Projekty wiadomości e-mail, pism wychodzących i zapytań (do akceptacji człowieka). |
| **4X** | `40 OUTPUT WYSLANE FINAL` | Output / Wysłane finalne | **READ-ONLY (po wysyłce)** | Zatwierdzone, finalne dokumenty, odpowiedzi i korespondencja faktycznie wysłana/przekazana odbiorcy. **Nie nadpisuj wysłanych plików.** |
| **9X** | `99 ARCHIWUM` | Archiwum | **IGNORUJ** | Nieaktualne wersje dokumentów i zamknięte etapy. **Nie skanuj i nie cytuj tego katalogu**, chyba że użytkownik wprost o to poprosi. |

---

## 2. Bezwzględne reguły operacyjne agenta

1. **Inicjalizacja sesji (State First):** Na początku każdej sesji najpierw odczytaj:
   * `PROJECT_CONTEXT.md`
   * `20 AI RULES\00_PROJECT_RULES.md` (oraz pozostałe pliki w `20 AI RULES\`, jeśli istnieją)
   * `25 AI ROBOCZY\STATE.json`, `25 AI ROBOCZY\STATUS.md` oraz `25 AI ROBOCZY\DECISIONS.md`
   * `00_INDEX_DOKUMENTOW.md` (jeśli istnieje)
   Pozwala to poznać aktualny stan i historię decyzji bez ponownego skanowania całego dysku.
2. **Ochrona stref `0X`, `1X` i `40 OUTPUT WYSLANE FINAL`:** Nigdy nie edytuj, nie przenoś, nie usuwaj ani nie nadpisuj plików źródłowych w `00`, `01`, `10`, `11`, `12`, `13` (chyba że użytkownik wprost poleci zapis w `13`) ani wysłanych dokumentów finalnych w `40 OUTPUT WYSLANE FINAL`.
3. **Ignorowanie `99 ARCHIWUM`:** Nie uwzględniaj plików z `99 ARCHIWUM\` w bieżących analizach i nie cytuj ich jako obowiązujących, chyba że użytkownik wyraźnie poprosi o weryfikację historyczną.
4. **Izolacja plików roboczych AI (`25 AI ROBOCZY`):**
   * Wyciągi tekstowe z PDF/DOCX/XLSX zapisuj wyłącznie w `25 AI ROBOCZY\PARSED_MD\`.
   * Jednorazowe skrypty Python/PowerShell zapisuj wyłącznie w `25 AI ROBOCZY\SCRIPTS\`.
   * Pamięć projektu utrzymuj w `25 AI ROBOCZY\STATE.json`, `STATUS.md` i `DECISIONS.md`.
   * Nie zaśmiecaj katalogu głównego ani `13 INPUT KATALOG ROBOCZY\`.
5. **Rozdzielenie raportów (`24 AI RAPORTY`) od szkiców wyjściowych (`3X`) i plików wysłanych (`40`):**
   * Analizy wewnętrzne, matryce wymagań/luk i analizy korespondencji zapisuj w `24 AI RAPORTY\`.
   * Gotowe projekty dokumentów zapisuj w `30 OUTPUT DOKUMENTY DO AKCEPTACJI\`.
   * Projekty odpowiedzi na pytania zapisuj w `31 OUTPUT ODPOWIEDZI NA PYTANIA\`.
   * Projekty e-maili i korespondencji zapisuj w `32 OUTPUT KORESPONDENCJA DO AKCEPTACJI\`.
   * Dopiero po akceptacji i wysyłce przez użytkownika finalna wersja trafia do `40 OUTPUT WYSLANE FINAL\`.
6. **Konwencja nazewnictwa plików generowanych przez AI:** Używaj spójnego formatu bez spacji i polskich znaków w nazwach plików:
   `YYYY-MM-DD_<temat>_v<wersja>_<JEZYK>.md` (np. `2026-11-25_analiza_wymagan_v1_PL.md`).
7. **Zasady językowe:** Stosuj zasady określone w sekcji *Reguły komunikacji i języka* w pliku `PROJECT_CONTEXT.md`.
8. **Cytuj źródła i zakaz zgadywania:** Każda teza merytoryczna musi wskazywać dokładną ścieżkę pliku źródłowego (np. `[01 INPUT AKTUALNE DOKUMENTY/umowa.pdf]`). Brak potwierdzenia w materiałach oznaczaj zawsze jako **`[BRAK DOWODU W DOKUMENTACJI]`**.
9. **Aktualizacja stanu i decyzji po zadaniu:** Po zakończeniu każdego istotnego zadania zaktualizuj `25 AI ROBOCZY\STATE.json`, `STATUS.md` oraz — jeśli zapadły istotne ustalenia — dopisz wpis w `DECISIONS.md` zgodnie ze skillem `22 AI SKILLS\skill_00_zarzadzanie_stanem.md`.
