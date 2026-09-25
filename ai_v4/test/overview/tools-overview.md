# Narzędzia dokumentacji: opis dla prezentacji

Ten plik opisuje standard, skrypty i aplikacje przygotowane w pracy nad
dokumentacją projektową. Jest materiałem wejściowym do prezentacji dla
zespołów: co każde narzędzie robi, jak go używać, co daje i czego nie robi.

Stan na 15 września 2026 r. Wszystkie przykłady i liczby pochodzą z korpusu
przykładowej dokumentacji w folderze `standards/examples` (119 dokumentów,
3 procesy: BFS-001, BFS-002, BFS-003).

## Spis

1. [Idea w jednym zdaniu](#1-idea-w-jednym-zdaniu)
2. [Mapa narzędzi](#2-mapa-narzędzi)
3. [Standard: dokumentacja jako graf](#3-standard-dokumentacja-jako-graf)
4. [Szablony dokumentów](#4-szablony-dokumentów)
5. [sync-relations.js: relacje z treści](#5-sync-relationsjs-relacje-z-treści)
6. [Walidatory](#6-walidatory)
7. [knowledge-index: indeks, wiersz poleceń i serwer MCP](#7-knowledge-index-indeks-wiersz-poleceń-i-serwer-mcp)
8. [Warsztat dokumentacji (docs-workbench)](#8-warsztat-dokumentacji-docs-workbench)
9. [migrate-relations.js: przejście ze starego formatu](#9-migrate-relationsjs-przejście-ze-starego-formatu)
10. [Skill plain-language-docs](#10-skill-plain-language-docs)
11. [Jak narzędzia działają razem: scenariusze pracy](#11-jak-narzędzia-działają-razem-scenariusze-pracy)
12. [Co zyskuje każda rola](#12-co-zyskuje-każda-rola)
13. [Liczby do slajdów](#13-liczby-do-slajdów)
14. [Czego narzędzia nie robią](#14-czego-narzędzia-nie-robią)
15. [Stan prac i otwarte tematy](#15-stan-prac-i-otwarte-tematy)
16. [Propozycje prezentacji](#16-propozycje-prezentacji)
17. [Słownik](#17-słownik)

---

## 1. Idea w jednym zdaniu

Dokumentacja jest siecią powiązanych dokumentów, a powiązania są zapisane
w pliku w sposób, który rozumie program. Dzięki temu program odpowiada na
pytania, które dziś wymagają ręcznego przeszukiwania folderów:

- Które pliki muszę przejrzeć, gdy zmieniam to wymaganie?
- Co muszę przeczytać, zanim zbuduję ten scenariusz?
- Czy dokumentacja jest spójna i kompletna?

## 2. Mapa narzędzi

| Warstwa | Element | Co robi | Kto używa |
|---|---|---|---|
| Standard | `standards/methodology.md` | Zasady grafu: relacje, identyfikatory, układ folderów, kolejność zmian. | wszyscy |
| Standard | `standards/config/relation-matrix.yaml` | Lista dozwolonych powiązań między typami dokumentów. | walidatory, indeks, analitycy |
| Standard | `standards/config/query-patterns.yaml` | Trasy zapytań `change_scope` i `implementation`. | indeks, aplikacja |
| Standard | `standards/templates/` | Szablon i instrukcja dla każdego z 21 typów dokumentów. | analitycy |
| Standard | `standards/examples/` | Korpus przykładowy: 119 dokumentów w 3 procesach. | wszyscy, testy narzędzi |
| Skrypt | `scripts/sync-relations.js` | Wylicza pole `relations` z identyfikatorów w treści i poprawia je. | analitycy |
| Skrypt | `scripts/validate-relations.js` | Sprawdza graf: cele, liczebność, unikalność, połączenie, numery. | analitycy, CI |
| Skrypt | `scripts/validate-form.js` | Sprawdza zgodność z szablonem: pola, sekcje, tabele, nazwa i folder pliku. | analitycy, CI |
| Skrypt | `scripts/validate-consistency.js` | Sprawdza, czy ta sama informacja w dwóch miejscach się zgadza. | analitycy, CI |
| Skrypt | `scripts/knowledge-index/` | Indeks w SQLite, wiersz poleceń i serwer MCP dla agentów AI. | developerzy, analitycy, agenci AI |
| Skrypt | `scripts/migrate-relations.js` | Jednorazowe przepisanie dokumentów ze starego formatu. | zespół dokumentacji, raz |
| Aplikacja | `tools/docs-workbench/` | Lokalna aplikacja webowa: mapa, katalog, zasięg zmiany, przepływ danych, walidacja. | analitycy, architekci, liderzy, developerzy |
| Skill AI | `.github/skills/plain-language-docs/` | Przepisuje opisy w dokumentacji i narzędziach na prosty język. | każdy, kto pisze opisy z agentem AI |

Wspólne cechy skryptów:

- Działają na Node.js bez instalowania pakietów (indeks wymaga Node.js 22.5 lub nowszego).
- Czytają matrycę, wzorce i szablony przy każdym uruchomieniu, więc zmiana standardu nie wymaga zmiany kodu.
- Walidatory i raporty mają wspólny format i opcję `--json`.
- Pełny opis poleceń, komunikatów i kodów wyjścia jest w `scripts/README.md`.

---

## 3. Standard: dokumentacja jako graf

### Problem

Powiązania między dokumentami żyły w treści i w polach typu
`source-spec-ids` czy `related-doc-ids`. Nie było reguły, kto zapisuje
powiązanie, jakiego jest rodzaju i czy obie strony się zgadzają. Żeby
znaleźć skutki zmiany, trzeba było czytać foldery.

### Rozwiązanie

- **Węzeł** to dokument (`UC-001`) albo wiersz dokumentu z własnym identyfikatorem (`BFS-001.REQ-01`).
- **Krawędź** to wpis w polu `relations` w front matter dokumentu.
- **Relację zapisuje tylko źródło.** `UC-001` ma wpis `realizes BFS-001.REQ-01`, a `BFS-001` nie ma wpisu w drugą stronę. Listę „kto mnie wskazuje” wylicza program.
- **Rodzaju relacji się nie wybiera.** Dla każdej pary typów matryca podaje dokładnie jeden rodzaj, na przykład `UC` → `CAP` to zawsze `realizes`.
- **Relacja wynika z treści.** Jeśli dokument wspomina identyfikator innego dokumentu, musi mieć do niego wpis. Wpis dopisuje skrypt.

Fragment front matter scenariusza `UC-001`:

```yaml
doc-id: UC-001
title: Złożenie dyspozycji
status: draft
relations:
  - type: realizes
    target: BFS-001.REQ-01
  - type: realizes
    target: CAP-001
  - type: involves
    target: ACTOR-001.ROLE-01
  - type: consumes
    target: API-001
  - type: contains
    target: A1
```

### Liczby standardu

| Element | Liczba |
|---|---:|
| Typy dokumentów | 22 |
| Typy wierszy (REQ, RB, DOM, RD, RW, NFRT, ROLE, AC, A, E) | 10 |
| Rodzaje relacji (`contains`, `realizes`, `constrained_by`, `applies`, `consumes`, `involves`, `groups`) | 7 |
| Dozwolone trójki w matrycy | 72 |

### Grupy typów dokumentów

| Grupa | Typy |
|---|---|
| Wymagania | BFS, NFR |
| Odpowiedzialność | ACTOR, CAP |
| Scenariusze | UC, TUC |
| Ekrany | SCR, SCRSEC |
| Kontrakty | API, INT, QUE, CONV |
| Przepływy | FLOW, ACT, BPMN, SPEC-WF |
| Pojęcia i dane | DDM, LDM, ENT, STM |
| Mapy | UCMAP, NAV |

### Najważniejsze reguły (na jeden slajd)

1. Numer wiersza REQ, RB, RD, NFRT i ROLE nie wraca do obiegu. Nowe wymaganie dostaje kolejny wolny numer, nawet gdy wcześniejsze usunięto.
2. Każdy dokument musi być połączony z resztą grafu. Dokument bez powiązań albo „wyspa” to błąd.
3. Folder dokumentu wynika z relacji, a nie z tego, ile procesów go używa. Przykład: `ENT-Complaint` jest używana tylko w BFS-002, ale leży w `shared/domains/DDM-001/`, bo należy do `LDM-001`.
4. Zmiana dokumentu ma stałą kolejność: najpierw zapytanie `change_scope`, potem poprawa treści, na końcu usunięcie relacji, potem walidacja. Relacje usuwa się na końcu, bo zapytanie po nich przechodzi.
5. Walidator sprawdza strukturę, a analityk sens: granice procesu, poprawność wymagań, podział odpowiedzialności między zdolności.

### Zalety

- Jedna reguła zamiast wielu pól powiązań: to, co jest w treści, jest w relacjach.
- Brak ręcznie utrzymywanych list odwrotnych, które się rozjeżdżają.
- Program, człowiek i agent AI czytają te same powiązania.
- Zmiana standardu to zmiana plików YAML i szablonów, a nie kodu.

---

## 4. Szablony dokumentów

### Co to jest

Folder `standards/templates/` ma po jednym podfolderze na typ dokumentu.
W każdym są dwa pliki:

| Plik | Zawartość |
|---|---|
| `template.md` | Czysty szablon: front matter i sekcje do skopiowania. |
| `guide.md` | Czym jest dokument, kiedy go użyć, co trzeba wiedzieć, warianty. |

Spis wszystkich typów z opisem „kiedy używać” jest w
`standards/templates/_00-meta.md`.

### Jak używać

1. Znajdź typ w `_00-meta.md`, na przykład `use-case` dla scenariusza użytkownika.
2. Skopiuj `template.md`, nazwij plik doc-id małymi literami (`uc-012.md`) i połóż w folderze z sekcji 11 metodyki.
3. Wypełnij treść. Wpisuj identyfikatory dokumentów i wierszy, od których dokument zależy.
4. Uruchom `sync-relations.js --fix` i walidatory.

### Co daje

- Walidator `validate-form.js` czyta szablony wprost, więc szablon jest jednocześnie regułą sprawdzania.
- Sekcje opcjonalne są oznaczone w szablonie komentarzem, więc walidator ich nie wymaga.

---

## 5. sync-relations.js: relacje z treści

### Problem

Ręczne utrzymywanie listy `relations` jest żmudne i łatwo o błąd: brakujący
wpis, zły rodzaj relacji, wpis, który został po usuniętej wzmiance.

### Co robi

Skrypt szuka identyfikatorów w treści dokumentu (poza front matter), bierze
rodzaj relacji z matrycy i porównuje wynik z polem `relations`. Z opcją
`--fix` zapisuje poprawną listę.

```bash
node scripts/sync-relations.js standards/examples
```

```bash
node scripts/sync-relations.js standards/examples --fix
```

### Jak wylicza wpisy (przykłady)

| W treści | Wpis |
|---|---|
| `UC-001` wspomina `CAP-001` | `realizes CAP-001` (trójka `UC realizes CAP`) |
| `BFS-001` wspomina własny wiersz `REQ-01` | `contains REQ-01` |
| `UC-001` wspomina `BFS-001.REQ-01` | `realizes BFS-001.REQ-01` |
| API wspomina `ENT-Disposition.RW-001`, a matryca nie pozwala API wskazać reguły RW | `consumes ENT-Disposition` |

### Raport

Każda niezgodność ma etykietę, która mówi, kto ją poprawia:

| Etykieta | Znaczenie |
|---|---|
| `DO NAPRAWY` | Poprawi `--fix`. |
| `NAPRAWIONE` | `--fix` właśnie poprawił. |
| `RĘCZNIE` | Trzeba poprawić treść albo matrycę, na przykład wiersz bez prefiksu dokumentu (`REQ-01` w treści UC). |

### Zalety

- Analityk pisze treść, a nie listę relacji.
- Ta sama treść daje zawsze tę samą listę w tej samej kolejności, więc różnice w repozytorium są czytelne.
- Zachowuje BOM i końce linii CRLF, zmienia tylko pole `relations`.

---

## 6. Walidatory

### Problem

Błędy w dokumentacji wychodzą dopiero wtedy, gdy ktoś na nie trafi: link do
nieistniejącego wymagania, sekcja pominięta w dokumencie, ta sama zdolność
wpisana inaczej w relacji i w tabeli.

### Co robią

Trzy skrypty, każdy odpowiada za jedną grupę sprawdzeń. Niczego nie zmieniają
w plikach.

```bash
node scripts/validate-relations.js standards/examples
```

```bash
node scripts/validate-form.js standards/examples
```

```bash
node scripts/validate-consistency.js standards/examples
```

| Walidator | Kody | Co sprawdza |
|---|---|---|
| `validate-relations.js` | REL-01…REL-08 | Relacje zgodne z treścią, cel istnieje, liczebność z matrycy, reguły LDM/DDM, unikalny doc-id, połączenie z grafem, numery wierszy nie wracają (na podstawie historii git). |
| `validate-form.js` | FORM-01…FORM-06 | Pola front matter, wartości z listy, sekcje i ich kolejność, tabele z szablonu, nazwa pliku, folder wynikający z relacji. |
| `validate-consistency.js` | CONS-01…CONS-04 | Cel relacji jest wymieniony tam, gdzie szablon każe (np. `realizes CAP-001` w polu „Zdolność”), UC/TUC/API/INT nie powtarzają progu NFR swojej zdolności, krok `user-task` ma rolę i API, które go kończy, API nie powtarza wywołań swojego przepływu. |

### Format wyniku

```text
docs/processes/BFS-001/contracts/int-002.md:20  BŁĄD  CONS-01 ta sama informacja w dwóch miejscach  (INT-002)
  INT-002 ma wpis realizes CAP-001, a pole „Zdolność” go nie wymienia.
  Naprawa: Dopisz CAP-001 w polu „Zdolność”.
```

- Plik z numerem linii: w VS Code klik przenosi do miejsca błędu.
- Linia „Naprawa” pojawia się, gdy poprawka jest jednoznaczna.
- `--json` daje wynik dla innych programów (z niego korzysta aplikacja).
- Kod wyjścia 1 przy błędzie, więc walidator nadaje się do CI.

### Stan korpusu

| Walidator | Błędy | Ostrzeżenia |
|---|---:|---:|
| relacje | 0 | 1 (API-005 wskazuje encję i encję w niej zawartą) |
| forma | 0 | 9 (brakujące sekcje, np. „Otwarte pytania”) |
| spójność | 0 | 0 |

### Zalety

- Błąd wychodzi przy zapisie, a nie przy implementacji.
- Każdy komunikat mówi, co jest nie tak, gdzie i jak to poprawić.
- Reguły pochodzą z matrycy i szablonów, więc standard i sprawdzanie się nie rozjeżdżają.

---

## 7. knowledge-index: indeks, wiersz poleceń i serwer MCP

### Problem

Żeby odpowiedzieć „co trzeba przejrzeć przy zmianie wymagania”, człowiek albo
agent AI otwiera plik, szuka identyfikatorów, otwiera kolejne pliki i tak przez
kilka poziomów. To trwa i łatwo coś pominąć.

### Co robi

Indeks trzyma front matter wszystkich dokumentów w bazie SQLite i wykonuje
dwa zapytania po grafie:

| Zapytanie | Pytanie | Przykład z korpusu |
|---|---|---|
| `change_scope` | Które pliki przejrzeć, gdy zmieniam te węzły? | `BFS-001.REQ-01` → 14 plików |
| `implementation` | Co przeczytać, zanim zbuduję to, co opisuje węzeł? | `UC-001` → 25 plików |

Trasy zapytań są zapisane w `standards/config/query-patterns.yaml`, na
przykład dla encji: `-realizes-> DOM <-contains- DDM`. Wynik zawęża przegląd
do plików, które mogą wymagać zmiany. Nie oznacza, że każdy trzeba zmienić.

### Jak używać: wiersz poleceń

```bash
node scripts/knowledge-index/cli.js scope BFS-001.REQ-01 --root standards/examples
```

```bash
node scripts/knowledge-index/cli.js impl UC-001 --root standards/examples
```

| Polecenie | Co robi |
|---|---|
| `find <tekst>` | Szuka po ID (`UC-001`), typie (`API` zwraca wszystkie 12 API) albo słowach, bez polskich znaków: `obsluga` znajduje „Obsługa dyspozycji”. |
| `describe <ID>` | Plik, tytuł, opis, wpisy relacji i dokumenty, które wskazują węzeł. |
| `scope <ID…>` | `change_scope` dla jednego lub kilku węzłów. |
| `impl <ID…>` | `implementation` dla jednego lub kilku węzłów. |

Wynik podaje drogę do każdego pliku:

```text
change_scope dla BFS-001.REQ-01: węzły 14, pliki 14.

standards/examples/processes/BFS-001/scenarios/uc-001.md
  UC-001  przez: BFS-001.REQ-01 <-realizes- UC-001
standards/examples/processes/BFS-001/contracts/api-001.md
  API-001  przez: BFS-001.REQ-01 <-realizes- UC-001 -consumes-> API-001
```

### Jak używać: agent AI (MCP)

Serwer MCP jest zarejestrowany w repozytorium dla dwóch klientów:

| Plik | Klient |
|---|---|
| `.mcp.json` | Claude Code |
| `.vscode/mcp.json` | GitHub Copilot w VS Code |

Po otwarciu repozytorium agent ma narzędzia `find_document`, `describe_node`,
`change_scope`, `implementation` i `reindex`. Wystarczy zapytać zwykłym
językiem, na przykład „Zmieniam encję ENT-Disposition, które pliki trzeba
przejrzeć?”. Serwer synchronizuje bazę przed każdym wywołaniem, więc widzi
pliki zapisane chwilę wcześniej.

### Wynik testu z agentem AI

Test 14 września 2026 r.: 6 zadań, 3 modele (Haiku, Sonnet, Opus), każde
zadanie 2 razy z indeksem i 2 razy bez. Razem 72 uruchomienia. Szczegóły:
`scripts/knowledge-index/benchmark.md`.

| Miara (średnio na uruchomienie) | Bez MCP | Z MCP | Różnica |
|---|---:|---:|---:|
| Czas | 64,4 s | 14,8 s | 4,4 razy krócej |
| Tury agenta | 15,6 | 3,4 | 4,6 razy mniej |
| Tokeny wejściowe | 581 tys. | 156 tys. | 3,7 razy mniej |
| Koszt | 0,336 USD | 0,101 USD | 3,3 razy taniej |
| Trafione pliki | 90% | 100% | +10 p.p. |
| Odpowiedzi bezbłędne | 19 z 36 | 36 z 36 | |

Trzy historie na slajdy:

1. **Najtańszy model z indeksem wygrywa z najdroższym bez indeksu.** Haiku z MCP: 100% trafionych plików za 0,041 USD. Opus bez MCP: 99% za 0,547 USD, czyli 13 razy drożej.
2. **Bez indeksu słabszy model potrafi całkiem się pomylić.** W zadaniu dla `ENT-Disposition.RW-001` Haiku bez MCP odpowiedział, że żaden plik nie wspomina tego wiersza. Dokument encji zapisuje go jako samo `RW-001`, więc wyszukiwanie tekstu nic nie znajduje. Indeks zapisuje każdy wiersz pod pełnym identyfikatorem.
3. **Czas jest przewidywalny.** Najdłuższe uruchomienie z MCP: 33 s. Bez MCP: 153 s.

Ograniczenie testu: wzorcem był wynik indeksu, więc test mierzy szybkość
i trafność znajdowania plików, a nie jakość samych wzorców zapytań.

### Zalety

- Odpowiedź w milisekundach: synchronizacja 119 dokumentów trwa około 60 ms, a bez zmian około 25 ms.
- Ten sam kod zapytań (`scripts/lib/query.js`) działa w wierszu poleceń, w serwerze MCP i w aplikacji, więc wyniki są wszędzie takie same.
- Baza jest w `node_modules/.cache`, nie trafia do repozytorium i można ją skasować w każdej chwili.

---

## 8. Warsztat dokumentacji (docs-workbench)

### Problem

Graf 119 dokumentów, a docelowo kilkuset lub kilku tysięcy, jest nieczytelny
jako lista plików. Wynik zapytania czy walidacji w terminalu nie pokazuje
kontekstu.

### Co to jest

Lokalna aplikacja webowa w `tools/docs-workbench/`. Serwer Node.js czyta
folder dokumentacji, a interfejs w przeglądarce pokazuje graf. Aplikacja
tylko czyta pliki; edycja odbywa się w VS Code. Po zapisie pliku widok
odświeża się sam, bez utraty zaznaczenia i powiększenia.

### Uruchomienie

W folderze `tools/docs-workbench`:

```bash
npm install
```

```bash
npm run dev
```

Interfejs: http://localhost:5173. Serwer słucha tylko na `127.0.0.1`.

### Tryby i funkcje

| Funkcja | Co pokazuje | Do czego służy |
|---|---|---|
| **Mapa** | Dokumenty pogrupowane w procesy (`processes/BFS-001`) i foldery wspólne. Rozwinięta grupa układa dokumenty w kolumnach: mapy, ekrany, scenariusze, wymagania, odpowiedzialność, kontrakty, przepływy, dane. | Orientacja w dokumentacji, przegląd procesu, znalezienie dokumentów bez powiązań. |
| **Sąsiedztwo węzła** | Dokumenty w odległości 1–3 kroków od wybranego. | „Z czym łączy się ten dokument?” |
| **Katalog typu** | Wszystkie dokumenty wybranych typów jako graf (np. API pogrupowane według CAP, encje według LDM) albo tabela z kolumną „Używany przez”. | Przegląd kontraktów lub encji, szukanie nieużywanych elementów. W korpusie jedyna nieużywana encja to `ENT-AccountSnapshot`. |
| **Zasięg** | Wynik `change_scope` albo `implementation` dla koszyka węzłów, w kolumnach według liczby kroków od startu. Najechanie na plik podświetla drogę. | Wycena i zakres zmiany, lista do przeczytania przed implementacją. |
| **Symulacja usunięcia** | Wpisy, których cel przestanie istnieć, i dokumenty, które stracą połączenie z grafem. | Bezpieczne usuwanie dokumentów i wierszy. |
| **Eksport zasięgu** | Lista kontrolna Markdown (kopiuj lub pobierz) i link do widoku. | Wklejenie zakresu do zgłoszenia. |
| **Przepływ** | Zdolności CAP w kolumnach procesów i linie między nimi: zdarzenie (QUE), wywołanie (API, INT) i linia niejednoznaczna. Klik linii mówi, z czego wynika kierunek i jakie encje płyną. Dwuklik na CAP pokazuje poziom kontraktów. | Architektura: kto od kogo zależy, jakie dane przepływają między komponentami. |
| **Inspektor** | Relacje wychodzące, dokumenty wskazujące, wiersze dokumentu z etykietami, problemy walidacji. | Szczegóły węzła bez otwierania pliku. |
| **Podgląd pliku** | Markdown w oknie nad grafem; identyfikatory są linkami, diagramy Mermaid się rysują. | Czytanie dokumentu w kontekście grafu. |
| **Panel walidacji** | Wynik trzech walidatorów z filtrami poziomu, dokumentu i walidatora. „Pokaż” przenosi do dokumentu na Mapie. | Porządkowanie dokumentacji. |
| **Problem w podglądzie** | Podświetlona linia z błędem, komunikat, podpowiedź naprawy, link do VS Code i przycisk „Kopiuj prompt dla agenta”. | Szybka naprawa, także z pomocą agenta AI. |

### Wygoda pracy

- Cały widok (tryb, zaznaczenie, koszyk, filtry) jest w adresie strony, więc link otwiera u kolegi dokładnie ten sam widok.
- `Ctrl K` wyszukuje dokumenty; `typ:API` otwiera katalog typu.
- Skróty: `1` `2` `3` tryby, `Z` dodaj do koszyka zasięgu, `I` implementacja, `O` otwórz w VS Code, `Space` podgląd pliku, `F` dopasuj widok.
- Prawy klik na węźle otwiera menu z działaniami.
- Motyw jasny i ciemny.

### Czytelność mapy (liczby z korpusu)

Układ warstwowy (algorytm layered z biblioteki elkjs) przy rozwiniętym procesie
BFS-003:

| Układ | Linie przechodzące przez obce karty | Przecięcia linii |
|---|---:|---:|
| poprzedni | 129 | 201 |
| warstwowy, wszystkie linie | 0 | 88 |
| warstwowy, widok domyślny | 0 | 6 |

Widok domyślny pokazuje linie między grupami, a relacje dokumentu dopiero po
najechaniu na kartę.

### Zalety

- Zasięg zmiany, walidacja i architektura w jednym miejscu, na tych samych danych co skrypty.
- Nic nie trzeba instalować poza Node.js i `npm install`; dane nie opuszczają komputera.
- Aplikacja niczego nie zmienia w plikach, więc nie da się nią zepsuć dokumentacji.

---

## 9. migrate-relations.js: przejście ze starego formatu

### Problem

Istniejące dokumenty mają stare pola powiązań: `source-spec-ids`,
`related-doc-ids`, `component` i `type`.

### Co robi

Jednorazowo przepisuje dokumenty na nowy format:

1. Zmienia stary zapis wierszy: `NFR-PERF-01` na `NFRT-PERF-01`, `ACTOR-01` na `ROLE-01`.
2. Dopisuje ID dokumentu do wiersza innego dokumentu (`REQ-01` na `BFS-001.REQ-01`), gdy stare pola wskazują dokładnie jeden możliwy dokument.
3. Usuwa stare pola i zapisuje `relations` wyliczone z treści.
4. Zgłasza stare powiązania, których nowy format nie odtworzył, żeby analityk zdecydował, czy są potrzebne.

```bash
node scripts/migrate-relations.js docs
```

```bash
node scripts/migrate-relations.js docs --fix
```

Najpierw uruchamia się raport bez `--fix` i zapisuje go, bo po zapisie stare
pola znikają. Potem uruchamia się walidatory.

### Zalety

- Migracja nie gubi powiązań po cichu: każde nieodtworzone trafia do raportu `RĘCZNIE`.
- Zmienia tylko front matter i zapis identyfikatorów, reszta treści zostaje.

---

## 10. Skill plain-language-docs

### Co to jest

Instrukcja dla agenta AI w `.github/skills/plain-language-docs/SKILL.md`.
Przepisuje komentarze w konfiguracji i kodzie, pliki Markdown, teksty `--help`
i komunikaty programów na prosty język.

### Zasady skilla

- Pełne zdania z pełnym kontekstem, bez skrótów myślowych.
- Proste słowa; termin fachowy wyjaśniony w tym samym zdaniu.
- Tylko prawdziwe przykłady z projektu, bez wymyślonych identyfikatorów.
- Tylko obecny stan, bez historii zmian.
- Nie zmienia kluczy, wartości, identyfikatorów, kodu ani etykiet, do których odwołuje się inny plik.

### Zalety

- Dokumentacja narzędzi i standardu jest zrozumiała dla osoby, która pierwszy raz widzi projekt.
- Skill nie zawiera ścieżek ani przykładów z tego repozytorium, więc można go skopiować do innego projektu.

---

## 11. Jak narzędzia działają razem: scenariusze pracy

### A. Analityk zmienia wymaganie

1. Zapytanie `change_scope` dla `BFS-001.REQ-01`: w aplikacji (tryb Zasięg) albo w terminalu. Wynik: 14 plików, zaczynając od `UC-001`, dalej API, ekrany i zdolności tego scenariusza.
2. Eksport listy kontrolnej do zgłoszenia.
3. Poprawa treści w plikach z listy.
4. Usunięcie relacji i wierszy, które mają zniknąć (na końcu).
5. `sync-relations.js --fix`, potem trzy walidatory.

### B. Analityk dodaje nowy dokument

1. Szablon z `standards/templates/`, plik w folderze wynikającym z relacji.
2. Treść z identyfikatorami, od których dokument zależy.
3. `sync-relations.js --fix` dopisuje relacje.
4. Walidatory: `validate-form.js` powie o brakującej sekcji i złym folderze, `validate-relations.js` o nieistniejącym celu.
5. W aplikacji: dokument pojawia się na Mapie w swojej grupie.

### C. Developer implementuje scenariusz

1. Zapytanie `implementation` dla `UC-001`: 25 plików do przeczytania.
2. Albo w Claude Code / GitHub Copilot: „Co trzeba przeczytać, żeby zaimplementować UC-001?”. Agent pyta indeks i czyta tylko te pliki.

### D. Architekt przegląda zależności

1. Tryb Przepływ: zdolności w kolumnach procesów, linie zdarzeń i wywołań.
2. Klik linii: z którego dokumentu wynika zależność i jakie encje przepływają.
3. Katalog typu API albo ENT: kto używa kontraktu lub encji, co jest nieużywane.

### E. Porządkowanie dokumentacji

1. Panel walidacji w aplikacji, filtr na błędy.
2. Klik problemu: podgląd z podświetloną linią i podpowiedzią naprawy.
3. „Kopiuj prompt dla agenta”: prompt zawiera plik, linię, komunikat, fragment pliku i polecenie, którym agent sprawdzi naprawę.

### F. Usunięcie dokumentu

1. Symulacja usunięcia w trybie Zasięg.
2. Lista wpisów, których cel przestanie istnieć, i dokumentów, które stracą połączenie z grafem.
3. Poprawa tych dokumentów przed usunięciem.

---

## 12. Co zyskuje każda rola

| Rola | Najważniejsze narzędzia | Co zyskuje |
|---|---|---|
| Analityk | szablony, `sync-relations.js`, walidatory, aplikacja (Mapa, Zasięg, walidacja) | Pisze treść zamiast list powiązań; zna zakres zmiany przed jej wykonaniem; błędy widzi od razu z podpowiedzią. |
| Developer | `implementation` (CLI, MCP), podgląd pliku | Dostaje kompletną listę dokumentów do przeczytania; agent AI znajduje je szybciej i bez pominięć. |
| Architekt | aplikacja (Przepływ, Katalog typu), matryca relacji | Widzi zależności między zdolnościami i przepływ encji wyliczone z dokumentacji, a nie z pamięci. |
| Lider / PM | `change_scope`, eksport listy kontrolnej, link do widoku | Zakres zmiany jako lista plików do zgłoszenia; ten sam widok dla całego zespołu przez link. |
| Tester | `change_scope`, Mapa | Widzi, które scenariusze i kontrakty łączą się ze zmienionym wymaganiem. |
| Agent AI | serwer MCP, prompt z panelu problemu, skill | Mniej tur i tokenów, pełna lista plików, gotowy kontekst naprawy. |

---

## 13. Liczby do slajdów

| Liczba | Co znaczy | Źródło |
|---:|---|---|
| 119 | dokumentów w korpusie przykładowym, 3 procesy | `standards/examples` |
| 21 | typów dokumentów z szablonem i instrukcją | `standards/templates` |
| 68 | dozwolonych trójek w matrycy relacji | `relation-matrix.yaml` |
| 17 | sprawdzeń w trzech walidatorach (REL 8, FORM 6, CONS 3) | `scripts/README.md` |
| 14 | plików w zasięgu zmiany `BFS-001.REQ-01` | knowledge-index |
| 25 | plików do przeczytania przed implementacją `UC-001` | knowledge-index |
| ~60 ms | pełna synchronizacja indeksu (119 dokumentów) | `knowledge-index/README.md` |
| 4,4× | krótszy czas pracy agenta AI z indeksem | `benchmark.md` |
| 3,3× | niższy koszt pracy agenta AI z indeksem | `benchmark.md` |
| 36 z 36 | bezbłędnych odpowiedzi agenta z indeksem (bez: 19 z 36) | `benchmark.md` |
| 13× | tyle drożej kosztuje Opus bez indeksu niż Haiku z indeksem, przy gorszej trafności | `benchmark.md` |
| 129 → 0 | linii przechodzących przez obce karty na Mapie BFS-003 | `tools/docs-workbench/README.md` |
| 0 | pakietów npm potrzebnych skryptom | `scripts/README.md` |

---

## 14. Czego narzędzia nie robią

Warto to powiedzieć wprost na prezentacji, żeby nie budować złych oczekiwań.

- **Nie oceniają sensu treści.** Walidator nie wie, czy wymaganie jest poprawne ani czy odpowiedzialność jest dobrze podzielona między zdolności. To robi analityk.
- **Nie wiedzą, od czego dokument zależy, jeśli treść tego nie mówi.** Relacja powstaje z identyfikatora w treści. Tylko analityk wie, że dane API korzysta z danej encji, i musi to napisać.
- **`change_scope` nie mówi, co na pewno trzeba zmienić.** Zawęża przegląd do plików, które mogą wymagać zmiany.
- **Indeks nie przechowuje treści dokumentów.** Zwraca pliki; treść czyta się z pliku.
- **Aplikacja nie edytuje plików.** Otwiera je w VS Code.
- **Kierunek przepływu danych jest na poziomie zdolności.** Standard nie zapisuje, czy komponent czyta, czy zapisuje encję; scenariusz w kilku zdolnościach daje linię niejednoznaczną.

---

## 15. Stan prac i otwarte tematy

| Element | Stan |
|---|---|
| Metodyka, matryca, wzorce zapytań | gotowe, w repozytorium |
| Szablony 21 typów | gotowe; odtworzone z wyciągu i matrycy, jeszcze nieporównane z firmowymi szablonami |
| Korpus przykładowy | gotowy, przechodzi walidatory bez błędów |
| `sync-relations.js`, trzy walidatory | gotowe, w repozytorium |
| knowledge-index (CLI, MCP, benchmark) | gotowe, w repozytorium |
| Warsztat dokumentacji | działa; ostatnie zmiany (czytelność mapy, panel problemu) jeszcze nie są w commicie |
| Widoki przepływu pracy w aplikacji (nawigacja ekranów z makietami, FLOW z aktywnościami, BPMN z krokami i diagramem, mapy scenariuszy) | w budowie: serwer i widoki są w kodzie, jeszcze niepodłączone do interfejsu |
| `migrate-relations.js` | gotowy, nie jest w commicie; decyzje do potwierdzenia; nieuruchomiony na docelowej dokumentacji |
| Walidacja przed commitem (hook) i w CI | planowana; metodyka zakłada start w trybie ostrzegawczym, potem blokującym |
| Skill plain-language-docs | gotowy |

---

## 16. Propozycje prezentacji

### Prezentacja 1: dla wszystkich (15 min) — „Dokumentacja jako graf”

1. Problem: szukanie skutków zmiany w folderach.
2. Idea: węzeł, relacja, jedna reguła „relacja wynika z treści”.
3. Przykład `UC-001` i jego front matter.
4. Demo: Mapa i Zasięg dla `BFS-001.REQ-01` (14 plików).
5. Liczby z testu agenta AI.
6. Czego narzędzia nie robią.
7. Stan prac i kolejne kroki.

### Prezentacja 2: dla analityków (30–45 min) — „Jak pisać i zmieniać dokumenty”

1. Typy dokumentów i szablony (`template.md` + `guide.md`).
2. Identyfikatory i wiersze, reguła numerów, które nie wracają.
3. Kto zapisuje relację; dokument nie wymienia dokumentów, które go wskazują.
4. Układ folderów wynikający z relacji.
5. `sync-relations.js`: etykiety `DO NAPRAWY` i `RĘCZNIE`.
6. Walidatory: format wyniku, najczęstsze kody.
7. Scenariusze A, B i F z sekcji 11.
8. Demo: panel walidacji i prompt dla agenta.
9. Migracja starych dokumentów.

### Prezentacja 3: dla developerów (20 min) — „Co przeczytać, zanim zaczniesz”

1. Zapytanie `implementation`: `UC-001` → 25 plików.
2. CLI: `find`, `describe`, `impl`.
3. MCP w Claude Code i GitHub Copilot: jak zapytać agenta.
4. Wyniki testu: czas, koszt, trafność, historia z `RW-001`.
5. Podgląd pliku i skrót `O` do VS Code.

### Prezentacja 4: dla architektów i liderów (20 min) — „Zależności i zakres zmian”

1. Tryb Przepływ: zdolności, zdarzenia, wywołania, linie niejednoznaczne.
2. Katalog typu: kontrakty i encje, „Używany przez”, elementy nieużywane.
3. Zasięg z koszykiem kilku węzłów i eksport listy kontrolnej.
4. Symulacja usunięcia.
5. Walidacja w CI: tryb ostrzegawczy, potem blokujący.
6. Skala: aplikacja od początku grupuje dokumenty według procesów, bo docelowa dokumentacja ma mieć od 300 do 2000 dokumentów.

---

## 17. Słownik

| Pojęcie | Znaczenie |
|---|---|
| Front matter | Blok YAML na początku pliku Markdown z polami `doc-id`, `title`, `description`, `status`, `relations`. |
| doc-id | Identyfikator dokumentu, np. `UC-001`; prefiks określa typ. |
| Wiersz (identyfikator lokalny) | Element wewnątrz dokumentu z własnym ID, np. `REQ-01` w `BFS-001`; z zewnątrz wskazywany pełnym ID `BFS-001.REQ-01`. |
| Węzeł | Dokument albo wiersz. |
| Relacja (wpis) | Element listy `relations`: rodzaj i cel, np. `realizes CAP-001`. |
| Trójka | Typ źródła, rodzaj relacji, typ celu, np. `UC realizes REQ`. |
| Matryca relacji | Lista dozwolonych trójek (`relation-matrix.yaml`). |
| `change_scope` | Zapytanie: które pliki przejrzeć przy zmianie. |
| `implementation` | Zapytanie: co przeczytać przed budową. |
| Wyspa | Grupa dokumentów połączonych tylko ze sobą, bez połączenia z resztą grafu. |
| MCP | Model Context Protocol: sposób, w jaki agent AI (Claude Code, GitHub Copilot) wywołuje zewnętrzne narzędzia. |
| Skill | Instrukcja dla agenta AI opisująca, jak wykonać określony rodzaj pracy. |
| CAP (zdolność) | Zakres odpowiedzialności komponentu. |
| Korpus | Przykładowa dokumentacja w `standards/examples`, na której testowane są narzędzia. |
