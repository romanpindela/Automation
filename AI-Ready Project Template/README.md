# PROJECT AI — Uniwersalny Szablon Struktury Projektu (v2)

Ten folder jest gotowym, uniwersalnym szablonem przestrzeni roboczej (workspace) do prowadzenia projektów wspieranych przez agentów AI (np. audyty, wdrożenia, analizy umów i dokumentacji, przetargi, projekty techniczne i biznesowe).

---

## Jak rozpocząć nowy projekt (Krok po kroku)

1. **Skopiuj cały folder** `AI-Ready Project Template` w docelowe miejsce i zmień jego nazwę na nazwę projektu (np. `2026 PROJEKT NAZWA`).
2. **Uzupełnij plik [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)** — wpisz cel projektu, strony zaangażowane, osoby kontaktowe, kluczowe terminy oraz zasady językowe.
3. **Dodaj materiały bazowe i wejściowe (READ-ONLY dla AI):**
   * Normy, przepisy, wzorce, materiały referencyjne → `00 BAZA WIEDZY\` (a logo / papier firmowy / wzory DOCX → `00 BAZA WIEDZY\SZABLONY FIRMOWE\`)
   * Obowiązujące dokumenty bazowe (umowy, procedury, stan wyjściowy) → `01 INPUT AKTUALNE DOKUMENTY\`
   * Pytania od klienta, listy uwag, formularze z portali → `10 INPUT PYTANIA\`
   * Otrzymane wiadomości e-mail i notatki ze spotkań → `11 INPUT KORESPONDENCJA\`
   * Projekty dokumentów przekazane przez zespół do analizy/recenzji → `12 INPUT DOKUMENTY SZKIC\`
   * Twoje pliki robocze i brudnopisy → `13 INPUT KATALOG ROBOCZY\`
4. *(Opcjonalnie)* Dostosuj reguły projektu w `20 AI RULES\00_PROJECT_RULES.md`.
5. **Uruchom pierwszą sesję AI:** Otwórz nowy folder projektu w narzędziu AI (plik `AGENTS.md` zostanie wykryty automatycznie) i wklej treść z pliku `21 AI PROMPTY\00_PIERWSZY_PROMPT_START_PROJEKTU.md`.

---

## Przegląd 6 stref katalogowych

| Strefa | Katalogi | Przeznaczenie | Uprawnienia AI |
| :--- | :--- | :--- | :--- |
| **0X** | `00`, `01` | Fundamenty: baza wiedzy, szablony firmowe oraz aktualne dokumenty bazowe | **READ-ONLY** |
| **1X** | `10` – `13` | Bieżące materiały wejściowe: pytania, korespondencja, projekty dokumentów, katalog roboczy człowieka | **READ-ONLY** *(dla `13` zapis tylko na wyraźne polecenie)* |
| **2X** | `20` – `25` | Przestrzeń pracy AI: reguły, prompty, skille, workflows, raporty i katalog roboczy AI | **READ / WRITE** *(dla `20` READ-ONLY)* |
| **3X** | `30` – `32` | Szkice wyjściowe AI do akceptacji: dokumenty, odpowiedzi na pytania, korespondencja | **READ / WRITE** |
| **4X** | `40` | Zatwierdzone, finalne dokumenty, odpowiedzi i korespondencja wysłana do odbiorcy | **READ-ONLY (po wysyłce)** |
| **9X** | `99` | Archiwum nieaktualnych wersji i zamkniętych etapów | **IGNORUJ** |

Szczegółowe reguły pracy agenta znajdują się w pliku [`AGENTS.md`](AGENTS.md).
