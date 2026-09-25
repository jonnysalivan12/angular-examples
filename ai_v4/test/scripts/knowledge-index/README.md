# knowledge-index

knowledge-index to indeks dokumentacji projektowej zapisany w bazie danych
SQLite. Odpowiada na pytanie, które pliki dokumentacji trzeba przeczytać.
Zwraca ścieżkę folderu i nazwę każdego pliku. Dzięki temu osoba albo agent AI
nie musi przeszukiwać folderów, żeby znaleźć dokumenty powiązane ze zmianą.

Ten plik opisuje, jak indeks działa w środku. Polecenia, opcje i kody wyjścia
opisuje plik [scripts/README.md](../README.md), w sekcji „knowledge-index”.

Wyniki testu, który porównuje pracę agenta AI z indeksem i bez niego, są
w pliku [benchmark.md](benchmark.md).

Indeks korzysta z modułu `node:sqlite`, który jest wbudowany w Node.js od
wersji 22.5. Nie trzeba instalować żadnych pakietów. Indeks został sprawdzony
na Node.js 24.

## Pojęcia

- **Front matter** to blok YAML na początku pliku Markdown, między dwiema liniami `---`. Zawiera między innymi pola `doc-id`, `title`, `description`, `status` i `relations`.
- **Węzeł** to dokument albo wiersz w dokumencie. Dokument ma identyfikator z pola `doc-id`, na przykład `UC-001`. Wiersz ma pełny identyfikator złożony z doc-id dokumentu i identyfikatora wiersza, na przykład `BFS-001.REQ-01`.
- **Wpis relacji** to jeden element listy `relations`. Mówi, że dokument wskazuje inny węzeł. Przykład: plik `uc-001.md` ma wpis `realizes BFS-001.REQ-01`, czyli scenariusz `UC-001` realizuje wymaganie `REQ-01` z dokumentu `BFS-001`.
- **Zapytanie** przechodzi po wpisach relacji od wybranego węzła do kolejnych i zbiera powiązane węzły. Są dwa zapytania: `change_scope` (zasięg zmiany) i `implementation` (co przeczytać przed budową). Trasy zapytań opisuje plik [query-patterns.yaml](../../standards/config/query-patterns.yaml).

Zasady grafu dokumentacji opisuje plik
[methodology.md](../../standards/methodology.md).

## Przepływ danych

Dane płyną w jedną stronę:

```text
pliki .md  →  sync.js  →  baza SQLite  →  index.js  →  cli.js albo mcp-server.js
```

1. `sync.js` czyta front matter plików `.md` z folderu dokumentacji i zapisuje go w bazie.
2. `index.js` czyta bazę i wykonuje zapytania.
3. `cli.js` wypisuje wynik w terminalu, a `mcp-server.js` przekazuje go agentowi AI.

Oba wejścia, wiersz poleceń i serwer MCP, korzystają z tego samego pliku
`index.js`. Dlatego dają te same wyniki.

## Pliki w tym folderze

| Plik | Zawartość |
|---|---|
| `store.js` | Schemat bazy oraz zapis i usuwanie danych jednego pliku. |
| `sync.js` | Synchronizacja bazy z plikami w folderze dokumentacji. |
| `index.js` | Otwarcie i synchronizacja bazy, zapytania, wyszukiwanie dokumentów i opis węzła. |
| `cli.js` | Wiersz poleceń. |
| `mcp-server.js` | Serwer MCP dla agentów AI. |

Indeks korzysta też ze wspólnego kodu w folderze [scripts/lib](../lib):

| Plik | Do czego służy w indeksie |
|---|---|
| `lib/documents.js` | Odczyt front matter i wpisów relacji z pliku. |
| `lib/ids.js` | Rozpoznanie typu dokumentu albo wiersza po identyfikatorze. |
| `lib/matrix.js` | Odczyt matrycy relacji, czyli listy dozwolonych powiązań między typami. |
| `lib/query.js` | Odczyt wzorców zapytań i wykonanie zapytania. |

## Co jest w bazie

Baza leży w pliku `node_modules/.cache/knowledge-index.db` w głównym folderze
repozytorium. Folder `node_modules` nie trafia do repozytorium. Plik bazy można
skasować w każdej chwili. Następne uruchomienie zbuduje go od nowa.

Baza trzyma tylko dane z front matter. Treści dokumentów, czyli tekstu pod
front matter, w bazie nie ma.

| Tabela | Zawartość |
|---|---|
| `file` | Każdy plik `.md` z folderu dokumentacji: ścieżka względem głównego folderu repozytorium, folder (`dir`), nazwa pliku (`file_name`), skrót treści (`hash`) i rodzaj pliku. Rodzaj to `document` (poprawny dokument), `error` (front matter z błędem, opis błędu jest w kolumnie `error`) albo `not-document` (plik bez pola `doc-id`). |
| `document` | Dane dokumentu z front matter: `doc_id`, typ dokumentu, `title`, `description` i `status`. |
| `edge` | Poprawne wpisy relacji: dokument źródłowy, rodzaj relacji, pełny identyfikator celu, typ celu i numer linii wpisu. |
| `document_fts` | Tekst do wyszukiwania dokumentów po słowach: doc-id, tytuł i opis. |
| `meta` | Wersja schematu bazy, indeksowany folder i skrót plików, od których zależy odczyt dokumentów. |

