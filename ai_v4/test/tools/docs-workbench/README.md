# Warsztat dokumentacji

Lokalna aplikacja do przeglądania grafu dokumentacji: mapa, katalog typu,
zasięg zmiany, przepływ danych między zdolnościami, podgląd pliku i wynik
walidatorów. Aplikacja tylko czyta pliki.

| Plik lub folder | Zawartość |
|---|---|
| `server/` | Serwer API (Node.js, bez pakietów npm). |
| `client/` | Interfejs: React i Vite. Tokeny Nocturne w `client/src/styles/nocturne.css`, motywy i układ w `app.css`. |
| `dev.mjs` | Tryb deweloperski: serwer API i Vite naraz. |
| `concept.html` | Koncepcja po briefie. |
| `design-brief.md`, `design-round-2.md` | Wsady dla Claude Design. |
| `design/` | Eksport projektu z Claude Design (runda 2). |

## Uruchomienie aplikacji

Pierwsze uruchomienie wymaga instalacji pakietów (w folderze `tools/docs-workbench`):

```bash
npm install
```

Tryb deweloperski, czyli serwer API na porcie 4180 i interfejs na http://localhost:5173:

```bash
npm run dev
```

Wersja zbudowana: `npm run build` tworzy folder `dist/`, a `npm start` uruchamia
serwer, który serwuje interfejs pod http://127.0.0.1:4180.

W interfejsie widok (tryb, zaznaczenie, koszyk, filtry) jest zapisany
w adresie strony, więc link otwiera ten sam widok. Motyw i szerokość paneli
pamięta przeglądarka.

| Skrót | Działanie |
|---|---|
| `Ctrl K` | wyszukiwanie (najpierw dopasowanie w ID i na początku słowa tytułu, potem w opisie); `typ:API` albo samo `api` otwiera katalog typu |
| `1` `2` `3` | tryb Mapa, Zasięg, Przepływ |
| `Z` | dodaj zaznaczony węzeł do koszyka zasięgu |
| `I` | zapytanie `implementation` dla zaznaczonego węzła |
| `O` | otwórz plik zaznaczonego węzła w VS Code |
| `Space` | podgląd pliku zaznaczonego węzła w oknie nad płótnem; `Esc` albo klik obok okna zamyka |
| `E` | pokaż albo ukryj wiersze zaznaczonego dokumentu na Mapie |
| `F` | dopasuj widok do zaznaczenia (bez zaznaczenia: do całości) |
| `0` `+` `−` | zoom 100%, przybliż, oddal |

Prawy klik na węźle (Mapa, katalog, Zasięg, Przepływ, także chip kontraktu
na karcie zdolności) zaznacza go i otwiera menu z działaniami inspektora:
Podgląd pliku, Otwórz w VS Code, Zasięg, Dodaj do koszyka zasięgu,
Implementacja, Kopiuj ID. Na grupie menu ma Rozwiń albo Zwiń grupę i Tylko ten
proces. Menu obsługuje strzałki, Enter, Esc i skróty z podpowiedzi.

Inspektor pokazuje relacje wychodzące (wpisy z pola `relations`), dokumenty
wskazujące węzeł, wiersze dokumentu z etykietą z treści i problemy walidacji
pliku. Etykieta wiersza to reszta nagłówka, w którym stoi jego ID
(`### A1. Zapis szkicu`), albo druga komórka wiersza tabeli (`| REQ-01 | … |`).
Podgląd pliku renderuje Markdown bez surowego HTML; identyfikatory w treści są
linkami, a diagramy Mermaid rysują się w motywie aplikacji.

Tryb Zasięg liczy `change_scope` albo `implementation` dla węzłów z koszyka
(`Z` dodaje zaznaczony węzeł; węzeł można też wyszukać w sekcji Koszyk albo,
przy pustym koszyku, na środku płótna). Płótno układa wynik w kolumny według liczby
kroków od startu; najechanie na plik w wyniku podświetla jego ścieżkę. Strzałka
biegnie od dokumentu, który ma wpis relacji, do celu. Symulacja usunięcia
pokazuje zasięg przed usunięciem, wpisy, których cel przestanie istnieć,
i węzły, które stracą połączenie z grafem. Wynik można skopiować albo pobrać
jako listę kontrolną Markdown.

