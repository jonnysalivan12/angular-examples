# Skrypty

Skrypty działają na Node.js i nie wymagają instalowania żadnych pakietów.
Zostały sprawdzone na Node.js 24. Wszystkie polecenia poniżej uruchamia się
z głównego folderu repozytorium.

Każdy skrypt ma w tym pliku własną sekcję. Sekcja opisuje, co skrypt robi, jak
go uruchomić, co wypisuje i jaki kod wyjścia zwraca.

| Skrypt | Co robi |
|---|---|
| [migrate-relations.js](migrate-relations.js) | Jednorazowo przepisuje dokumenty ze starego front matter (`source-spec-ids`, `related-doc-ids`, `component`, `type`) na pole `relations` i zgłasza stare powiązania, które nie mają relacji. |
| [sync-relations.js](sync-relations.js) | Sprawdza, czy pole `relations` w dokumencie zgadza się z identyfikatorami wspomnianymi w treści, i na żądanie poprawia to pole. |
| [validate-relations.js](validate-relations.js) | Sprawdza relacje w całej dokumentacji: pole `relations`, cele wpisów, liczebność, reguły trójek, unikalność doc-id, połączenie z grafem i numery wierszy. |
| [validate-form.js](validate-form.js) | Sprawdza formę dokumentów: pola front matter, sekcje i tabele z szablonu, wartości z listy, nazwę pliku i folder. |
| [validate-consistency.js](validate-consistency.js) | Sprawdza, czy ta sama informacja podana w dwóch miejscach się zgadza, czy dokument nie powtarza progu NFR zdolności i czy krok user-task ma rolę i API, które go kończy. |
| [knowledge-index/cli.js](knowledge-index/cli.js) | Trzyma front matter dokumentów w bazie SQLite, synchronizuje ją z folderem i odpowiada na zapytania `change_scope` i `implementation` listą plików. |

Wspólny kod skryptów leży w folderze [lib](lib):

| Plik | Zawartość |
|---|---|
| `lib/ids.js` | zapis identyfikatorów dokumentów i wierszy |
| `lib/matrix.js` | odczyt matrycy relacji |
| `lib/documents.js` | odczyt plików, front matter, pola `relations`, treści Markdown i indeks powiązań |
| `lib/templates.js` | odczyt szablonów z `standards/templates` |
| `lib/report.js` | wspólny format wyniku walidatorów |
| `lib/query.js` | odczyt wzorców z `standards/config/query-patterns.yaml` i wykonanie zapytań `change_scope` i `implementation` na grafie dokumentacji |

## migrate-relations.js

Stary standard zapisywał powiązania w front matter: dokument nadrzędny w polu
`source-spec-ids`, dokumenty powiązane w polu `related-doc-ids`, zdolność
w polu `component`, a typ dokumentu w polu `type`. Nowy standard ma jedno pole
`relations`, a jego wpisy wynikają z identyfikatorów wspomnianych w treści.
Skrypt przepisuje dokumenty ze starego formatu na nowy. Uruchamia się go raz,
na całej dokumentacji.

### Uruchomienie

Raport, który niczego nie zmienia w plikach:

```bash
node scripts/migrate-relations.js docs
```

Raport i zapis zmian w plikach:

```bash
node scripts/migrate-relations.js docs --fix
```

- Podaj folder całej dokumentacji. Skrypt sprawdza stare powiązanie po obu stronach, więc potrzebuje obu dokumentów.
- Najpierw uruchom skrypt bez opcji i zapisz raport. Po zapisie zmian dokumenty nie mają już starych pól, więc następne uruchomienie nie pokaże starych powiązań.
- Opcja `--help` wypisuje krótką instrukcję.

### Co skrypt zmienia

Skrypt zmienia tylko dokumenty w starym formacie, czyli takie, które mają jedno
ze starych pól, stary zapis wiersza NFR albo roli aktora, albo nie mają pola
`relations`.
W każdym takim dokumencie:

1. Zmienia stary zapis wierszy na nowy, także w pełnym ID:
   - wiersz NFR: `NFR-PERF-01` na `NFRT-PERF-01`, `NFR-001.NFR-PERF-01` na `NFR-001.NFRT-PERF-01`,
   - rola aktora: `ACTOR-01` na `ROLE-01`, `ACTOR-001.ACTOR-01` na `ACTOR-001.ROLE-01`. Rola ma numer z dwóch cyfr, a dokument aktora z trzech, więc `ACTOR-001` zostaje bez zmian.
2. Dopisuje ID dokumentu do wiersza innego dokumentu, na przykład `REQ-01` na `BFS-001.REQ-01`. Robi to tylko wtedy, gdy stare pola wskazują dokładnie jeden dokument, który może mieć taki wiersz, a matryca pozwala wskazać ten wiersz.
3. Usuwa pola `type`, `component`, `source-spec-ids` i `related-doc-ids`.
4. Zapisuje pole `relations` na końcu front matter. Wpisy wylicza z treści tak samo jak `sync-relations.js --fix`.

