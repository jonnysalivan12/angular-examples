# Standard relacji — ustalenia

Dokument roboczy. Zapisuje decyzje podjęte w toku analizy obecnego standardu dokumentacji.

Rozróżnienie stosowane w całym pliku:

- **stan obecny** — to, co wynika z przeanalizowanych szablonów,
- **ustalenie** — decyzja podjęta przez nas, jeszcze niewdrożona.

---

## Ustalenia

### U-001. Jedno pole `relations` zamiast `source-spec-ids` i `related-doc-ids`

Powiązania zapisujemy w jednym polu, jako listę wpisów typowanych.

```yaml
relations:
  - type: defines
    target: REQ-01
```

### U-002. Zamknięty słownik typów relacji

| Typ | Odwrotność | Propagacja | Znaczenie |
|---|---|---|---|
| `defines` | — | → | dokument jest źródłem identyfikatora lokalnego (patrz U-005) |
| `realizes` | `realized-by` | ← | dokument dostarcza to, co cel obiecuje |
| `constrained-by` | `constrains` | ← | dokument podlega ograniczeniu jakościowemu lub decyzji architektonicznej |
| `uses-data` | `used-by` | ← | dokument czyta lub zapisuje strukturę danych |
| `consumes` | `consumed-by` | ← | dokument wywołuje cudze zachowanie i zależy od jego dostępności |
| `involves` | `involved-in` | ← | dokument angażuje rolę aktora w swoim przebiegu |
| `used-in` | `uses` | ↔ | artefakt jest wołany w przebiegu scenariusza |
| `contains` | `contained-in` | ↔ | dokument zawiera lub posiada inny dokument |
| `groups` | `grouped-by` | brak | dokument zestawia cudze dokumenty w widok, bez treści własnej |
| `precedes` | `follows` | → | następstwo w czasie w obrębie jednego procesu |
| `supersedes` | `superseded-by` | brak | nowsza decyzja unieważnia starszą |

Propagacja wskazuje, w którą stronę zmiana przenosi wpływ:

- ← zmiana celu dotyka deklarującego,
- → zmiana deklarującego dotyka celu,
- ↔ obustronnie,
- brak — krawędź nie przenosi wpływu.

Zapytanie o promień rażenia zmiany przechodzi graf wyłącznie po krawędziach oznaczonych propagacją, w kierunku przez nią wskazanym.

Nowy typ wymaga zmiany w tym dokumencie, nie w szablonach.

### U-003. Każdy dokument i identyfikator jest osiągalny w grafie

Sama obecność krawędzi nie wystarcza — dwa dokumenty wskazujące na siebie nawzajem, odcięte od reszty, tworzą wyspę, do której nie da się dojść.

Warunek poprawności: każdy węzeł jest osiągalny z pozostałej części grafu, przy pominięciu kierunku krawędzi.

Walidator zgłasza węzły bez krawędzi oraz wyspy — spójne składowe odcięte od głównej.

Cel: model językowy ma móc przejść z dowolnego dokumentu do powiązanych, bez przeszukiwania treści.

### U-005. Dokument deklaruje swoje identyfikatory lokalne

Identyfikatory lokalne (`REQ-*`, `RB-*`, `RD-*`, `RW-*`, role aktorów) nie mają własnych plików ani metadanych, więc nie mogą zadeklarować żadnej relacji.

Dokument, w którym powstają, deklaruje je typem `defines`.

BFS deklaruje `REQ-*` i `RB-*`.

```yaml
relations:
  - type: defines
    target: REQ-01
  - type: defines
    target: RB-01
```

Bez tego wpisu graf nie wie o istnieniu tych węzłów.

`defines` nie ma odwrotności — cel relacji nie jest dokumentem.

### U-006. Identyfikator w treści wymaga wpisu w metadanych

Identyfikator innego bytu umieszczony w treści dokumentu musi mieć odpowiadającą relację w polu `relations`. Odwołanie występujące wyłącznie w treści nie jest relacją i graf go nie widzi.

Brak wpisu jest błędem walidacji. Nie ma wyjątku dla wzmianek — identyfikator w treści bez zadeklarowanej relacji nie niesie wartości merytorycznej.

---

### U-007. NFR jest osobnym dokumentem, relacja prowadzi od BFS do NFR

`NFR-{numer}` to `doc-id` osobnego pliku, nie identyfikator lokalny. Identyfikatory wewnątrz tego pliku (`NFR-PERF-01`, `NFR-SEC-01`) są lokalne i NFR deklaruje je typem `defines`.