Tryb Przepływ pokazuje zdolności CAP w kolumnach procesów i linie między nimi:
zdarzenie (`QUE realizes CAP` i `CAP consumes QUE`), wywołanie (dokument jednej
zdolności korzysta z API albo INT innej zdolności; krok SPEC-WF należy do
zdolności swojego BPMN, a ekran SCR i sekcja SCRSEC do zdolności scenariuszy,
które je zawierają) i linię niejednoznaczną (wywołujący należy do kilku
zdolności). Kilka linii między tą samą parą zdolności leży obok siebie. Kliknięcie linii pokazuje w inspektorze, z czego wynika kierunek,
ładunek encji i innych korzystających. Dwuklik na zdolności przechodzi na
poziom kontraktów: kto korzysta z jej API, INT i QUE oraz z czego one korzystają.

Przełącznik „Widok” w trybie Przepływ pokazuje też przepływ pracy (parametry
`widok` i `dok`, dokument wybiera się w panelu po lewej):

| Widok | Co pokazuje | Skąd dane |
|---|---|---|
| Nawigacja ekranów (NAV) | ekrany SCR z makietą i sekcjami SCRSEC, wejścia, wyjścia, komunikaty i przejścia z podpisami, obszary | diagram Mermaid `flowchart` w dokumencie NAV; bez diagramu same ekrany z relacji `groups` |
| Przepływy i aktywności (FLOW) | warunki wstępne i kroki z aktywnością ACT i wywołaniem API/INT/QUE | tabela „Opis przepływu” |
| Procesy BPMN i kroki | diagram z pliku BPMN XML (bpmn-js) z etykietą SPEC-WF przy zadaniu; bez pliku: zadania w kolejności z tabeli i zmienne przekazywane między krokami; w panelu tekst „Bramki i warunki” | tabela „Diagram procesu” (plik szukany pod tą ścieżką w folderze dokumentacji albo po nazwie), „Zadania procesu”, kolumna „Źródło” wejścia kroków SPEC-WF |
| Mapy scenariuszy (UCMAP) | aktorzy, obszary, UC i TUC z relacjami `include`, `extend`, `exclude`; najechanie na etykietę pokazuje uzasadnienie | diagram Mermaid i tabela „Opis relacji” |

Makieta ekranu albo sekcji to obraz o nazwie pliku dokumentu (`scr-001.png` obok
`scr-001.md` albo w podfolderze `assets/`; także `.svg`, `.jpg`, `.webp`). Bez
obrazu karta pokazuje oczekiwaną nazwę pliku. Klik w dokument na diagramie
zaznacza go, dwuklik otwiera podgląd.

Klik w problem walidacji (w inspektorze albo w ścieżce pliku w panelu walidacji)
otwiera podgląd pliku z tym problemem: linia jest podświetlona w treści albo
w rozwiniętym YAML front matter, a nad treścią stoi panel z komunikatem,
podpowiedzią naprawy, przyciskiem „Kopiuj prompt dla agenta” i linkiem do VS
Code na tej linii. Prompt podaje plik i linię, walidator, komunikat, fragment
pliku wokół linii, zasady zmiany i polecenie, którym agent sprawdza naprawę.
Gdy plik ma kilka problemów, strzałki w panelu przełączają między nimi,
a przycisk „Kopiuj prompt dla wszystkich” kopiuje jeden zbiorczy prompt:
wszystkie problemy pliku w kolejności linii, każdy z komunikatem i podpowiedzią,
fragment pliku raz na linię oraz polecenia wszystkich walidatorów, które te
problemy zgłosiły. Ten sam zbiorczy prompt kopiuje link „kopiuj prompt dla
wszystkich” w sekcji Walidacja inspektora, a w panelu walidacji przycisk
„Kopiuj prompt dla pliku” (przy filtrze Dokument) i link „prompt dla pliku”
w rozwiniętym problemie. Prompt obejmuje wszystkie problemy pliku bez względu
na filtry panelu.

Panel walidacji otwiera kliknięcie liczników w pasku górnym (`Esc` zamyka).
Pokazuje wynik `validate-relations.js`, `validate-form.js`
i `validate-consistency.js` z filtrami poziomu, dokumentu i walidatora, a przy
problemie podpowiedź „Naprawa”. „Pokaż” przełącza na Mapę, rozwija grupę
dokumentu i wyśrodkowuje go; ścieżka pliku otwiera VS Code na linii. Znaczniki
błędów i ostrzeżeń na Mapie można wyłączyć w panelu po lewej.

