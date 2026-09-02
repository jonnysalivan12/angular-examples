# Relacje między dokumentami — jak to działa

Wersja do czytania. Wszystko opowiedziane na jednym przykładzie.

---

## Po co to robimy

Chcemy, żeby program (i człowiek) mógł zapytać: „jeśli zmienię to wymaganie, co jeszcze muszę poprawić?" — i dostać listę plików zamiast zgadywać.

Do tego potrzebny jest graf: dokumenty jako węzły, powiązania jako krawędzie. Krawędzie muszą mieć typ i kierunek, inaczej graf nie odpowie na pytanie o zasięg zmiany.

---

## Jedna zasada, z której wynika reszta

> **Dokument mówi, z czego wynika i co zawiera. Nie mówi, kto z niego korzysta.**

Przypadek użycia wie, które wymaganie realizuje — więc to on to zapisuje. Wymaganie nie wie, kto je realizuje — i nie musi. Graf sam policzy drugą stronę.

Skutek: dodajesz nowy przypadek użycia i edytujesz **jeden plik**. Nie musisz dotykać BFS, capability ani aktorów.

---

## Przykład, na którym wszystko pokażemy

Proces: **obsługa dyspozycji klienta**.

| Plik | Co to jest |
|---|---|
| `BFS-003` | wymagania i reguły procesu |
| `NFR-014` | wymagania jakościowe (czas odpowiedzi, dostępność) |
| `ACTOR-002` | baza aktorów, w niej rola `ACTOR-01` = klient |
| `UC-011` | złożenie dyspozycji |
| `UC-012` | korekta dyspozycji |
| `CAP-004` | komponent: przyjmowanie dyspozycji |
| `CAP-005` | komponent: walidacja danych klienta |
| `API-021` | zapis dyspozycji |
| `API-023` | sprawdzenie danych klienta |
| `DDM-004` | co znaczy „dyspozycja" w naszej firmie |
| `LDM-002` | jak dyspozycja wygląda w danych |
| `ENT-Disposition`, `ENT-DispositionItem`, `ENT-Client` | encje |
| `SCR-002` | ekran korekty, w nim sekcja `SCRSEC-004` |

---

## Jak wygląda wpis

W metadanych każdego pliku jest jedno pole `relations`. Lista wpisów, każdy ma typ i cel.

```yaml
# plik UC-012 — korekta dyspozycji
relations:
  - type: realizes
    target: BFS-003.REQ-04      # realizuję wymaganie nr 4 z BFS-003
  - type: realizes
    target: CAP-004             # dotyczę komponentu przyjmowania dyspozycji
  - type: realizes
    target: CAP-005             # i komponentu walidacji
  - type: involves
    target: ACTOR-002.ACTOR-01  # bierze udział klient
```

Stare pola `source-spec-ids` i `related-doc-ids` znikają.

---

## Jedenaście typów relacji

Każdy typ ma jedno znaczenie. Jeśli nie pasuje żaden, to znaczy, że relacji nie ma — nie wybieraj „najbliższego".

### `realizes` — „ja to dostarczam"

Cel obiecuje, ty wykonujesz.

- `UC-012 → BFS-003.REQ-04` — scenariusz realizuje wymaganie
- `CAP-004 → BFS-003.REQ-01` — komponent bierze na siebie wymaganie
- `API-023 → CAP-005` — punkt końcowy należy do komponentu
- `ENT-Disposition → DDM-004.DOM-Dyspozycja` — encja realizuje pojęcie
- `LDM-002 → DDM-004` — model logiczny wynika z domenowego

### `defines` — „to ja wymyśliłem ten identyfikator"

Wymagania, reguły, pojęcia domenowe nie mają własnych plików. Żyją jako wiersze tabel. Żeby graf o nich wiedział, plik-rodzic musi je zgłosić.

```yaml
# plik BFS-003
relations:
  - type: defines
    target: REQ-01
  - type: defines
    target: REQ-02
  - type: defines
    target: RB-01
```

Kto co zgłasza:

| Plik | Zgłasza |
|---|---|
| BFS | `REQ-*`, `RB-*` |
| DDM | `DOM-*`, `RD-*` |
| LDM | `RW-*` |
| NFR | `NFR-PERF-01`, `NFR-SEC-01`… |
| ACTOR | `ACTOR-01`, `ACTOR-02`… |
| SPEC-WF | `AC-*` |
| UC, TUC | `A1`, `E1`… |

### `contains` — „to jest moja część"

Część nie istnieje bez całości.

- `SCR-002 → SCRSEC-004` — ekran zawiera sekcję
- `LDM-002 → ENT-Disposition` — model zawiera encję
- `ENT-Disposition → ENT-DispositionItem` — dyspozycja posiada pozycje
- `FLOW-007 → ACT-003` — przepływ zawiera aktywność
- `BPMN-001 → SPEC-WF-001` — proces zawiera krok