Wpis relacji może wskazywać wiersz samym identyfikatorem. Przykład: plik
`bfs-001.md` ma wpis `contains REQ-01`. W tabeli `edge` taki cel dostaje pełny
identyfikator `BFS-001.REQ-01`.

Każdy wiersz tabel `file`, `document` i `edge` należy do jednego pliku. Dlatego
zmiana jednego pliku wymaga podmiany tylko jego wierszy. Baza nie sprawdza przy
zapisie, czy cel wpisu istnieje. Sprawdza to dopiero zapytanie. Dzięki temu
kolejność zapisu plików nie ma znaczenia.

## Synchronizacja

Każde polecenie `cli.js` synchronizuje bazę przed odpowiedzią. Serwer MCP robi
to przed każdym wywołaniem narzędzia. Synchronizacja przebiega tak:

1. Skrypt zbiera pliki `.md` z folderu dokumentacji i jego podfolderów. Pomija foldery i pliki, których nazwa zaczyna się od kropki, oraz folder `node_modules`.
2. Dla każdego pliku liczy skrót treści (hash SHA-1).
3. Jeśli skrót jest taki sam jak w bazie, skrypt pomija plik i nie czyta jego front matter.
4. Jeśli pliku nie ma w bazie albo skrót się zmienił, skrypt czyta front matter i zastępuje dane tego pliku w bazie.
5. Jeśli plik jest w bazie, a nie ma go już w folderze, skrypt usuwa jego dane z bazy.

Wszystkie zmiany jednej synchronizacji są zapisywane razem, w jednej
transakcji. Jeśli synchronizacja przerwie się błędem, baza zostaje w stanie
sprzed synchronizacji.

Skrypt buduje całą bazę od nowa w trzech przypadkach:

1. Folder dokumentacji jest inny niż przy poprzedniej synchronizacji.
2. Zmienił się jeden z plików, od których zależy odczyt dokumentów: `standards/config/relation-matrix.yaml`, `scripts/lib/ids.js` albo `scripts/lib/documents.js`.
3. Zmieniła się wersja schematu bazy zapisana w `store.js`. Wtedy skrypt usuwa stare tabele i zakłada nowe.

Wzorców zapytań baza nie przechowuje. Indeks czyta plik `query-patterns.yaml`
przy każdej synchronizacji, więc zmiana wzorców nie wymaga przebudowy bazy.

Na przykładowej dokumentacji z folderu `standards/examples` (119 dokumentów)
pierwsza synchronizacja trwa około 60 ms, a synchronizacja bez zmian około 25 ms.

## Jak działa zapytanie

Zapytanie zaczyna od węzłów podanych przez użytkownika. Typ węzła, na przykład
`ENT` albo `REQ`, decyduje, które wzorce z `query-patterns.yaml` zostaną użyte.
Wzorzec to ciąg kroków. Każdy krok przechodzi po jednym rodzaju relacji do
węzłów podanych typów.

Przykład: zapytanie `change_scope` dla encji `ENT-Disposition` i wzorzec
`-realizes-> DOM <-contains- DDM`.

1. Zapytanie zaczyna od `ENT-Disposition`.
2. Krok `-realizes-> DOM`: plik `ent-disposition.md` ma wpis `realizes DDM-001.DOM-Dyspozycja`. Zapytanie przechodzi do wiersza `DDM-001.DOM-Dyspozycja`.
3. Krok `<-contains- DDM`: plik `ddm-001.md` ma wpis `contains DOM-Dyspozycja`. Zapytanie przechodzi do dokumentu `DDM-001`.

Zapytanie przestrzega tych zasad:

- Krok przechodzi tylko do węzła, który istnieje. Dokument istnieje, gdy jakiś plik ma taki `doc-id`. Wiersz istnieje, gdy jego dokument ma wpis `contains` dla tego wiersza.
- Krok przechodzi tylko po powiązaniu, na które pozwala matryca relacji.
- Każdy węzeł odwiedzony po drodze trafia do wyniku, także wtedy, gdy wzorzec nie dojdzie do końca.
- Węzły startowe też trafiają do wyniku.
- Dla każdego węzła wynik podaje drogę, którą zapytanie doszło do niego pierwszy raz. Przykład: `ENT-Disposition -realizes-> DDM-001.DOM-Dyspozycja <-contains- DDM-001`.

Przy każdej synchronizacji indeks sprawdza wzorce z matrycą relacji. Jeśli
krok wymienia relację albo typ, na który matryca nie pozwala, indeks nie
wykonuje zapytania i zgłasza błąd z numerem linii w `query-patterns.yaml`.
Wiersz poleceń kończy wtedy działanie z kodem 2. Serwer MCP zwraca błąd jako
wynik narzędzia i działa dalej.

### Pliki w wyniku