Po zapisie pliku serwer wysyła zdarzenie `change`, a interfejs pobiera dane od
nowa bez zmiany widoku: węzły zostają na miejscu, zaznaczenie i zoom też.

Katalog typu to zakres „Typ dokumentu” na Mapie (albo `typ:API` w wyszukiwaniu).
Pokazuje wszystkie dokumenty wybranych typów jako graf albo tabelę. Graf
grupuje według właściciela (na przykład CAP dla API i LDM dla encji) albo
procesu w kolumnach grup; przy grupowaniu „Status” kolumną jest status, a przy
„Typ” typ dokumentu, jak na tablicy kanban. Kolumny
tabeli wynikają z trójek matrycy relacji. „Używany przez” liczy dokumenty, które
wskazują dokument albo jego wiersz; wpis `LDM contains ENT` nie jest liczony,
bo LDM to indeks encji.

Grupy to procesy (`processes/BFS-001`) i foldery wspólne (`shared/actors`,
`shared/nfr`, `shared/conventions`, `shared/maps`, `shared/activities`,
`shared/domains`); wszystkie domeny należą do jednej grupy `shared/domains`.

Na Mapie kółko myszy przybliża w miejscu kursora, przeciąganie tła przesuwa
widok, klik w tło zdejmuje zaznaczenie, Shift z przeciąganiem zaznacza ramką
i przybliża do zaznaczonych węzłów, a dwuklik na grupie ją rozwija albo zwija.
Przeciągnięte węzły zostają na miejscu do kliknięcia „Ułóż”. Minimapa pojawia
się powyżej 150%, a poniżej 25% widać tylko grupy. Przycisk „Auto” obok
„Dopasuj” (domyślnie włączony, pamięta go przeglądarka) dopasowuje widok po
zmianie zakresu, grupowania, warstw, relacji, gęstości i układu, gdy nowy układ
jest już policzony; zaznaczenie, rozwinięcie wierszy i odświeżenie danych nie
przesuwają widoku. Linia między grupami ma 1,2–2,4 px grubości zależnie od
liczby relacji, a strzałki mają stały rozmiar.

Rozwinięta grupa układa dokumenty w kolumnach: Mapy, Ekrany (SCR, obok
SCRSEC), Scenariusze, Wymagania, Odpowiedzialność, Kontrakty, Przepływy (FLOW
i BPMN, obok ACT i SPEC-WF), Pojęcia i dane. Kolejność jest policzona na
korpusie tak, żeby jak najwięcej relacji łączyło sąsiednie kolumny. Listy w panelu (warstwy, relacje, typy i kolumny katalogu) mają w nagłówku
„zaznacz wszystko” albo „odznacz wszystko”. Liczby
w panelu po lewej są klikalne: liczba warstwy otwiera katalog jej typów, liczba
relacji zostawia na płótnie tylko tę relację.

Domyślny układ Mapy to **warstwowy** (algorytm layered z elkjs, `map/layout.js`):
1. Każda rozwinięta ramka jest układana osobno. Kolumny ramki są wymuszone,
   kolejność kart w kolumnie wybiera algorytm tak, żeby linie jak najrzadziej
   się krzyżowały, a linie biegną pionowo i poziomo wokół kart.
2. Linie z dokumentów ramki do jednej grupy poza ramką tworzą **wiązkę**: na
   brzegu ramki mają jeden port (prawy, gdy wpisy wychodzą z ramki, lewy, gdy
   przychodzą), a dalej jedną linię z liczbą relacji.
3. Ramki, grupy i wiązki są układane razem, więc grupy stoją po tej stronie
   ramki, z którą się łączą.

Na korpusie przy rozwiniętej BFS-003 poprzedni układ dawał 129 przejść linii
przez obce karty i 201 przecięć; warstwowy daje 0 przejść i 88 przecięć przy
wszystkich liniach, a w widoku domyślnym 6 przecięć.

**Linie** to trzy niezależne pola (parametr `linie`):
- **Grupujące**: linie między grupami i wiązki do grup, z liczbą relacji.
- **Relacje dokumentów**: każda relacja osobną linią (wiązki wtedy znikają).
- **Relacje po najechaniu**: najechana albo zaznaczona karta pokazuje swoje
  relacje z nazwami, a reszta przygasa.