Uwaga: tu wyjątkowo deklaruje **całość**, nie część. Bo to całość wie, z czego się składa.

### `constrained-by` — „muszę się w tym zmieścić"

Ktoś ustalił próg albo podjął decyzję, ty musisz jej przestrzegać.

- `BFS-003 → NFR-014` — proces podlega wymaganiom jakościowym
- `API-021 → NFR-014` — punkt końcowy też
- `API-021 → ADR-006` — punkt końcowy wynika z decyzji architektonicznej

### `uses-data` — „czytam albo zapisuję te dane"

- `API-021 → ENT-Disposition` — punkt końcowy zapisuje dyspozycję
- `SCRSEC-004 → ENT-Client` — sekcja pokazuje dane klienta

### `consumes` — „wołam to i czekam"

Jak cel nie działa, ty też nie.

- `FLOW-007 → API-021` — przepływ wywołuje punkt końcowy
- `SPEC-WF-003 → INT-002` — krok procesu woła integrację
- `CAP-009 → QUE-005` — komponent odbiera zdarzenie

### `used-in` — „jestem wołany w tym scenariuszu"

- `API-023 → UC-012` — punkt końcowy jest używany w korekcie
- `SCR-002 → UC-012` — ekran należy do scenariusza korekty

Dlaczego osobno od `realizes`? Bo „kto za mnie odpowiada" (`CAP-005`) i „gdzie jestem używany" (`UC-012`) to dwa różne pytania. Jeśli zapiszesz tylko jedno, drugiego nie da się wyprowadzić — zwłaszcza gdy scenariusz dotyczy kilku komponentów.

### `involves` — „bierze w tym udział ta rola"

- `UC-011 → ACTOR-002.ACTOR-01` — w składaniu dyspozycji bierze udział klient

### `groups` — „zestawiam cudze dokumenty"

Mapa, spis, widok. Nic własnego nie wnosi.

- `UCMAP-001 → UC-011` — mapa relacji obejmuje scenariusz
- `NAV-003 → SCR-002` — mapa nawigacyjna obejmuje ekran

### `precedes` — „jestem przed tym"

- `SPEC-WF-001 → SPEC-WF-002` — krok walidacji poprzedza krok decyzji

### `supersedes` — „zastępuję starszą decyzję"

- `ADR-014 → ADR-006` — nowa decyzja unieważnia starą

---

## Ściąga: piszę dokument X, co wpisuję?

| Piszę | Wpisuję |
|---|---|
| **BFS** | `defines` → swoje REQ i RB; `constrained-by` → NFR |
| **UC / TUC** | `realizes` → REQ i RB z BFS; `realizes` → CAP; `involves` → role; `defines` → swoje A1, E1 |
| **CAP** | `realizes` → REQ z BFS; `consumes` → QUE, które odbiera |
| **API / INT / QUE** | `realizes` → CAP; `used-in` → UC lub TUC; `uses-data` → ENT; `constrained-by` → NFR, ADR |
| **DDM** | `defines` → swoje DOM i RD |
| **LDM** | `realizes` → DDM; `contains` → swoje ENT; `defines` → swoje RW |
| **ENT** | `realizes` → DOM z DDM; `contains` → encje, które posiada |
| **STM** | `realizes` → DOM z DDM |
| **SCR** | `contains` → swoje SCRSEC; `used-in` → UC lub TUC |
| **SCRSEC** | `uses-data` → ENT |
| **NAV** | `groups` → SCR |
| **UCMAP** | `groups` → UC i TUC |
| **FLOW** | `contains` → ACT; `consumes` → API, INT, QUE |
| **ACT** | nic — deklaruje go FLOW |
| **BPMN** | `contains` → SPEC-WF |
| **SPEC-WF** | `precedes` → następny krok; `consumes` → API, INT, QUE; `defines` → swoje AC |
| **NFR** | `defines` → swoje wiersze |
| **ACTOR** | `defines` → swoje role |
| **ADR** | `supersedes` → starszy ADR |

Dokumenty, które nic nie wpisują o innych (NFR, ACTOR, ADR bez poprzednika, ACT, SCRSEC bez encji) są w porządku — ktoś inny na nie wskazuje.

---

## Jak wskazać wymaganie, a nie cały plik

`REQ-01` jest w każdym BFS. Żeby wskazać konkretne, dodaj nazwę pliku z kropką:

```
BFS-003.REQ-01
DDM-004.DOM-Dyspozycja
ACTOR-002.ACTOR-01
NFR-014.NFR-PERF-01
```

Wewnątrz własnego pliku prefiks pomijasz — `defines` wskazuje samo `REQ-01`.

---