BFS ma w treści tabelę odwołań do wymagań jakościowych, więc zgodnie z U-006 deklaruje relację do NFR. Kierunek: `BFS → NFR`, typem `constrained-by`.

NFR nie deklaruje relacji do BFS. Jest dokumentem nadrzędnym dla ograniczeń — referują go BFS, capability, przypadki użycia, punkty końcowe i integracje, każdy własnym wpisem.

`constrained-by` jest typem odrębnym od typów opisujących realizację wymagań przez inne dokumenty.

---

### U-008. UC i TUC deklarują udział aktorów, nie odwrotnie

`ACTOR-{numer}` to `doc-id` osobnego pliku — wspólnej bazy aktorów dla wielu procesów. Role wewnątrz pliku (`ACTOR-01`, `ACTOR-02`) są identyfikatorami lokalnymi i dokument deklaruje je typem `defines`.

Relację deklaruje przypadek użycia, wskazując rolę. Kierunek: `UC → ACTOR-01`, typem `involves`.

Dokument aktorów nie deklaruje relacji do przypadków użycia. Dodanie scenariusza to edycja jednego pliku, nie dwóch.

Macierz udziału aktorów w procesach przestaje być treścią pisaną ręcznie — jest wyprowadzalna z grafu.

### U-009. Identyfikator lokalny zapisujemy z prefiksem dokumentu

Odwołanie do identyfikatora lokalnego z innego dokumentu ma postać `{doc-id}.{identyfikator}`.

```yaml
relations:
  - type: realizes
    target: BFS-003.REQ-01
  - type: involves
    target: ACTOR-002.ACTOR-01
```

Wewnątrz dokumentu, w którym identyfikator powstaje, prefiks jest zbędny — `defines` wskazuje samą nazwę.

### U-010. Encja deklaruje relację do encji, którą zawiera lub posiada

Powiązanie między encjami modelu logicznego deklaruje encja źródłowa, typem `contains`.

```yaml
relations:
  - type: contains
    target: ENT-DispositionItem
```

Liczebność i opis biznesowy powiązania pozostają w tabeli „Powiązania" w treści pliku. Metadane niosą samą krawędź.

### U-011. Relację zapisuje wyłącznie dokument deklarujący

Relacja odwrotna nie jest zapisywana w pliku. Wylicza ją graf.

Jeżeli `UC-011` realizuje `BFS-003.REQ-01`, to BFS nie zawiera wpisu wskazującego `UC-011`.

Kolumna „Odwrotność" w U-002 opisuje krawędź wyliczaną, nie wpis do zapisania.

### U-012. Jeden DDM, wiele LDM

Model logiczny wskazuje dokładnie jeden DDM. Jeden DDM może być źródłem dla wielu modeli logicznych.

Relację deklaruje LDM, typem `realizes`.

```yaml
relations:
  - type: realizes
    target: DDM-004
```

### U-013. Ekran deklaruje swoje sekcje

Relację deklaruje ekran, wskazując sekcje, z których się składa.

```yaml
relations:
  - type: contains
    target: SCRSEC-004
  - type: contains
    target: SCRSEC-005
```

Sekcja nie deklaruje relacji do ekranu.

### U-014. UC i TUC deklarują realizowane wymagania

Przypadek użycia wskazuje konkretne wymagania i reguły z BFS, typem `realizes`.

```yaml
relations:
  - type: realizes
    target: BFS-003.REQ-01
  - type: realizes
    target: BFS-003.RB-03
```

### U-015. LDM deklaruje swoje encje

Relację deklaruje model logiczny, wskazując encje, z których się składa, typem `contains`. Jeden LDM zawiera wiele encji.

```yaml
relations:
  - type: contains
    target: ENT-Disposition
  - type: contains
    target: ENT-DispositionItem
```

Encja nie deklaruje relacji do modelu logicznego.

### U-016. Encja deklaruje realizowane pojęcie domenowe

Encja wskazuje pojęcie z DDM, typem `realizes`.

```yaml
relations:
  - type: realizes
    target: DDM-004.DOM-Dyspozycja
```

### U-017. Pozostałe dokumenty deklarują swoje identyfikatory lokalne

Zastosowanie U-005 do pozostałych dokumentów tworzących identyfikatory lokalne.