Domyślnie włączone są Grupujące i Po najechaniu, a w sąsiedztwie wszystkie trzy.
„Tylko relacje” to same Relacje dokumentów. Linie karty w fokusie biegną także
przez port ramki do grupy i zastępują jej część wiązki: zostaje wiązka
pozostałych dokumentów albo żadna. Karty grup przy grupowaniu według warstwy
pokazują nazwę warstwy bez klucza (`scr`, `data`). Wiązka bez wyliczonej trasy (układ
siłowy, kołowy, przeciągnięta ramka) nie ma strzałki.

**Sąsiedztwo węzła** liczy dokumenty w odległości 1–3 kroków od środka
(parametr `wezel`). Środek wybiera się wyszukiwarką na środku pustego płótna
albo w panelu po lewej, dwuklikiem na dokumencie albo z menu kontekstowego
(„Sąsiedztwo na Mapie”). Środek jest niezależny od zaznaczenia, więc klik
w tło zdejmuje zaznaczenie, a sąsiedztwo zostaje.

Linia (na Mapie i w Zasięgu) kończy się w jednym z punktów połączenia na brzegu karty dokumentu albo
grupy: trzech na górze, trzech na dole, jednym po lewej i jednym po prawej.
Punkt jest widoczny tylko na końcu linii. Trasa z układu warstwowego dochodzi
do najbliższego punktu na swoim brzegu, a linia bez trasy wybiera najkrótszą
parę punktów zwróconych do siebie. Karty jedna nad drugą (w jednej kolumnie) łączy łuk z lewego boku
do lewego boku, żeby linia nie szła przez karty pomiędzy.

Układ siłowy i kołowy (wokół węzła zaznaczonego w chwili wyboru układu albo kliknięcia „Ułóż”; samo zaznaczenie nie przestawia węzłów) zostały jako alternatywa: układają
tylko grupy i ramki, a linie biegną od brzegu do brzegu. Przeciągnięty węzeł
traci trasy swoich linii do kliknięcia „Ułóż”; do tego czasu jego linie biegną
od brzegu do brzegu.

## Uruchomienie samego serwera

Polecenie uruchamia się z głównego folderu repozytorium:

```bash
node tools/docs-workbench/server/index.js --root standards/examples
```

- `--root` to folder dokumentacji (wymagany).
- `--port` to port serwera; domyślnie 4180.
- `--db` to plik bazy indeksu; domyślnie `node_modules/.cache/docs-workbench.db`. Baza jest osobna od bazy serwera MCP knowledge-index, więc oba mogą indeksować różne foldery.

Serwer słucha tylko na `127.0.0.1`. Po zmianie pliku w folderze dokumentacji
albo w `standards/config` synchronizuje indeks, a gdy indeks naprawdę się
zmienił, wysyła zdarzenie `change` pod `/api/events`.

## API

| Adres | Zwraca |
|---|---|
| `GET /api/meta` | wersję danych, folder dokumentacji, nazwy zapytań |
| `GET /api/graph` | dokumenty z grupą i warstwą, wiersze, relacje (z polem `exists`), grupy, liczby relacji między grupami |
| `GET /api/doc?id=UC-001` | opis węzła z knowledge-index (relacje wychodzące i przychodzące) oraz treść pliku |
| `GET /api/search?q=dysp&type=API&limit=20` | dokumenty z wyszukiwania knowledge-index |
| `POST /api/query` | `{ query, starts, simulateRemoval }` → wynik zapytania; z `simulateRemoval` także `removal`: `broken` (wpisy, których cel przestanie istnieć) i `disconnected` (węzły, które stracą połączenie z grafem) |
| `GET /api/workflows` | widoki przepływu pracy: `navigation` (NAV), `flows` (FLOW), `processes` (BPMN), `scenarioMaps` (UCMAP) |
| `GET /api/flow` | zdolności z kontraktami i linie `event`, `call`, `ambiguous` z encjami |
| `GET /api/validation` | wynik trzech walidatorów (`--json`) w jednej liście |
| `GET /api/events` | strumień zdarzeń `hello` (z wersją danych), `change`, `sync-error` |
| `GET /api/file?path=…` | plik z folderu dokumentacji (obraz z treści dokumentu, makieta, plik `.bpmn`); ścieżka względem głównego folderu repozytorium, jak `path` dokumentu |

Zasięg zmiany liczy `scripts/lib/query.js`, a węzeł startowy jest pierwszą
pozycją wyniku.
