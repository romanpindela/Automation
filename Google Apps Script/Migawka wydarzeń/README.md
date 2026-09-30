# Migawka Wydarzeń – RSS/Web News & Events Aggregator & LLM Filter

Zautomatyzowany, inteligentny system agregacji, analityki i dystrybucji informacji zrealizowany w środowisku **Google Apps Script**, wspierany przez silnik sztucznej inteligencji **DeepSeek AI API** (`deepseek-chat`).

System cyklicznie monitoruje wskazane serwisy lokalne (Kraków, Myślenice, Tarnów, Małopolska) oraz globalne/krajowe (gospodarka, finanse, geopolityka), usuwa szum informacyjny i clickbait, a wyselekcjonowane wydarzenia porządkuje w arkuszu **Google Sheets** oraz rozsyła w responsywnym formacie HTML na skrzynki e-mail subskrybentów. Rozwiązanie posiada zintegrowaną aplikację internetową (**Google Apps Script Web App**) z formularzem zapisu, wyborem preferencji raportów, obsługą rezygnacji (`unsubscribe`) oraz weryfikacją anty-spamową Cloudflare Turnstile.

---

## 🚀 Główne funkcjonalności

1. **Agregacja i inteligentny Web Scraping:**
   - Wielowątkowe pobieranie zawartości stron za pomocą `UrlFetchApp.fetchAll` z emulacją nowoczesnego User-Agenta.
   - Zaawansowane oczyszczanie kodu HTML ze znaczników skryptów i styli przy jednoczesnym zachowaniu bezpośrednich odnośników URL (konwersja linków relatywnych do absolutnych).
2. **Zaawansowana analityka LLM (DeepSeek AI API):**
   - Bezwzględne ramy kalendarzowe (dzień bieżący, okres minionych 7 dni, mapa 7 dni nadchodzącego tygodnia z dniami tygodnia).
   - Rygorystyczny profil promptu eliminujący clickbait i plotki – preferowane konkretne, merytoryczne inicjatywy i decyzje rynkowo-gospodarcze.
   - Wymuszone formatowanie strukturalne JSON (`{"dane": [[...], [...]]}`) oraz mechanizm `bezpiecznyParseJson` odzyskujący odpowiedzi w przypadku ucięcia strumienia.
3. **Trzy sekcje tematyczne raportu:**
   - **Sekcja 1: Wydarzenia dla Rodzin z Dziećmi (Kraków i Region):** bieżące wystawy stałe oraz zaplanowane spektakle, warsztaty i pikniki na kolejne 7 dni.
   - **Sekcja 2: Co się wydarzyło w minionym tygodniu (Polska, Europa, Świat):** kluczowe dane makroekonomiczne, decyzje banków centralnych (RPP, EBC, FED), podatki i geopolityka.
   - **Sekcja 3: Co jest w planach? (Kolejny tydzień):** publikacje wskaźników makro (CPI, PKB), posiedzenia stóp procentowych, zapowiedzi inwestycji.
4. **Zarządzanie konfiguracją i danymi (Google Drive & Google Sheets):**
   - Źródła ładowane dynamicznie z plików konfiguracyjnych JSON (`zrodla_lokalne.json`, `zrodla_globalne.json`) oraz pliku tekstowego `prompt_migawka_wydarzen.txt`.
   - Nadpisywanie dedykowanych zakładek w arkuszu Google Sheets z formatowaniem nagłówków, stylizacją wierszy oraz automatycznym dopasowaniem szerokości kolumn.
5. **Dystrybucja e-mail i personalizacja:**
   - Obsługa preferencji subskrybentów: każdy odbiorca może otrzymywać tylko wydarzenia rodzinne, tylko przegląd rynkowo-światowy lub pełny pakiet.
   - Dynamiczne pobieranie oficjalnych herbów miast i flag z Dysku Google i wstawianie ich do tabel e-mail.
   - Dedykowany, bezpieczny link do natychmiastowego wypisania się (`unsubscribe`) na dole każdej wiadomości.
6. **Aplikacja Webowa (Web App):**
   - Nowoczesny, estetyczny formularz zapisu w HTML5/CSS3 z interaktywnym podglądem (modalem) przykładowego raportu.
   - Integracja z Cloudflare Turnstile w celu ochrony przed botami.
   - Baza subskrybentów prowadzona i aktualizowana w pliku tekstowym `emails.txt` w strukturze Google Drive.

---

## 🛠️ Architektura plików na Dysku Google

Skrypt wymaga utworzenia dedykowanego drzewa katalogów na Dysku Google:

