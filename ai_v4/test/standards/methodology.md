# Metodyka dokumentacji

Dokumentacja projektowa jest grafem, czyli siecią powiązanych elementów.
Elementem sieci (węzłem) jest dokument albo pojedynczy wiersz w dokumencie,
który ma własny identyfikator lokalny. Powiązaniem między dwoma węzłami
(krawędzią) jest wpis w polu `relations` dokumentu.

Ten plik opisuje zasady. Szczegóły są w plikach wymienionych w tabeli.

| Plik | Zawartość |
|---|---|
| `config/relation-matrix.yaml` | Matryca relacji. Zawiera listę typów relacji, listę dozwolonych trójek (źródło, relacja, cel), regułę o wzmiankach identyfikatorów w treści oraz reguły walidatora dla poszczególnych trójek. |
| `config/query-patterns.yaml` | Wzorce dwóch zapytań do grafu: `change_scope` (zasięg zmiany) i `implementation` (co przeczytać, żeby zbudować element). |
| `templates/` | Dla każdego typu dokumentu czysty szablon i opis, jak z niego korzystać. Spis wszystkich szablonów jest w pliku `templates/_00-meta.md`. |
| `examples/documentation-corpus.yaml` | Korpus testowy, czyli zbiór przykładowych dokumentów. Z niego pochodzą wszystkie przykłady w tym pliku. |

## Pojęcia używane w tym pliku

- **Front matter** to blok YAML na początku pliku Markdown. Zawiera między innymi `doc-id`, `title`, `status` i `relations`.
- **doc-id** to identyfikator dokumentu, na przykład `UC-001`. Prefiks przed myślnikiem (tutaj `UC`) określa typ dokumentu.
- **Identyfikator lokalny** to identyfikator wiersza wewnątrz dokumentu, na przykład wymagania `REQ-01` w dokumencie `BFS-001`.
- **Trójka** to zapis jednego powiązania: typ dokumentu źródłowego, rodzaj relacji i typ celu. Na przykład trójka „UC realizes REQ” oznacza, że scenariusz użycia może wskazać wymaganie, które realizuje.
- **Źródło** to dokument, który ma wpis relacji. **Cel** to dokument albo wiersz, który ten wpis wskazuje.
- **Walidator** to program, który sprawdza strukturę grafu. Listę sprawdzeń zawiera sekcja 8.
- **Zapytanie** przechodzi po relacjach od wybranego węzła do kolejnych i zbiera powiązane dokumenty. Wzorce zapytań są w pliku `config/query-patterns.yaml`.

## 1. Pole `relations`

Relacje dokumentu są zapisane w polu `relations` w front matter. Pole to lista
wpisów. Każdy wpis ma dwa klucze: `type` (rodzaj relacji) i `target` (cel).

Rodzaju relacji się nie wybiera. Wynika on z pary typów: typu dokumentu
źródłowego i typu celu. Dla każdej takiej pary plik `relation-matrix.yaml`
podaje dokładnie jeden rodzaj relacji.

Poniżej jest fragment front matter scenariusza `UC-001`:

```yaml
doc-id: UC-001
title: Złożenie dyspozycji
status: draft
relations:            # fragment
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

Wpis zawiera tylko samo powiązanie. Opis powiązania i liczebność, czyli ile
elementów jest po każdej stronie, zostają w treści dokumentu. Przykład: encja
`ENT-Disposition` ma wpis `contains ENT-DispositionItem`. To, że jedna
dyspozycja ma wiele pozycji, opisuje treść encji, a nie wpis.

## 2. Kto zapisuje relację

Relację zapisuje tylko dokument, który jest źródłem trójki. Cel nie ma wpisu
w drugą stronę. Relację odwrotną wylicza graf. Przykład: `UC-001` ma wpis
`realizes BFS-001.REQ-01`, a `BFS-001` nie ma żadnego wpisu, który wskazuje
`UC-001`.

Z tego wynika, że nowy scenariusz w procesie `BFS-001` zapisuje relacje tylko
we własnym pliku. Dokumenty `BFS-001`, `CAP-001` i `ACTOR-001` nie dostają
nowych wpisów.

Jeśli dokument wspomina w treści identyfikator innego dokumentu albo wiersza,
ta relacja musi być zapisana w tym dokumencie. Pełny opis tej reguły jest
w nagłówku pliku `relation-matrix.yaml`, w części „Wzmianki o identyfikatorach
w treści”.

## 3. Identyfikatory

`doc-id` musi być unikalny w całej dokumentacji, bez względu na typ dokumentu.
Tę regułę opisuje też nagłówek pliku `relation-matrix.yaml`.

Identyfikator lokalny oznacza wiersz dokumentu. Wiersz nie ma własnego pliku
ani front matter, więc sam nie może zapisać relacji. Dokument, w którym leży
wiersz, zapisuje go samym identyfikatorem. Inne dokumenty wskazują wiersz
pełnym identyfikatorem, czyli z doc-id dokumentu i kropką na początku:

```text
BFS-001 ma wpis contains REQ-01
UC-001  ma wpis realizes BFS-001.REQ-01
```

Tabela pokazuje wszystkie rodzaje wierszy. Kolumna „Zawiera go” podaje typ
dokumentu, w którym wiersz leży.

| Prefiks | Wiersz | Zawiera go | Pełne ID |
|---|---|---|---|
| REQ | wymaganie funkcjonalne | BFS | `BFS-001.REQ-01` |
| RB | reguła biznesowa | BFS | `BFS-001.RB-01` |
| DOM | pojęcie domenowe | DDM | `DDM-001.DOM-Dyspozycja` |
| RD | reguła i niezmiennik domenowy | DDM | `DDM-001.RD-001` |
| RW | reguła walidacyjna | ENT | `ENT-Disposition.RW-001` |
| NFRT | wiersz macierzy wymagań jakościowych | NFR | `NFR-001.NFRT-PERF-01` |
| ROLE | rola aktora | ACTOR | `ACTOR-001.ROLE-01` |
| AC | kryterium akceptacji | SPEC-WF | `SPEC-WF-001.AC-01` |
| A | wariant przebiegu | UC, TUC | `UC-001.A1` |
| E | sytuacja błędna | UC, TUC | `UC-001.E1` |

Numerów wierszy REQ, RB, RD, NFRT i ROLE nie używa się ponownie, bo inne
dokumenty mają wpisy, które wskazują te wiersze. Nowy wiersz dostaje kolejny
wolny numer, także wtedy, gdy wcześniejszy wiersz usunięto. Przykład: jeśli
ostatnim wymaganiem w `BFS-001` było `REQ-05`, następne wymaganie to `REQ-06`.
Usunięty wiersz znika z dokumentu, a jego historię przechowuje repozytorium.

## 4. Spójność grafu

Do każdego dokumentu i każdego wiersza musi prowadzić jakieś powiązanie
z resztą grafu. Kierunek powiązania nie ma znaczenia.

Dokument bez własnych wpisów jest poprawny, jeśli wskazuje go inny dokument.
Przykład: aktywność `ACT-002` „Zapis dyspozycji” nie ma wpisów, ale przepływ
`FLOW-001` ma wpis `contains ACT-002`.

Walidator zgłasza błąd w dwóch przypadkach:

1. Węzeł nie ma żadnego powiązania.
2. Grupa dokumentów jest powiązana tylko ze sobą i nie ma powiązania z resztą grafu. Taką grupę nazywamy wyspą.

## 5. Zakres BFS

BFS (specyfikacja biznesowo-funkcjonalna) opisuje jeden proces. Proces ma
jeden początek i jeden koniec. Koniec może mieć kilka wariantów.

Przykład: `BFS-001` „Obsługa dyspozycji” obejmuje złożenie dyspozycji
(`UC-001`), jej korektę (`UC-002`), nocne rozliczenie (`TUC-001`) i ponowienie
nieudanych dyspozycji (`TUC-002`). Reklamacja zaczyna się od osobnego
zgłoszenia (`UC-003`), więc ma własny dokument `BFS-002` „Reklamacje
dyspozycji”.

Oba procesy korzystają z jednego domenowego modelu danych `DDM-001` „Domena
dyspozycji”. Encja `ENT-Disposition` realizuje pojęcie `DOM-Dyspozycja`,
a encja `ENT-Complaint` realizuje pojęcie `DOM-Reklamacja`.

BFS nie dzieli się według iteracji, ścieżek ani komponentów:

- Iterację, na przykład MVP (pierwszą, najmniejszą działającą wersję produktu), opisuje zakres BFS.
- Ścieżki przebiegu opisują warianty A i sytuacje błędne E w scenariuszu UC lub TUC.
- Komponenty opisują dokumenty zdolności CAP.

## 6. Zmiana dokumentu

Zmianę dokumentu wykonuje się w tej kolejności:

1. Uruchom zapytanie `change_scope` dla zmienianego węzła. Wzorce tego zapytania są w pliku `query-patterns.yaml`. Wynik zapytania wyznacza zakres zgłoszenia.
2. Popraw treść w plikach, które zwróciło zapytanie.
3. Usuń relacje i wiersze, które mają zniknąć.
4. Uruchom walidator.

Relacje usuwa się na końcu, bo zapytanie przechodzi po relacjach. Przykład:
zapytanie `change_scope` dla wiersza `BFS-001.REQ-01` zaczyna od `UC-001`, bo
tylko ten scenariusz ma wpis `realizes BFS-001.REQ-01`. Jeśli ten wpis zostanie
usunięty wcześniej, zapytanie nie dojdzie do `UC-001`. Nie dojdzie też dalej,
do API, ekranów i zdolności tego scenariusza.

## 7. Dokumenty wskazujące

Dokument nie wymienia w swojej treści dokumentów, które go wskazują. Taką listę
wylicza graf z wpisów tych dokumentów. Przykład: zapytanie `change_scope` dla
zdolności `CAP-004` zwraca UC-003, UC-004 i API-004.

Ta zasada dotyczy także dokumentu, który zawiera dany dokument albo go
wywołuje. Przykłady:

- Sekcja ekranu SCRSEC-001 nie wymienia ekranu SCR-001.
- Krok SPEC-WF-001 nie wymienia procesu BPMN-001.
- Krok SPEC-WF-005 nie wymienia API-015 i API-008, które go przypisują i kończą, ani ekranu SCR-005, z którego człowiek wywołuje te API.
- Przepływ FLOW-001 nie wymienia API-001, które z niego korzysta.
- Aktywność ACT-001 nie wymienia przepływów FLOW-001 i FLOW-002, które ją zawierają.
- Zdarzenie QUE-001 nie wymienia scenariusza UC-001, który publikuje to zdarzenie.

Tabela pokazuje listy, których nie pisze się ręcznie, i skąd graf je wylicza.

| Lista | Źródło w grafie | Przykład z korpusu |
|---|---|---|
| udział ról w scenariuszach | wpisy `involves`, które wskazują rolę | `ACTOR-001.ROLE-02`: UC-003, UC-004, UC-011, UC-015, UC-020, UC-024, UC-025 |
| zakres zdolności | wpisy `realizes`, które wskazują CAP | `CAP-004`: UC-003, UC-004, API-004 |
| lista „wskazywany przez” | wszystkie wpisy, które wskazują dokument albo jego wiersz | `NFR-001.NFRT-PERF-01`: BFS-001, BFS-003, BFS-006, API-001, API-010, API-016 |

## 8. Walidator

Walidator uruchamia się przy każdym scaleniu zmian w repozytorium. Ma dwa
tryby. Na początku działa w trybie ostrzegawczym, czyli zgłasza problemy, ale
nie blokuje scalenia. Gdy dokumentacja się ustabilizuje, przechodzi w tryb
blokujący, czyli nie pozwala scalić zmian z błędami.

Walidator sprawdza, czy:

1. Rodzaj relacji jest na liście `relation_types`.
2. Trójka (typ źródła, relacja, typ celu) jest w matrycy relacji.
3. Cel istnieje. Jeśli nie istnieje, walidator zgłasza błąd „cel nie istnieje”. Wiersz istnieje wtedy, gdy dokument o doc-id z pełnego identyfikatora ma wpis `contains` dla tego wiersza. Przykład: `BFS-001.REQ-01` istnieje, bo `BFS-001` ma wpis `contains REQ-01`.
4. Każda wzmianka o identyfikatorze w treści ma relację. Regułę opisuje nagłówek pliku `relation-matrix.yaml`.
5. `doc-id` jest unikalny.
6. Do każdego węzła prowadzi powiązanie z resztą grafu, zgodnie z sekcją 4.
7. Numery wierszy REQ, RB, RD, NFRT i ROLE nie są użyte ponownie.

Reguły dotyczące pojedynczych trójek są w komentarzach w pliku
`relation-matrix.yaml`.

## 9. Co ocenia analityk

Walidator sprawdza strukturę grafu, ale nie sprawdza, czy treść ma sens. Tę
ocenę wykonuje analityk. Analityk odpowiada na pytania:

- Gdzie kończy się proces? Czy to jeden BFS, czy kilka?
- Czy treść wymagań REQ, reguł biznesowych RB i reguł domenowych RD jest poprawna? Czy definicje pojęć DOM są poprawne?
- Czy odpowiedzialność jest dobrze podzielona między zdolności CAP?
- Czy kryteria akceptacji AC są poprawne?
- Czy zmiana wiersza to edycja istniejącego wiersza, czy nowy wiersz z nowym numerem?
- Czy scenariusz opisuje to, co system rzeczywiście robi?
- Czy dokument wspomina każdy identyfikator, od którego zależy? Rodzaj relacji wynika z pary typów, ale tylko analityk wie, że dane API korzysta z danej encji.

## 10. Typy dokumentów

Typ dokumentu wynika z prefiksu `doc-id`. Szablon typu jest w pliku
`templates/{szablon}/template.md`, a opis, jak z niego korzystać, w pliku
`templates/{szablon}/guide.md`. W miejsce `{szablon}` wstaw nazwę z kolumny
„Szablon”, na przykład `templates/use-case/`.

### Wymagania

Te dokumenty opisują, co ma działać i jakie progi jakości system musi spełnić.

| Prefiks | Szablon | Dokument |
|---|---|---|
| BFS | business-functional-spec | wymagania i reguły jednego procesu |
| NFR | non-functional-requirements | wymagania jakościowe |

### Odpowiedzialność

Te dokumenty opisują, kto za co odpowiada: role aktorów i komponenty.

| Prefiks | Szablon | Dokument |
|---|---|---|
| ACTOR | actor | wspólna baza aktorów |
| CAP | capability | zakres odpowiedzialności komponentu |

### Scenariusze

Te dokumenty opisują cel aktora i kroki, które prowadzą do tego celu.

| Prefiks | Szablon | Dokument |
|---|---|---|
| UC | use-case | scenariusz działania użytkownika |
| TUC | technical-use-case | scenariusz uruchamiany automatycznie |

### Ekrany

Te dokumenty opisują to, co użytkownik widzi i wypełnia.

| Prefiks | Szablon | Dokument |
|---|---|---|
| SCR | screen | ekran |
| SCRSEC | screen-section | sekcja ekranu |

### Kontrakty

Te dokumenty opisują format i zasady komunikacji z elementem systemu.
Kontrakt wskazuje konwencję CONV, którą stosuje: `API-009 applies CONV-001`.

| Prefiks | Szablon | Dokument |
|---|---|---|
| API | api | punkt końcowy |
| INT | integration | integracja z systemem zewnętrznym |
| QUE | event | kontrakt zdarzenia publikowanego przez brokera |
| CONV | convention | konwencja: zasady wspólne dla wielu kontraktów |

### Przepływy

Te dokumenty opisują kolejność kroków i wywołań. Przepływ FLOW zawiera
aktywności ACT. Proces BPMN w silniku Workflow zawiera kroki SPEC-WF.

| Prefiks | Szablon | Dokument |
|---|---|---|
| FLOW | flow | przepływ biznesowy lub techniczny |
| ACT | activity | aktywność przepływu |
| BPMN | bpmn-process | proces w silniku Workflow |
| SPEC-WF | workflow-step | krok procesu BPMN |

### Pojęcia i dane

Te dokumenty opisują, co znaczy pojęcie, jak wygląda w danych i jakie ma stany.

| Prefiks | Szablon | Dokument |
|---|---|---|
| DDM | ddm | domenowy model danych: znaczenie pojęć |
| LDM | ldm | logiczny model danych: indeks encji obszaru |
| ENT | ldm-entity | encja modelu logicznego |
| STM | state-machine | maszyna stanów: cykl życia obiektu |

### Mapy

Te dokumenty zestawiają inne dokumenty: powiązania między scenariuszami
i przejścia między ekranami.

| Prefiks | Szablon | Dokument |
|---|---|---|
| UCMAP | use-case-technical-map | mapa relacji między UC i TUC |
| NAV | navigation-map | mapa nawigacyjna ekranów |

## 11. Układ katalogów

Folder dokumentu zależy od tego, czym jest dokument. Nie zależy od tego, ile
procesów go używa. Relacje i zapytania posługują się doc-id, więc miejsce
pliku nie zmienia ich wyniku.

Schemat folderów. Po prawej stronie są typy dokumentów, które leżą w danym
folderze:

```text
processes/
  BFS-001/              BFS
    capabilities/       CAP
    scenarios/          UC, TUC
    screens/
      SCR-001/          SCR
        sections/       SCRSEC tylko tego ekranu
      shared/           SCRSEC kilku ekranów procesu
    contracts/          API, INT, QUE
    flows/              STM, które nie realizują pojęcia domenowego
      FLOW-001/         FLOW
      BPMN-001/         BPMN
        steps/          SPEC-WF
    activities/         ACT przepływów procesu
    maps/               NAV, UCMAP