Wynik jest pogrupowany według plików. Wiersz należy do pliku swojego dokumentu,
więc kilka węzłów może wskazywać ten sam plik. Przykład: zapytanie
`change_scope` dla `ENT-Disposition` znajduje 14 węzłów w 13 plikach, bo wiersz
`DDM-001.DOM-Dyspozycja` i dokument `DDM-001` leżą w jednym pliku:

```text
standards/examples/shared/domains/DDM-001/ddm-001.md
  DDM-001.DOM-Dyspozycja  przez: ENT-Disposition -realizes-> DDM-001.DOM-Dyspozycja
  DDM-001  przez: ENT-Disposition -realizes-> DDM-001.DOM-Dyspozycja <-contains- DDM-001
```

Ten sam `doc-id` może omyłkowo trafić do dwóch plików. Wtedy wpisy relacji
dokumentu i plik w wyniku pochodzą z pliku, którego ścieżka jest pierwsza
w kolejności alfabetycznej. Wpisy wskazujące ten dokument są brane ze
wszystkich plików. Taki błąd zgłasza walidator `validate-relations.js`.

## Wyszukiwanie dokumentów

Wyszukiwanie (`find` w wierszu poleceń, `find_document` w serwerze MCP)
rozpoznaje trzy rodzaje tekstu:

1. Identyfikator dokumentu albo wiersza. Wynik to dokument o tym `doc-id`. Przykład: `BFS-001.REQ-01` zwraca dokument `BFS-001`.
2. Typ dokumentu. Wynik to wszystkie dokumenty tego typu. Przykład: `API` zwraca wszystkie dokumenty API.
3. Słowa. Wynik to dokumenty, których doc-id, tytuł albo opis zawiera słowa zaczynające się od podanych. Najlepiej dopasowane dokumenty są na początku.

Wyszukiwanie po słowach nie rozróżnia wielkości liter ani polskich znaków.
Przykład: słowo `obsluga` znajduje dokument `BFS-001` o tytule „Obsługa
dyspozycji”. W bazie tekst do wyszukiwania jest zapisany małymi literami i bez
polskich znaków. Litera „ł” wymaga osobnej zamiany na „l”, bo w standardzie
Unicode nie jest literą „l” ze znakiem diakrytycznym. Tak samo jest
przekształcany tekst wpisany do wyszukiwarki. Tytuły i opisy w wyniku zostają
w oryginalnej postaci.

## Opis węzła

Opis węzła (`describe` w wierszu poleceń, `describe_node` w serwerze MCP)
podaje:

- plik, tytuł, opis i status dokumentu węzła,
- wpisy relacji dokumentu; wiersz nie ma własnych wpisów,
- wpisy innych dokumentów, które wskazują węzeł. Dla dokumentu są to także wpisy, które wskazują jego wiersze. Wpis `contains`, którym dokument deklaruje własny wiersz, nie jest tu powtarzany,
- inne pliki z tym samym `doc-id`, jeśli takie są.

Przykład: opis wiersza `BFS-001.REQ-01` podaje plik
`standards/examples/processes/BFS-001/bfs-001.md` i wpis
`UC-001 realizes BFS-001.REQ-01` z pliku `uc-001.md`.

## Serwer MCP

Serwer MCP udostępnia indeks agentom AI, na przykład Claude Code i GitHub
Copilot. Klient uruchamia serwer jako osobny proces i wymienia z nim wiadomości
przez standardowe wejście i wyjście. Każda linia to jedna wiadomość w formacie
JSON-RPC 2.0.

- Serwer otwiera bazę przy pierwszym wywołaniu narzędzia. Przed każdym kolejnym wywołaniem synchronizuje bazę z plikami.
- Folder podany w `--root` jest liczony względem głównego folderu repozytorium, a nie folderu, z którego klient uruchomił serwer.
- Wynik zapytania zawiera tylko listę plików z węzłami. Nie zawiera osobnej listy węzłów, żeby agent nie dostawał tych samych danych dwa razy.
- Błąd, na przykład zły argument albo folder, którego nie ma, wraca do agenta jako wynik narzędzia z opisem. Serwer działa dalej.
- Komunikaty diagnostyczne serwer wypisuje na standardowe wyjście błędów (stderr), bo standardowe wyjście przenosi tylko wiadomości protokołu.

Serwer jest zarejestrowany w plikach `.mcp.json` (Claude Code) i
`.vscode/mcp.json` (GitHub Copilot w VS Code). Listę narzędzi i ich argumenty
opisuje plik [scripts/README.md](../README.md).

## Czego indeks nie robi

- Nie przechowuje treści dokumentów. Kto potrzebuje treści, czyta plik wskazany w wyniku.
- Nie sprawdza poprawności dokumentacji. Brakujące cele wpisów, powtórzone `doc-id` i inne błędy zgłaszają walidatory opisane w [scripts/README.md](../README.md). Plik z błędem front matter trafia do bazy tylko jako plik z opisem błędu, bez danych dokumentu i bez wpisów relacji.
- Nie zmienia plików dokumentacji.