```text
Dysk Google/
└── Automation/
    └── Migawka Wydarzeń/
        ├── emails.txt                  # Baza subskrybentów (format: email;rodziny,swiat)
        ├── prompt_migawka_wydarzen.txt # Filtr profilu i wytyczne promptu dla DeepSeek
        ├── zrodla_lokalne.json         # Lista serwisów lokalnych (URL, metadane)
        ├── zrodla_globalne.json        # Lista serwisów rynkowych i makroekonomicznych
        └── Brand/
            ├── Logo MW v2.jpg          # Logotyp projektu
            └── ikony_herby_i_symbole/
                └── JPG/                # Herby miast i symbole (01_herb_krakowa.jpg, itp.)
```

---

## ⚙️ Wdrożenie i konfiguracja

### 1. Wymagania wstępne
- Konto Google z dostępem do Google Sheets, Google Drive oraz Google Apps Script.
- Aktywny klucz API **DeepSeek** ze środków platformy ([platform.deepseek.com](https://platform.deepseek.com/)).
- (Opcjonalnie) Klucze witryny **Cloudflare Turnstile** do formularza anty-spamowego.

### 2. Konfiguracja właściwości projektu (Script Properties)
W edytorze Apps Script przejdź do: **Ustawienia projektu** (ikona koła zębatego) > **Właściwości skryptu** i zdefiniuj klucze:

| Właściwość | Wartość |
| :--- | :--- |
| `DEEPSEEK_API_KEY` | Twój klucz API DeepSeek (`sk-...`) |
| `CAPTCHA_SITE_KEY` | *(Opcjonalnie)* Publiczny klucz strony Cloudflare Turnstile |
| `CAPTCHA_SECRET_KEY` | *(Opcjonalnie)* Prywatny klucz weryfikacyjny Cloudflare Turnstile |

### 3. Wdrożenie jako aplikacja internetowa (Web App)
1. W prawym górnym rogu edytora Apps Script kliknij **Wdróż** > **Nowe wdrożenie**.
2. Jako typ wybierz **Aplikacja internetowa**.
3. **Wykonaj jako:** *Ja (twój adres e-mail)*.
4. **Kto ma dostęp:** *Każdy* (Anyone).
5. Skopiowany adres URL wdrożenia obsługuje żądania GET (formularz zapisu i linki rezygnacji) oraz POST (zapis nowego adresu).

### 4. Harmonogram automatyczny (Wyzwalacze)
W menu **Wyzwalacze** (ikona zegara) dodaj trigger czasowy dla funkcji `generujRaportWiadomosci`:
- Źródło: **Sterowane czasem**
- Typ: **Licznik tygodniowy** (np. w każdy poniedziałek między 7:00 a 8:00 rano).

---

## 🖼️ Screenshots

### Publikacja na Google Sites
![Publikacja na Google Sites](assets/Publikacja_na_google_sites.jpg)

### Przegląd projektu – Migawka Wydarzeń
![Migawka Wydarzeń](assets/Migawka_Wydarzen.jpg)

### Witryna internetowa projektu (Google Sites)
![Google Sites Website](assets/Google_sites_website.jpg)

### Formularz zapisu na newsletter
![Zapis na newsletter](assets/Zapis_na_newsletter.jpg)

### Zarządzanie wdrożeniami (Managing Deployments)
![Managing Deployments](assets/Managing%20deployments.jpg)

### Potwierdzenie wypisania z subskrypcji
![Wypisanie z subskrypcji](assets/Wypisanie%20z%20subskrypcji2.jpg)

### Zestawienie w arkuszu Google Sheets
![Migawka Wydarzeń Gsheet](assets/Migawka_Wydarzen_Gsheet.jpg)

### Konfiguracja Script Properties w Google Apps Script
![Apps Script Properties](assets/Apps_Script_Properties.jpg)

### Gotowy raport e-mail w skrzynce Gmail
![Raport Tygodniowy Gmail](assets/Migawka-Wydarzeń-2026-09-30-Raport-Tygodniowy-roman-pindela-gmail-com-Gmail-09-30-2026_11_53_AM.jpg)

---

## 👤 O autorze

- **Autor:** Roman Pindela
- **Kontakt e-mail:** [roman.pindela@gmail.com](mailto:roman.pindela@gmail.com)
- **GitHub:** [roman-pindela](https://github.com/roman-pindela)
- **Version:** 2.2.2
---

## 📄 Licencja

Projekt udostępniany na licencji **MIT**. Kod może być swobodnie wykorzystywany, modyfikowany i wdrażany do celów prywatnych oraz komercyjnych.