| Dokument | Deklaruje |
|---|---|
| DDM | `DOM-*`, `RD-*` |
| LDM | `RW-*` |
| SPEC-WF | `AC-*` |
| UC, TUC | `A*`, `E*` |

### U-018. Capability deklaruje BFS, z którego wynika

Zdolność wskazuje wymagania, za które bierze odpowiedzialność, typem `realizes`.

```yaml
relations:
  - type: realizes
    target: BFS-003.REQ-01
```

Capability nie deklaruje relacji do dokumentów, które ją realizują. Zakres odpowiedzialności wylicza graf.

### U-019. Artefakty systemowe deklarują odpowiedzialność i miejsce użycia osobno

Punkt końcowy, integracja i zdarzenie deklarują dwie relacje:

- `realizes` do capability — kto za nie odpowiada,
- `used-in` do UC lub TUC — gdzie są wołane.

Ekran deklaruje samo `used-in` — nie należy do capability.

```yaml
relations:
  - type: realizes
    target: CAP-005
  - type: used-in
    target: UC-012
```

Wyprowadzanie odpowiedzialności przez scenariusz nie działa, gdy scenariusz wskazuje kilka capability, gdy artefakt jest wołany w scenariuszach różnych komponentów albo gdy nie jest jeszcze wołany nigdzie.

Przypadek użycia wskazuje capability, których dotyczy, i może wskazać kilka naraz.

### U-020. Maszyna stanów deklaruje pojęcie, którego cykl życia opisuje

Maszyna stanów wskazuje pojęcie domenowe, typem `realizes`.

```yaml
relations:
  - type: realizes
    target: DDM-004.DOM-Dyspozycja
```

Krawędź do pojęcia działa także wtedy, gdy encja modelu logicznego jeszcze nie istnieje.

### U-021. Pozostałe relacje

| Deklaruje | Cel | Typ |
|---|---|---|
| UC, TUC | CAP | `realizes` |
| API, SCRSEC | ENT | `uses-data` |
| FLOW | ACT | `contains` |
| FLOW | API, INT | `consumes` |
| CAP, FLOW, SPEC-WF | QUE | `consumes` |
| SCR | UC, TUC | `used-in` |
| dowolny dokument objęty decyzją | ADR | `constrained-by` |
| UCMAP | UC, TUC | `groups` |
| NAV | SCR | `groups` |
| BPMN | SPEC-WF | `contains` |
| SPEC-WF | SPEC-WF | `precedes` |
| ADR | ADR | `supersedes` |

---

## Legenda

### Dokumenty

| Skrót | Dokument |
|---|---|
| BFS | specyfikacja funkcjonalna biznesowa — wymagania i reguły jednego procesu |
| UC | przypadek użycia — scenariusz działania użytkownika |
| TUC | techniczny przypadek użycia — scenariusz uruchamiany automatycznie |
| UCMAP | mapa relacji między UC i TUC |
| ACTOR | wspólna baza aktorów |
| DDM | domenowy model danych — znaczenie pojęć |
| LDM | logiczny model danych — indeks obszaru |
| ENT | encja modelu logicznego |
| CAP | zdolność — zakres odpowiedzialności komponentu |
| NFR | wymagania jakościowe |
| API | punkt końcowy |
| INT | integracja z systemem zewnętrznym |
| QUE | kontrakt zdarzenia publikowanego przez brokera |
| FLOW | przepływ biznesowy lub techniczny |
| ACT | pojedyncza aktywność przepływu |
| STM | maszyna stanów |
| SCR | ekran |
| SCRSEC | sekcja ekranu |
| NAV | mapa nawigacyjna ekranów |
| BPMN | proces w silniku Workflow |
| SPEC-WF | krok procesu BPMN |
| ADR | decyzja architektoniczna |

### Identyfikatory lokalne

| Skrót | Znaczenie | Powstaje w |
|---|---|---|
| REQ | wymaganie funkcjonalne | BFS |
| RB | reguła biznesowa | BFS |
| DOM | pojęcie domenowe | DDM |
| RD | reguła i inwariant domenowy | DDM |
| RW | reguła walidacyjna i spójności | LDM |
| AC | kryterium akceptacji | SPEC-WF |
| A1, E1 | wariant przebiegu, sytuacja błędna | UC, TUC |
| NFR-PERF-01 | wiersz macierzy wymagań jakościowych | NFR |
| ACTOR-01 | rola aktora | ACTOR |