## Trzy rzeczy, których pilnuje walidator

**1. Nic nie wisi w próżni.** Każdy plik i każdy identyfikator musi być połączony z resztą. Kierunek nieważny — sekcja ekranu jest w porządku, bo wskazuje ją ekran. Wyspa dwóch plików wskazujących tylko na siebie to błąd.

**2. Identyfikator w treści = wpis w metadanych.** Jeśli w tekście piszesz „patrz `API-021`", musisz mieć relację do `API-021`. Bez wyjątków. Jeśli nie umiesz nazwać typu relacji, to nie masz czego wspominać.

**3. Cel istnieje.** Relacja do nieistniejącego pliku albo identyfikatora blokuje scalenie.

---

## Co oznacza „zasięg zmiany"

Każdy typ ma oznaczenie, w którą stronę zmiana się rozchodzi:

| Typ | Kierunek | Znaczy |
|---|---|---|
| `realizes`, `constrained-by`, `uses-data`, `consumes`, `involves` | ← | zmiana celu dotyka mnie |
| `defines`, `precedes` | → | moja zmiana dotyka celu |
| `contains`, `used-in` | ↔ | w obie strony |
| `groups`, `supersedes` | brak | to tylko nawigacja |

Przykład: zmieniasz `REQ-04` w `BFS-003`.

1. `BFS-003 → REQ-04` przez `defines` (→) — wymaganie dotknięte
2. `UC-012 → REQ-04` przez `realizes` (←) — scenariusz dotknięty
3. `API-023 → UC-012` przez `used-in` (↔) — punkt końcowy dotknięty
4. `SCR-002 → UC-012` przez `used-in` (↔) — ekran dotknięty

Cztery pliki do przejrzenia. Program to policzy, ty tylko pytasz.

---

## Co robić, gdy zmieniasz wymaganie

Kolejność ma znaczenie.

1. **Najpierw zapytaj graf o zasięg.** Dostaniesz listę plików. To jest zakres twojego zgłoszenia.
2. **Popraw treść we wszystkich wskazanych plikach.**
3. **Dopiero potem usuń relacje i wiersz z tabeli.**

Jeśli zaczniesz od usuwania, graf zapomni, kto z wymagania korzystał, i zostaniesz z zepsutymi scenariuszami bez listy.

Wycofanych wymagań nie trzymamy w dokumencie — historię trzyma git. Ale numeru nigdy nie używamy ponownie: nowe wymaganie dostaje kolejny wolny numer, nawet jeśli w tabeli są dziury.

---

## Kiedy jeden BFS, a kiedy dwa

BFS opisuje **jeden proces**. Proces to coś, co ma jeden początek i jeden koniec.

Test: złożenie dyspozycji → walidacja → może korekta → realizacja. Jeden start, jeden koniec z kilkoma wariantami. **Jeden BFS.**

Kontrprzykład: moduł dyspozycji jako całość. Nie ma jednego startu — złożenie startuje klient, raport miesięczny startuje kalendarz, reklamację startuje inne zdarzenie. **Kilka BFS**, jeden wspólny DDM.

Nie dziel BFS po iteracjach (MVP to sekcja „Poza zakresem"), po ścieżkach (to sekcje w UC), ani po komponentach (to capability).

---

## Ściąga skrótów

| Skrót | Co to |
|---|---|
| BFS | wymagania i reguły jednego procesu |
| UC | scenariusz użytkownika |
| TUC | scenariusz automatyczny (cron, zdarzenie) |
| UCMAP | mapa relacji między UC i TUC |
| ACTOR | baza ról |
| CAP | za co odpowiada komponent |
| NFR | wymagania jakościowe |
| API | punkt końcowy |
| INT | integracja zewnętrzna |
| QUE | zdarzenie z brokera |
| FLOW | przepływ |
| ACT | krok przepływu |
| STM | maszyna stanów |
| DDM | co pojęcia znaczą w firmie |
| LDM | jak pojęcia wyglądają w danych |
| ENT | jedna encja |
| SCR | ekran |
| SCRSEC | sekcja ekranu |
| NAV | mapa ekranów |
| BPMN | proces w silniku |
| SPEC-WF | krok procesu w silniku |
| ADR | decyzja architektoniczna |

| Identyfikator | Co to | Gdzie powstaje |
|---|---|---|
| REQ | wymaganie | BFS |
| RB | reguła biznesowa | BFS |
| DOM | pojęcie domenowe | DDM |
| RD | reguła domenowa | DDM |
| RW | reguła walidacyjna | LDM |
| AC | kryterium akceptacji | SPEC-WF |
| A1, E1 | wariant, błąd | UC, TUC |
| NFR-PERF-01 | wiersz wymagań jakościowych | NFR |
| ACTOR-01 | rola | ACTOR |