Pozostałych pól front matter i pozostałej treści skrypt nie zmienia.

### Co skrypt wypisuje

| Etykieta | Znaczenie |
|---|---|
| `DO ZMIANY` | Zmiana, którą zapisze uruchomienie z opcją `--fix`. |
| `ZMIENIONE` | Zmiana, którą opcja `--fix` właśnie zapisała. |
| `RĘCZNIE` | Niezgodność, którą trzeba poprawić samodzielnie. |

Poza niezgodnościami z [sync-relations.js](#sync-relationsjs) skrypt zgłasza:

| Niezgodność | Co oznacza | Jak ją poprawić |
|---|---|---|
| stare powiązanie bez relacji | Stare pole wskazuje dokument, a żaden z dwóch dokumentów nie ma wpisu do drugiego. Raport mówi, który dokument powinien wspomnieć drugi, albo że matryca nie ma dla tej pary trójki. | Ręcznie: wpisz ID w treści dokumentu wskazanego w raporcie albo pomiń powiązanie, jeśli jest nieaktualne. |
| stara wartość | Stare pole ma wartość, która nie jest ID dokumentu, na przykład sam wiersz `REQ-07`. | Ręcznie: sprawdź, czy powiązanie jest potrzebne, i wpisz pełne ID w treści. |
| wiersz bez prefiksu | Stare pola wskazują kilka dokumentów, które mogą mieć ten wiersz, albo żadnego. | Ręcznie: dopisz ID właściwego dokumentu. |

### Kod wyjścia

| Kod | Bez opcji | Z opcją `--fix` |
|---|---|---|
| 0 | Nie ma nic do zmiany ani do poprawy ręcznej. | Zmiany są zapisane i nic nie zostało do poprawy ręcznej. |
| 1 | Są zmiany do zapisania albo niezgodności do poprawy ręcznej. | Zostały niezgodności do poprawy ręcznej. |
| 2 | Skrypt został źle wywołany, podana ścieżka nie istnieje albo nie da się odczytać matrycy. | Tak samo jak bez opcji. |

### Po migracji

Uruchom walidatory z sekcji [Walidatory](#walidatory). Pokażą to, czego
migracja nie zmienia: brak pola `description`, sekcje ze starych szablonów
i położenie plików w folderach.

## sync-relations.js

Skrypt szuka w treści dokumentu identyfikatorów innych dokumentów i wierszy,
na przykład `UC-001` albo `BFS-001.REQ-01`. Każde takie wystąpienie to
wzmianka. Skrypt sprawdza, czy dla każdej wzmianki jest wpis w polu `relations`
w front matter, i czy w tym polu nie ma wpisów, które z treści nie wynikają.

Rodzaj relacji skrypt bierze z
[relation-matrix.yaml](../standards/config/relation-matrix.yaml). Dla każdej
pary typów (typ dokumentu, który wspomina, i typ wspomnianego celu) matryca
podaje jeden rodzaj relacji. Ogólne zasady grafu dokumentacji opisuje
[methodology.md](../standards/methodology.md).

### Uruchomienie

Raport, który niczego nie zmienia w plikach:

```bash
node scripts/sync-relations.js standards/examples
```

Raport i poprawienie pola `relations` w plikach:

```bash
node scripts/sync-relations.js standards/examples --fix
```

- Jako wejście można podać plik `.md`, folder albo kilka ścieżek naraz.
- Jeśli podasz folder, skrypt sprawdzi pliki `.md` w tym folderze i we wszystkich podfolderach. Bierze pod uwagę tylko pliki, które mają w front matter pole `doc-id`. Pomija foldery i pliki, których nazwa zaczyna się od kropki, oraz folder `node_modules`.
- Opcja `--help` wypisuje krótką instrukcję.

### Jak skrypt wylicza wpisy

1. Wzmianką jest każdy identyfikator w pliku poza front matter. Identyfikatory w polach front matter, na przykład w `title` albo `description`, nie tworzą wpisów.
2. Rodzaj wpisu wynika z pary typów w matrycy. Przykład: `UC-001` wspomina `CAP-001`, a matryca ma trójkę `UC realizes CAP`, więc potrzebny jest wpis `realizes CAP-001`.
3. Własny wiersz dokumentu zapisany samym identyfikatorem daje wpis `contains`. Przykład: `REQ-01` w treści `BFS-001` daje wpis `contains REQ-01`.
4. Wiersz innego dokumentu zapisany pełnym identyfikatorem daje wpis do tego wiersza. Przykład: `UC-001` wspomina `BFS-001.REQ-01`, więc potrzebny jest wpis `realizes BFS-001.REQ-01`. Jeśli matryca nie ma trójki do takiego wiersza, wpis wskazuje cały dokument. Przykład: API wspomina `ENT-Disposition.RW-001`, a matryca nie pozwala API wskazać reguły RW, więc potrzebny jest wpis `consumes ENT-Disposition`.
5. Dokumenty BFS, NFR, DDM i ACTOR nie mogą być celem relacji w całości. Samo ich ID w treści nie tworzy wpisu. Wystarczy, że dokument ma wpis do jednego z ich wierszy.
6. Dokument nie wymienia w treści dokumentów, które go wskazują. Przykłady: krok SPEC-WF nie wymienia swojego procesu BPMN, a sekcja ekranu nie wymienia ekranu. Taką wzmiankę skrypt zgłasza do poprawy ręcznej ([methodology.md](../standards/methodology.md), sekcja 7).

### Co skrypt wypisuje

Raport jest pogrupowany według plików. Każda niezgodność ma etykietę, która
mówi, kto ją poprawia:

| Etykieta | Znaczenie |
|---|---|
| `DO NAPRAWY` | Niezgodność, którą poprawi uruchomienie z opcją `--fix`. |
| `NAPRAWIONE` | Niezgodność, którą opcja `--fix` właśnie poprawiła. |
| `RĘCZNIE` | Niezgodność, którą trzeba poprawić samodzielnie: w treści dokumentu albo w matrycy. |

Na końcu raportu skrypt podaje liczbę sprawdzonych dokumentów i liczbę
niezgodności w każdej grupie.

Po etykiecie jest nazwa niezgodności. Tabela wyjaśnia każdą z nich:

| Niezgodność | Co oznacza | Jak ją poprawić |
|---|---|---|
| brak wpisu | Identyfikator występuje w treści, a pole `relations` nie ma dla niego wpisu. | `--fix` dopisuje wpis. |
| zbędny wpis | Wpis nie wynika z treści: treść nie wspomina celu, matryca nie pozwala na taki wpis albo ten sam cel ma już wpis z innym rodzajem relacji. | `--fix` usuwa wpis. |
| zły typ | Wpis ma inny rodzaj relacji niż ten, który podaje matryca. | `--fix` zmienia rodzaj relacji. |
| duplikat | Ten sam wpis występuje drugi raz. | `--fix` usuwa powtórzenie. |
| zapis celu | Własny wiersz dokumentu jest zapisany z identyfikatorem dokumentu na początku, na przykład `BFS-001.REQ-01` w `BFS-001`. | `--fix` zapisuje go samym identyfikatorem wiersza, na przykład `REQ-01`. |
| kolejność wpisów | Wpisy nie stoją w kolejności z matrycy. Raport podaje pierwszy wpis, który nie stoi na swoim miejscu. | `--fix` układa całą listę w kolejności z matrycy. |
| błędny wpis | Wpis nie ma klucza `type` albo `target`, ma dodatkowy klucz, ma rodzaj relacji spoza listy `relation_types` albo jego cel nie jest identyfikatorem. | `--fix` usuwa wpis i dopisuje poprawny, jeśli wynika on z treści. |
| brak pola relations, nieczytelne pole relations | Front matter nie ma pola `relations` albo pole jest zapisane w sposób, którego skrypt nie obsługuje. | `--fix` zapisuje pole od nowa. |
| brak trójki | Matryca nie ma trójki dla wspomnianej pary typów w żadnym kierunku. | Ręcznie: usuń wzmiankę albo zmień matrycę. |
| wiersz bez prefiksu | Wiersz innego dokumentu jest zapisany bez identyfikatora tego dokumentu, na przykład `REQ-01` w treści UC. | Ręcznie: dopisz identyfikator dokumentu, na przykład `BFS-001.REQ-01`. |
| wzmianka bez wiersza | Treść wymienia sam dokument, który nie może być celem w całości, na przykład `BFS-001` w UC, a dokument nie ma wpisu do żadnego wiersza `BFS-001`. | Ręcznie: wskaż konkretny wiersz pełnym identyfikatorem. |
| błędne ID wiersza | Wiersz nie może należeć do dokumentu tego typu, na przykład `UC-001.REQ-01`, bo wymagania REQ leżą w BFS. | Ręcznie: popraw identyfikator. |
| front matter, plik bez doc-id | Front matter nie ma zamykającej linii `---`, `doc-id` nie pasuje do żadnego typu dokumentu, pole `relations` występuje kilka razy albo plik podany wprost nie ma `doc-id`. | Ręcznie: popraw front matter. |
| wzmianka o dokumencie wskazującym | Dokument wymienia w treści dokument, który go wskazuje, na przykład krok SPEC-WF wymienia swój proces BPMN. | Ręcznie: usuń wzmiankę. Relację zapisuje drugi dokument. |

### Jak opcja `--fix` zapisuje pole relations

- Zmienia tylko pole `relations` i tylko w plikach, w których są niezgodności do naprawy. Reszta dokumentu zostaje bez zmian.
- Zapisuje całą listę w kolejności trójek w matrycy, a w obrębie jednej trójki rosnąco według identyfikatora. Ta sama treść dokumentu daje więc zawsze tę samą listę. Przykład: w `BPMN-001` wpisy `contains SPEC-WF-001`, `contains SPEC-WF-002` i `contains SPEC-WF-003` stoją przed `realizes CAP-003`, bo w matrycy trójka `BPMN contains SPEC-WF` stoi przed `BPMN realizes CAP`.
- Pustą listę zapisuje jako `relations: []`.
- Zachowuje znacznik BOM na początku pliku i końce linii CRLF, jeśli plik je miał.

### Kod wyjścia

| Kod | Bez opcji | Z opcją `--fix` |
|---|---|---|
| 0 | Nie ma żadnych niezgodności. | Wszystko zostało naprawione i nic nie zostało do poprawy ręcznej. |
| 1 | Są niezgodności do naprawy przez `--fix` albo do poprawy ręcznej. | Zostały niezgodności do poprawy ręcznej. |
| 2 | Skrypt został źle wywołany, podana ścieżka nie istnieje albo nie da się odczytać matrycy. | Tak samo jak bez opcji. |

### Czego skrypt nie sprawdza

- Czy dokument albo wiersz wskazany we wpisie naprawdę istnieje.
- Czy `doc-id` jest unikalny w całej dokumentacji.
- Czy do każdego dokumentu i wiersza da się dojść z reszty grafu.

Te rzeczy sprawdza [validate-relations.js](#validate-relationsjs).

### Co zrobić po zmianie standardu

- Nowy typ dokumentu albo wiersza trzeba dopisać w `lib/ids.js`: prefiks i zapis identyfikatora w `DOC_FORMATS` (dokumenty) albo `ROW_FORMATS` (wiersze). Jeśli matryca ma typ, którego skrypt nie zna, skrypt kończy działanie z kodem 2.
- Każda para typów musi mieć w matrycy tylko jeden rodzaj relacji. Jeśli para ma dwa, skrypt kończy działanie z kodem 2.
- Pozostałe zmiany matrycy nie wymagają zmian w skrypcie, bo skrypt czyta matrycę przy każdym uruchomieniu.

## Walidatory

Trzy walidatory sprawdzają dokumentację przed commitem. Każdy odpowiada za
jedną grupę sprawdzeń, a wszystkie wypisują wynik w tym samym formacie.

```bash
node scripts/validate-relations.js standards/examples
```

```bash
node scripts/validate-form.js standards/examples
```

```bash
node scripts/validate-consistency.js standards/examples
```

- Podaj folder całej dokumentacji, a nie pojedynczy plik. Część sprawdzeń czyta dokumenty wskazywane przez wpisy: bez nich zgłosi fałszywy błąd „cel nie istnieje” albo nie wyliczy folderu dokumentu.
- Walidator czyta pliki z dysku, łącznie ze zmianami, które nie są jeszcze w commicie.
- Opcja `--json` wypisuje wynik jako JSON. Opcja `--help` wypisuje krótką instrukcję.
- Walidatory niczego nie zmieniają w plikach.

### Format wyniku

Każda niezgodność zajmuje dwie albo trzy linie:

```text
docs/processes/BFS-001/contracts/int-002.md:20  BŁĄD  CONS-01 ta sama informacja w dwóch miejscach  (INT-002)
  INT-002 ma wpis realizes CAP-001, a pole „Zdolność” go nie wymienia.
  Naprawa: Dopisz CAP-001 w polu „Zdolność”.
```

1. Pierwsza linia: ścieżka pliku z numerem linii, poziom (`BŁĄD` albo `OSTRZEŻENIE`), kod i nazwa sprawdzenia, doc-id dokumentu.
2. Druga linia: opis niezgodności.
3. Trzecia linia: sugestia naprawy. Walidator wypisuje ją zawsze wtedy, gdy naprawa jest jednoznaczna. Gdy poprawić można na kilka sposobów, na przykład usunąć wzmiankę albo dopisać brakujący dokument, tej linii nie ma.

Na końcu jest podsumowanie: liczba dokumentów, błędów i ostrzeżeń. Pod nim
mogą być uwagi, na przykład o sprawdzeniu pominiętym z braku repozytorium git.

Wynik JSON ma pola `documents`, `errors`, `warnings`, `notes` i `findings`.
Każdy element `findings` ma pola `file`, `line`, `docId`, `severity` (`error`
albo `warning`), `code`, `check`, `message` i `fix` (`null`, gdy naprawa nie
jest jednoznaczna).

### Kod wyjścia

| Kod | Znaczenie |
|---|---|
| 0 | Nie ma błędów. Mogą być ostrzeżenia. |
| 1 | Jest co najmniej jeden błąd. |
| 2 | Skrypt został źle wywołany, podana ścieżka nie istnieje albo nie da się odczytać matrycy lub szablonów. |

## validate-relations.js

| Kod | Sprawdzenie | Poziom | Sugestia naprawy |
|---|---|---|---|
| REL-01 | Pole `relations` zgadza się z wzmiankami w treści. To te same niezgodności, które wypisuje [sync-relations.js](#sync-relationsjs). | błąd | Dla niezgodności `DO NAPRAWY`: uruchomienie `sync-relations.js --fix`. Dla wzmianki o dokumencie wskazującym: usunięcie wzmianki. Dla wiersza bez prefiksu: pełne ID, gdy dokument wskazuje dokładnie jeden dokument z takim wierszem. |
| REL-02 | Cel wpisu istnieje. Wiersz istnieje, gdy jego dokument ma wpis `contains` ([methodology.md](../standards/methodology.md), sekcja 8). | błąd | Poprawny doc-id, gdy różni się tylko wielkością liter. |
| REL-03 | Wpisy spełniają liczebność z pola `cardinality` w matrycy. Przy `1:N` cel ma jedno źródło, na przykład encja należy do jednego LDM. Przy `N:1` źródło ma jeden cel, na przykład encja realizuje jedno pojęcie. | błąd | brak |
| REL-04 | Reguły z komentarza przy trójce `LDM realizes DOM`: pojęcia jednego LDM pochodzą z jednego DDM, encja realizuje tylko pojęcie swojego LDM, a regułę RD tylko z DDM swojego LDM. | błąd | brak |
| REL-05 | Dokument wskazuje encję i encję w niej zawartą. Matryca każe to zgłaszać jako ostrzeżenie, bo osobny obiekt w żądaniu jest dozwolony. | ostrzeżenie | brak |
| REL-06 | `doc-id` jest unikalny. | błąd | brak |
| REL-07 | Każdy dokument jest połączony z resztą grafu. Walidator zgłasza dokument bez powiązań i wyspę, czyli dokumenty połączone tylko ze sobą ([methodology.md](../standards/methodology.md), sekcja 4). Za resztę grafu uznaje największą grupę połączonych dokumentów. | błąd | brak |
| REL-08 | Numer wiersza REQ, RB, RD, NFRT i ROLE nie wraca do obiegu ([methodology.md](../standards/methodology.md), sekcja 3). | błąd | Kolejny wolny numer, na przykład `REQ-10`. |

### Jak działa sprawdzenie numerów (REL-08)

1. Walidator czyta z git wszystkie wersje plików `.md` z podanych folderów, od pierwszego commita do HEAD.
2. Dla każdego doc-id i każdej serii numerów zapamiętuje najwyższy numer z historii. Serią jest prefiks wiersza, a dla NFRT prefiks z kategorią, na przykład `NFRT-PERF`.
3. Wiersz jest nowy, gdy dokument ma go na dysku, a w HEAD go nie miał. Nowy wiersz musi mieć numer wyższy niż najwyższy numer z historii.

Przykład: `BFS-001` miał kiedyś `REQ-09`, a potem ten wiersz usunięto. Nowy
wiersz `REQ-07` jest błędem, a sugestia naprawy to `REQ-10`.

Historia jest liczona tylko dla podanych folderów. Plik przeniesiony spoza nich
wnosi historię dopiero od przeniesienia. Poza repozytorium git walidator pomija
REL-08 i pisze o tym w uwagach pod podsumowaniem.

## validate-form.js

| Kod | Sprawdzenie | Poziom | Sugestia naprawy |
|---|---|---|---|
| FORM-01 | Front matter ma pola z szablonu typu, bez pól spoza szablonu i bez powtórzeń. Plik, którego front matter nie da się odczytać, też trafia tutaj. | błąd | Dopisanie brakującego pola, usunięcie nadmiarowego albo zmiana nazwy, gdy brakuje dokładnie jednego pola i jest dokładnie jedno nadmiarowe. |
| FORM-02 | Pole z listą wartości ma wartość z tej listy. Listę podaje szablon: komentarz `# draft \| active` w front matter, komórka tabeli `tak / nie` albo linia `Polityka błędu: ponowienie / eskalacja / zatrzymanie`. | błąd | Wartość z listy, gdy różni się tylko wielkością liter. |
| FORM-03 | Dokument ma jeden nagłówek H1 oraz sekcje H2 i nagłówki H3 z szablonu, w kolejności z szablonu. | błąd; brak sekcji albo stałego nagłówka H3 to ostrzeżenie | Przeniesienie sekcji przed wskazaną sekcję, dodanie brakującej sekcji we wskazanym miejscu, poprawna nazwa nagłówka, gdy różni się tylko wielkością liter albo znakami interpunkcyjnymi. |
| FORM-04 | Tabele z szablonu: tabela jest w swojej sekcji, ma nagłówek z szablonu, a wiersz ma tyle komórek, ile kolumn. W tabeli „Pole \| Wartość” wiersze mają nazwy i kolejność z szablonu. | błąd; brak tabeli pod nagłówkiem H1 to ostrzeżenie | Nagłówek tabeli z szablonu, dodanie brakującego wiersza przed wskazanym wierszem, przeniesienie wiersza. |
| FORM-05 | Plik nosi doc-id małymi literami, na przykład `uc-001.md`. | błąd | Poprawna nazwa pliku. |
| FORM-06 | Plik leży w folderze wynikającym z relacji ([methodology.md](../standards/methodology.md), sekcja 11). | błąd | Ścieżka, do której trzeba przenieść plik. |

### Jak walidator czyta szablon

- Spis typów bierze z `standards/templates/_00-meta.md`, a formę każdego typu z jego `template.md`. Zmiana szablonu nie wymaga zmiany walidatora.
- Sekcja jest opcjonalna, gdy w szablonie ma komentarz HTML ze słowem „Opcjonalnie” albo „Opcjonalny”. Braku sekcji opcjonalnej walidator nie zgłasza. Komentarz o kolumnie opcjonalnej nie czyni sekcji opcjonalną.
- Kolumna tabeli jest opcjonalna, gdy w bloku tabeli (ta sama sekcja H2 i nagłówek H3) szablon ma komentarz HTML „Kolumna „X” opcjonalna”. Tabela może wtedy mieć nagłówek z tą kolumną albo bez niej, a pozostałe kolumny w kolejności z szablonu. Przykłady: tabela „Wyjście” kroku SPEC-WF ma kolumnę „Źródło” tylko w kroku `call-activity`, a tabele kroków UC mają kolumnę „Sekcja” tylko wtedy, gdy krok wskazuje sekcję ekranu.
- Brak innej sekcji jest ostrzeżeniem, bo warianty w `guide.md` pozwalają pominąć sekcje, a walidator nie wie, który wariant wybrał analityk. Przykład: wariant minimalny CAP ma tylko trzy sekcje.
- Nagłówek H3 z placeholderem, na przykład `### A1. {Nazwa wariantu}`, pasuje do dowolnego nagłówka tej postaci, na przykład `### A2. Zapis szkicu`. Takiego nagłówka walidator nie wymaga.
- Sekcja przyjmuje dowolne tabele, gdy w szablonie ma komentarz HTML ze słowami „dowolne tabele”. Walidator nie sprawdza wtedy tabel w tej sekcji ani pod jej nagłówkami H3: tabela może mieć dowolne kolumny i może jej nie być. Przykłady: sekcja „Zasady” konwencji, w której każda zasada ma własną tabelę, i sekcja „Nagłówek komunikatu” zdarzenia, w której tabela nagłówków własnych pojawia się tylko wtedy, gdy zdarzenie je ma.
- Wartość z listy może mieć dopisek: `tak przy składaniu; nie przy korekcie` pasuje do listy `tak / nie`, bo zaczyna się od `tak`. Nie pasuje wartość `takie` ani `Tak`.

### Jak walidator wylicza folder (FORM-06)

Folder dokumentacji to folder, w którym leżą `processes/` i `shared/`.
Proces dokumentu walidator wylicza z relacji według sekcji 11 metodyki.
Przykład: UC realizuje wiersze `BFS-001`, więc leży w
`processes/BFS-001/scenarios/`. Aktywność leży w `activities/` procesu
przepływów, które ją zawierają, a aktywność przepływów kilku procesów
w `shared/activities/`. ACTOR, NFR i konwencja CONV leżą w folderach
wspólnych: `shared/actors/`, `shared/nfr/` i `shared/conventions/`.

Walidator nie zgłasza folderu, gdy relacje nie wyznaczają jednego miejsca.
Przykłady: UC realizuje wiersze dwóch BFS, sekcji ekranu nie zawiera żaden
ekran, aktywności nie zawiera żaden przepływ, encja nie należy do żadnego LDM.

## validate-consistency.js

| Kod | Sprawdzenie | Poziom | Sugestia naprawy |
|---|---|---|---|
| CONS-01 | Cel każdego wpisu `relations` jest wymieniony w miejscu, w którym szablon każe go podać, na przykład wpis `realizes CAP-001` w polu „Zdolność”. Pola „BFS” w UC i TUC, „Źródło DDM” w LDM oraz „ID” w LDM i ENT mają wartość wynikającą z wpisów albo z doc-id. | błąd | Dopisanie celu we wskazanym polu, kolumnie, sekcji albo nagłówku. Wartość pola wyliczona z wpisów. |
| CONS-02 | UC, TUC, API i INT nie wskazują progu NFR, który ma już ich zdolność (`guide.md` typów use-case, technical-use-case, api i integration). | błąd | Usunięcie wzmianek o progu we wskazanych liniach i uruchomienie `sync-relations.js --fix`. |
| CONS-03 | Krok SPEC-WF z `task-type: user-task` ma rolę (`involves ROLE`), a co najmniej jedno API wskazuje go wpisem `consumes`, bo człowiek przypisuje, odkłada i kończy krok tylko przez API (`guide.md` typu workflow-step; reguła 10 w `relation-matrix.yaml`). | błąd | Wpisanie ID kroku w sekcji „Zachowanie” API, które kończy krok, albo ID roli w polu „Aktor / serwis”. |
| CONS-04 | API nie wskazuje INT ani BPMN, które woła już jego przepływ (`relation-matrix.yaml`, „Który dokument zapisuje wywołanie”; `guide.md` typu api). | błąd | Usunięcie wzmianek o wywołaniu we wskazanych liniach i uruchomienie `sync-relations.js --fix`. |

### Miejsca celów wpisów (CONS-01)

Miejsca zapisuje tablica `PLACES` w skrypcie. Każde miejsce wynika z komentarzy
w [relation-matrix.yaml](../standards/config/relation-matrix.yaml) i z szablonu
typu. Przykłady:

| Wpis | Miejsce w treści |
|---|---|
| UC `consumes` API, QUE | kolumna „Wywołanie” w sekcjach „Kroki”, „Co może pójść inaczej” i „Co może pójść nie tak” |
| UC `contains` SCRSEC | kolumna „Sekcja” w tych samych sekcjach |
| TUC `consumes` API, INT, QUE | kolumna „Wywołanie” albo pole „Trigger” |
| API `consumes` FLOW, BPMN, SPEC-WF | sekcja „Zachowanie” |
| UC, TUC `realizes` REQ | pole „Powiązane REQ” i kolumna „ID z BFS” w sekcji „Powiązanie z BFS”; oba miejsca muszą wymienić każdy wiersz |
| SPEC-WF `consumes` SPEC-WF | kolumna „Źródło” w sekcji „Zmienne procesowe”: w tabeli „Wejście”, a w kroku `call-activity` także „Wyjście” |
| ENT `contains` ENT | kolumna „Encja docelowa” w wierszach z relacją „zawiera” w sekcji „Powiązania” |
| BFS `contains` REQ | kolumna „ID” w sekcji „Wymagania funkcjonalne” |

Walidator pomija miejsce, którego nie ma w dokumencie. Brak sekcji albo pola
zgłasza `validate-form.js`.

Nowy typ dokumentu albo nowe miejsce w szablonie wymaga dopisania wiersza
w tablicy `PLACES`.

## knowledge-index

Indeks dokumentacji w bazie SQLite. Odpowiada na pytanie, które pliki trzeba
przeczytać, i zwraca ich ścieżki oraz nazwy. Nie trzeba przeszukiwać folderów
ani czytać plików, żeby znaleźć powiązane dokumenty.

Baza trzyma tylko front matter: `doc-id`, `title`, `description`, `status`
i wpisy `relations`. Treści dokumentów w bazie nie ma. Wymaga Node.js 22.5 albo
nowszego, bo korzysta z wbudowanego modułu `node:sqlite`.

Jak indeks działa w środku, opisuje plik
[knowledge-index/README.md](knowledge-index/README.md).

Baza leży w pliku `node_modules/.cache/knowledge-index.db`. Folder
`node_modules` nie trafia do repozytorium. Plik bazy można skasować w każdej
chwili, a następne uruchomienie zbuduje go od nowa.

### Uruchomienie

Każde polecenie wymaga opcji `--root`, czyli folderu z dokumentacją.

```bash
node scripts/knowledge-index/cli.js sync --root standards/examples
```

```bash
node scripts/knowledge-index/cli.js scope BFS-001.REQ-01 --root standards/examples
```

| Polecenie | Co robi |
|---|---|
| `sync` | Synchronizuje bazę z folderem i wypisuje liczby plików oraz pliki z błędem front matter. |
| `find <tekst>` | Szuka dokumentów. Tekst może być identyfikatorem (`UC-001`, `BFS-001.REQ-01`), typem dokumentu (`API` zwraca wszystkie API) albo słowami. Słowa są szukane w doc-id, `title` i `description`, od początku słowa, bez rozróżniania wielkości liter i polskich znaków: `obsluga` znajduje „Obsługa”. |
| `describe <ID>` | Opisuje dokument albo wiersz: plik, tytuł, opis, wpisy `relations` i wpisy innych dokumentów, które go wskazują. |
| `scope <ID> [ID …]` | Zapytanie `change_scope`: pliki do przejrzenia, gdy zmieniam podane węzły. |
| `impl <ID> [ID …]` | Zapytanie `implementation`: pliki do przeczytania, zanim zbuduję to, co opisują podane węzły. |

| Opcja | Znaczenie |
|---|---|
| `--root <folder>` | Folder z dokumentacją. Wymagana. |
| `--db <plik>` | Inny plik bazy. |
| `--type <TYP>` | Tylko dla `find`: wynik ograniczony do typu dokumentu. |
| `--limit <liczba>` | Tylko dla `find`: liczba wyników, domyślnie 20. |
| `--json` | Wynik jako JSON. |

### Jak działa synchronizacja

Każde polecenie najpierw synchronizuje bazę z folderem:

1. Skrypt liczy skrót treści (hash) każdego pliku `.md` w folderze. Pomija foldery, których nazwa zaczyna się od kropki, i folder `node_modules`.
2. Plik o tym samym skrócie co w bazie jest pomijany. Plik nowy albo zmieniony jest czytany ponownie, a jego wiersze w bazie są podmieniane.
3. Plik, którego nie ma już w folderze, jest usuwany z bazy.

Cała baza jest budowana od nowa, gdy zmieni się folder podany w `--root`,
matryca relacji, `lib/ids.js` albo `lib/documents.js`. Wzorce zapytań skrypt
czyta przy każdym uruchomieniu, więc ich zmiana nie wymaga przebudowy.

### Co wypisuje zapytanie

Wynik jest pogrupowany według plików. Pod każdym plikiem są węzły z tego
pliku i droga, którą zapytanie do nich doszło:

```text
change_scope dla BFS-001.REQ-01: węzły 14, pliki 14.

standards/examples/processes/BFS-001/bfs-001.md
  BFS-001.REQ-01  węzeł startowy
standards/examples/processes/BFS-001/scenarios/uc-001.md
  UC-001  przez: BFS-001.REQ-01 <-realizes- UC-001
standards/examples/processes/BFS-001/contracts/api-001.md
  API-001  przez: BFS-001.REQ-01 <-realizes- UC-001 -consumes-> API-001
```

- Węzeł startowy też jest w wyniku.
- Wiersz, na przykład `BFS-001.REQ-01`, wskazuje plik swojego dokumentu.
- Droga „przez” jest zapisana tak jak wzorce w `query-patterns.yaml`. `BFS-001.REQ-01 <-realizes- UC-001` oznacza, że `UC-001` ma wpis `realizes BFS-001.REQ-01`.
- Gdy do węzła prowadzi kilka dróg, wynik pokazuje pierwszą znalezioną.

Wynik JSON ma pola:

- `query` i `starts`: nazwa zapytania i węzły startowe.
- `missing`: węzły startowe, których nie ma w dokumentacji.
- `nodes`: każdy węzeł z polami `node`, `type`, `docId`, `title`, `path` (folder), `fileName`, `via` i `pattern`. Pole `pattern` to wzorzec drogi, a dla węzła startowego ma wartość `null`.
- `files`: pliki z polami `path`, `fileName`, `docId`, `title` i `nodes`. Każdy element `nodes` ma pola `node`, `type` i `via`.

### Kod wyjścia

| Kod | Znaczenie |
|---|---|
| 0 | Polecenie zostało wykonane. |
| 1 | Węzła podanego w `describe`, `scope` albo `impl` nie ma w dokumentacji. |
| 2 | Skrypt został źle wywołany, folder nie istnieje albo nie da się odczytać matrycy lub wzorców. |

### Serwer MCP

Serwer udostępnia indeks agentom AI. Działa przez stdio i nie wymaga żadnych
pakietów. Jest zarejestrowany w dwóch plikach:

| Plik | Klient |
|---|---|
| `.mcp.json` | Claude Code |
| `.vscode/mcp.json` | GitHub Copilot w VS Code |

W obu plikach argument `--root` wskazuje folder z dokumentacją. Folder jest
liczony względem folderu repozytorium, a nie folderu, z którego klient
uruchomił serwer. Gdy dokumentacja trafi do innego folderu, trzeba zmienić
`--root` w obu plikach.

Serwer można też uruchomić ręcznie:

```bash
node scripts/knowledge-index/mcp-server.js --root standards/examples
```

| Narzędzie | Argumenty | Co zwraca |
|---|---|---|
| `find_document` | `query`, opcjonalnie `type` i `limit` | dokumenty, tak jak polecenie `find` |
| `describe_node` | `id` | opis węzła, tak jak polecenie `describe` |
| `change_scope` | `ids`: lista identyfikatorów | pola `query`, `starts`, `missing` i `files` z wyniku zapytania |
| `implementation` | `ids`: lista identyfikatorów | to samo dla zapytania `implementation` |
| `reindex` | opcjonalnie `full` | liczby plików z synchronizacji i pliki z błędem front matter; `full: true` buduje bazę od nowa |

- Przed każdym wywołaniem narzędzia serwer synchronizuje bazę, więc odpowiedź uwzględnia pliki zmienione chwilę wcześniej. Narzędzie `reindex` nie jest do tego potrzebne.
- Wynik zapytania nie ma pola `nodes`. Te same węzły są w `files`, więc agent nie dostaje tych samych danych dwa razy.
- Błąd, na przykład zły argument albo folder, którego nie ma, wraca jako wynik narzędzia z opisem błędu. Serwer działa dalej.
- Komunikaty diagnostyczne serwer wypisuje na stderr.

### Budowa

| Plik | Zawartość |
|---|---|
| `knowledge-index/store.js` | schemat bazy, zapis i usuwanie plików |
| `knowledge-index/sync.js` | synchronizacja bazy z folderem |
| `knowledge-index/index.js` | fasada: otwarcie i synchronizacja bazy, zapytania, wyszukiwanie, opis węzła |
| `knowledge-index/cli.js` | wiersz poleceń |
| `knowledge-index/mcp-server.js` | serwer MCP |

Zapytania wykonuje `lib/query.js`. Ten sam kod działa na grafie w pamięci
i na bazie.