shared/
  actors/               ACTOR
  nfr/                  NFR
  conventions/          CONV
  maps/                 UCMAP ze scenariuszami kilku procesów
  activities/           ACT przepływów kilku procesów
  domains/
    DDM-001/            DDM oraz LDM, ENT i STM pojęć tej domeny
```

### Nazwy plików i folderów

Plik dokumentu ma nazwę równą doc-id zapisanemu małymi literami, na przykład
`uc-001.md`, `spec-wf-003.md`, `ent-disposition.md`. Folder nazwany od
dokumentu ma nazwę równą doc-id bez zmiany wielkości liter, na przykład
`BFS-001/`, `SCR-001/`, `DDM-001/`.

### Do którego procesu należy dokument

Folder procesu ma nazwę równą doc-id dokumentu BFS. Dokument leży w folderze
procesu, do którego należy. Proces ustala się tak:

1. UC i TUC należą do procesu BFS, którego wymagania realizują. Przykład: `UC-001 realizes BFS-001.REQ-01`.
2. CAP należy do procesu scenariuszy, które realizują tę zdolność. Przykład: `UC-001 realizes CAP-001`.
3. API, INT, QUE, FLOW, BPMN oraz STM, które nie realizują pojęcia domenowego, należą do procesu zdolności, którą realizują. Przykład: `QUE-010 realizes CAP-010`, więc QUE-010 leży w `processes/BFS-003/contracts/`. Drugi przykład: `STM-013 realizes CAP-020`, więc STM-013 (cykl życia sesji) leży w `processes/BFS-008/flows/`.
4. SCR, SCRSEC, ACT i SPEC-WF należą do procesu dokumentu, który je zawiera. Przykłady: `UC-001 contains SCR-001`, `BPMN-001 contains SPEC-WF-003`.
5. NAV i UCMAP należą do procesu dokumentów, które zestawiają.

Dokument, którego używa inny proces, zostaje w swoim procesie. Przykład:
CAP-012 z procesu BFS-004 ma wpis `consumes QUE-010`, a QUE-010 nadal leży
w folderze BFS-003.

Wyjątkiem jest mapa scenariuszy, które należą do kilku procesów. Taka mapa
leży w `shared/maps/`. Przykład: UCMAP-001 zestawia UC-001 i UC-002 z BFS-001
oraz UC-003 i UC-004 z BFS-002.

Drugim wyjątkiem jest aktywność, którą zawierają przepływy kilku procesów.
Taka aktywność leży w `shared/activities/`.

### Folder ekranu

Folder ekranu ma nazwę równą doc-id dokumentu SCR. Leży w nim dokument SCR,
a w podfolderze `sections/` leżą sekcje, które zawiera tylko ten ekran.
Przykład: `SCR-003 contains SCRSEC-004`, więc SCRSEC-004 leży
w `screens/SCR-003/sections/`.

Sekcja, którą zawiera kilka ekranów tego samego procesu, leży
w `screens/shared/`. Przykład: SCRSEC-001 zawierają ekrany SCR-001 i SCR-003,
więc sekcja leży w `processes/BFS-001/screens/shared/`.

### Folder przepływu

Folder przepływu ma nazwę równą doc-id dokumentu FLOW. Leży w nim dokument
FLOW. Przykład: FLOW-002 leży w `flows/FLOW-002/`.

### Folder aktywności

Aktywność leży w folderze `activities/` procesu, do którego należą
przepływy, które ją zawierają. Nie leży przy przepływie, bo może należeć do
kilku przepływów. Gdy kolejny przepływ tego procesu zacznie ją zawierać, plik
zostaje na miejscu. Przykład: ACT-001 zawierają przepływy FLOW-001 i FLOW-002
z procesu BFS-001, więc aktywność leży w `processes/BFS-001/activities/`.

### Folder procesu BPMN

Folder procesu BPMN ma nazwę równą doc-id dokumentu BPMN. Leży w nim dokument
BPMN, a w podfolderze `steps/` leżą jego kroki. Przykład:
`BPMN-001 contains SPEC-WF-003`, więc SPEC-WF-003 leży
w `flows/BPMN-001/steps/`.

### Folder domeny

Folder domeny ma nazwę równą doc-id dokumentu DDM. Leżą w nim:

1. dokument DDM,
2. modele LDM, które realizują pojęcia tego DDM,
3. encje ENT tych modeli LDM,
4. maszyny stanów STM, które realizują pojęcia tego DDM.

Encja leży przy swoim modelu LDM także wtedy, gdy używa jej tylko jeden
proces. Przykład: ENT-Complaint jest używana tylko w BFS-002, ale leży
w `shared/domains/DDM-001/`, bo `LDM-001 contains ENT-Complaint`.

### Dokumenty wspólne

Dokumenty ACTOR leżą w `shared/actors/`, dokumenty NFR w `shared/nfr/`,
a konwencje CONV w `shared/conventions/`. Konwencja leży tam także wtedy, gdy
stosują ją kontrakty jednego procesu.
