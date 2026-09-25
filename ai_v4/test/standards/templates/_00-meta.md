# Szablony dokumentów

Jeden folder to jeden typ dokumentu; typ wynika z prefiksu `doc-id`.
W folderze leżą dwa pliki:

| Plik | Zawartość |
|---|---|
| `template.md` | czysty szablon: front matter i sekcje do skopiowania |
| `guide.md` | opis działania: czym jest dokument, kiedy go użyć, co trzeba wiedzieć, warianty |

Zasady grafu: [../methodology.md](../methodology.md), dozwolone relacje:
[../config/relation-matrix.yaml](../config/relation-matrix.yaml).

## Spis treści

### Wymagania

Co ma działać i jakie progi jakości spełnić.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `business-functional-spec` | [szablon](business-functional-spec/template.md), [opis](business-functional-spec/guide.md) | BFS | Punkt wejścia do analizy systemowej (praca przyrostowa lub projektowa) |
| `non-functional-requirements` | [szablon](non-functional-requirements/template.md), [opis](non-functional-requirements/guide.md) | NFR | Wymagania jakościowe systemu lub komponentu |

### Odpowiedzialność

Kto za co odpowiada: role aktorów i komponenty.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `actor` | [szablon](actor/template.md), [opis](actor/guide.md) | ACTOR | Wspólna baza aktorów systemu |
| `capability` | [szablon](capability/template.md), [opis](capability/guide.md) | CAP | Zakres odpowiedzialności komponentu (mapa artefaktów) |

### Scenariusze

Cel aktora i kroki, które do niego prowadzą.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `use-case` | [szablon](use-case/template.md), [opis](use-case/guide.md) | UC | Scenariusz działania użytkownika |
| `technical-use-case` | [szablon](technical-use-case/template.md), [opis](technical-use-case/guide.md) | TUC | Scenariusz działania systemu bez udziału użytkownika (cron, harmonogram, zadanie nocne) |

### Ekrany

To, co użytkownik widzi i wypełnia.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `screen` | [szablon](screen/template.md), [opis](screen/guide.md) | SCR | Opis ekranu z odnośnikami do makiet, z podziałem na sekcje |
| `screen-section` | [szablon](screen-section/template.md), [opis](screen-section/guide.md) | SCRSEC | Szczegółowy opis pól w sekcji ekranu |

### Kontrakty

Format i zasady komunikacji z elementem systemu.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `api` | [szablon](api/template.md), [opis](api/guide.md) | API | Opis jednego punktu końcowego API |
| `integration` | [szablon](integration/template.md), [opis](integration/guide.md) | INT | Integracja z systemem zewnętrznym |
| `event` | [szablon](event/template.md), [opis](event/guide.md) | QUE | Kontrakt zdarzenia publikowanego przez brokera (Kafka, RabbitMQ) |
| `convention` | [szablon](convention/template.md), [opis](convention/guide.md) | CONV | Zasady wspólne dla wielu kontraktów, np. model odpowiedzi błędnej, autentykacja |

### Przepływy

Kolejność kroków i wywołań: przepływ zawiera aktywności, proces silnika zawiera kroki.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `flow` | [szablon](flow/template.md), [opis](flow/guide.md) | FLOW | Przepływ biznesowy lub techniczny |
| `activity` | [szablon](activity/template.md), [opis](activity/guide.md) | ACT | Wydzielony krok przepływu ze złożonym algorytmem |
| `bpmn-process` | [szablon](bpmn-process/template.md), [opis](bpmn-process/guide.md) | BPMN | Mapa procesu w silniku Workflow: orkestracja, nie logika |
| `workflow-step` | [szablon](workflow-step/template.md), [opis](workflow-step/guide.md) | SPEC-WF | Logika pojedynczego zadania BPMN (reguły, zmienne procesowe, kryteria akceptacji) |

### Pojęcia i dane

Co znaczy pojęcie, jak wygląda w danych i jakie ma stany.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `ddm` | [szablon](ddm/template.md), [opis](ddm/guide.md) | DDM | Domenowy model danych (pojęcia biznesowe i relacje) |
| `ldm` | [szablon](ldm/template.md), [opis](ldm/guide.md) | LDM | Logiczny model danych (encje, atrybuty, relacje) |
| `ldm-entity` | [szablon](ldm-entity/template.md), [opis](ldm-entity/guide.md) | ENT | Szczegółowy opis pojedynczej encji |
| `state-machine` | [szablon](state-machine/template.md), [opis](state-machine/guide.md) | STM | Cykl życia obiektu jako maszyna stanów |

### Mapy

Zestawienie cudzych dokumentów: powiązania scenariuszy i przejścia między ekranami.

| Typ | Pliki | Prefiks | Kiedy używać |
|---|---|---|---|
| `use-case-technical-map` | [szablon](use-case-technical-map/template.md), [opis](use-case-technical-map/guide.md) | UCMAP | Mapa relacji UC i TUC z aktorami oraz relacjami include, extend, exclude |
| `navigation-map` | [szablon](navigation-map/template.md), [opis](navigation-map/guide.md) | NAV | Przejścia i połączenia między ekranami procesu |

## Budowa folderu typu

`template.md` zaczyna się front matter dokumentu i zawiera sekcje w kolejności,
w jakiej trafiają do dokumentu. Placeholder w nawiasach klamrowych mówi, co
wpisać: `{Opis kroku}`. Komentarz HTML oznacza regułę sekcji.

`guide.md` ma cztery sekcje:

1. Jakiego artefaktu to szablon?
2. Kiedy analityk powinien go użyć? „Użyj gdy” i „Nie używaj gdy” z odesłaniem do właściwego typu.
3. Co analityk musi wiedzieć, zanim zacznie wypełniać?
4. Warianty.

Nowy typ powstaje jako kopia tego układu: folder z nazwą typu, własny prefiks
`doc-id`, oba pliki i wiersz w spisie treści.

## Wspólne dla dokumentów

| Pole | Zawartość |
|---|---|
| `doc-id` | prefiks typu i numer (`UC-001`), dla encji nazwa (`ENT-Disposition`); unikalny w całej dokumentacji |
| `title` | nazwa dokumentu |
| `description` | krótki opis dokumentu, jedno zdanie |
| `status` | `draft` przy tworzeniu, `active` po akceptacji właściciela dokumentu (`owner`) |
| `owner` | właściciel dokumentu |
| `relations` | relacja do każdego ID wspomnianego w treści ([../methodology.md](../methodology.md), sekcje 1 i 2) |

Wartość zaczynająca się od `{` stoi w cudzysłowie, bo YAML czyta nawias
klamrowy jako mapę.

Historię zmian dokumentu trzyma repozytorium, nie sekcja w dokumencie.

Inwarianty:

- I1: jedno źródło prawdy dla diagramu, bez duplikowania w innej notacji.
- I3: jeden byt to jeden plik: jedno API, jedna operacja integracji, jedno zdarzenie, jedna encja, jedna aktywność, jeden task BPMN, jeden wariant UC lub TUC.
- I7: opis zachowania z perspektywy biznesowej, nie kopia kodu ani kontraktu OpenAPI.
