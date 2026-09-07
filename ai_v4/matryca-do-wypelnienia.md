# Matryca relacji — do wypełnienia

Kierunek propagacji zmiany i liczebność nie są własnością typu relacji.
Są własnością **trójki**: typ źródła + typ relacji + typ celu.

Ta sama relacja `contains` znaczy co innego dla `BFS → REQ` niż dla `SCR → SCRSEC`.
Dlatego każdy wiersz wymaga osobnej decyzji.

---

## Co wpisujemy w kolumny

**A — kierunek propagacji zmiany**

| Wartość | Znaczy |
|---|---|
| `←` | zmiana celu dotyka deklarującego |
| `→` | zmiana deklarującego dotyka celu |
| `↔` | obie strony |
| `–` | krawędź nie przenosi wpływu, służy tylko nawigacji |

Pytanie kontrolne: *jeśli zmienię cel, czy muszę tknąć źródło? Jeśli zmienię źródło, czy muszę tknąć cel?*

**B — liczebność**

`1:1` · `1:N` · `N:1` · `N:N`

Pytanie kontrolne: *ile celów może wskazać jedno źródło i ile źródeł może wskazywać jeden cel?*

---

## Matryca

### Zawieranie wierszy i podrzędnych plików

| # | Źródło | Relacja | Cel | A | B |
|---|---|---|---|---|---|
| 1 | BFS | contains | REQ | | |
| 2 | BFS | contains | RB | | |
| 3 | DDM | contains | DOM | | |
| 4 | DDM | contains | RD | | |
| 5 | LDM | contains | RW | | |
| 6 | LDM | contains | ENT | | |
| 7 | NFR | contains | wiersz NFR | | |
| 8 | ACTOR | contains | rola | | |
| 9 | SPEC-WF | contains | AC | | |
| 10 | UC, TUC | contains | A1, E1 | | |
| 11 | SCR | contains | SCRSEC | | |
| 12 | UC, TUC | contains | SCR | | |
| 13 | FLOW | contains | ACT | | |
| 14 | BPMN | contains | SPEC-WF | | |
| 15 | ENT | contains | ENT | | |

### Realizacja

| # | Źródło | Relacja | Cel | A | B |
|---|---|---|---|---|---|
| 16 | UC, TUC | realizes | BFS.REQ | | |
| 17 | UC, TUC | realizes | BFS.RB | | |
| 18 | UC, TUC | realizes | CAP | | |
| 19 | CAP | realizes | BFS.REQ | | |
| 20 | API | realizes | CAP | | |
| 21 | INT | realizes | CAP | | |
| 22 | QUE | realizes | CAP | | |
| 23 | LDM | realizes | DDM | | |
| 24 | ENT | realizes | DDM.DOM | | |
| 25 | STM | realizes | DDM.DOM | | |
| 26 | FLOW | realizes | ❓ UC czy CAP | | |
| 27 | BPMN | realizes | ❓ BFS.REQ czy CAP | | |

### Wołanie

| # | Źródło | Relacja | Cel | A | B |
|---|---|---|---|---|---|
| 28 | UC, TUC | consumes | API | | |
| 29 | UC, TUC | consumes | INT | | |
| 30 | UC, TUC | consumes | QUE | | |
| 31 | FLOW | consumes | API, INT | | |
| 32 | FLOW | consumes | QUE | | |
| 33 | SPEC-WF | consumes | API, INT | | |
| 34 | SPEC-WF | consumes | QUE | | |
| 35 | CAP | consumes | QUE | | |
| 36 | API | consumes | ENT | | |
| 37 | SCRSEC | consumes | ENT | | |

### Ograniczenia

| # | Źródło | Relacja | Cel | A | B |
|---|---|---|---|---|---|
| 38 | BFS | constrained-by | NFR.wiersz | | |
| 39 | CAP | constrained-by | NFR.wiersz | | |
| 40 | API, INT | constrained-by | NFR.wiersz | | |
| 41 | dowolny | constrained-by | ADR | | |

### Pozostałe

| # | Źródło | Relacja | Cel | A | B |
|---|---|---|---|---|---|
| 42 | UC, TUC | involves | ACTOR.rola | | |
| 43 | UCMAP | groups | UC, TUC | | |
| 44 | NAV | groups | SCR | | |
| 45 | SPEC-WF | precedes | SPEC-WF | | |
| 46 | ACT | precedes | ACT ❓ | | |
| 47 | ADR | supersedes | ADR | | |

---

## Wiersze, w których kolumna A jest sporna

Zaznaczam te, gdzie odpowiedź nie jest oczywista — reszta powinna wypełnić się szybko.

**#1, #2 — BFS zawiera wymaganie.** Zmiana wymagania nie zmienia BFS jako dokumentu, ale zmiana zakresu BFS może usunąć wymaganie. Kandydat: `→` albo `↔`.

**#12 — scenariusz zawiera ekran.** Ekran bywa wspólny dla kilku scenariuszy. Jeśli `↔`, zmiana jednego scenariusza wciągnie ekran, a przez niego wszystkie pozostałe scenariusze. Uwaga na lawinę.

**#15 — encja zawiera encję.** Kompozycja czy zwykłe odwołanie — od tego zależy, czy propagacja idzie w obie strony. Nierozstrzygnięte.

**#28–30 — scenariusz woła punkt końcowy.** W poprzedniej wersji `consumes` miało `←`, ale po usunięciu `used-in` musi być `↔`, inaczej zmiana wymagania zatrzyma się na scenariuszu i nie dotrze do punktu końcowego.

**#36, #37 — punkt końcowy i sekcja czytają encję.** Zmiana encji dotyka czytających. Odwrotnie raczej nie. Kandydat: `←`. Ale jeśli `↔`, popularna encja rozdmucha każdy zakres.

**#43, #44 — mapy.** Poprzednio `–`. Do potwierdzenia.

**#47 — zastąpienie decyzji.** Poprzednio `–`, potem zmienione na `→`, żeby unieważnienie ADR docierało do dokumentów, które go wskazują.

---

## Wiersze, w których kolumna B jest sporna

**#12** — jeden ekran w wielu scenariuszach oznacza `N:N`, nie `1:N`.

**#18** — scenariusz może wskazać kilka capability. `N:N`.

**#23** — jeden LDM wskazuje dokładnie jeden DDM, ale jeden DDM ma wiele LDM. `N:1`.

**#41** — jedna decyzja architektoniczna ogranicza wiele dokumentów, jeden dokument może podlegać kilku decyzjom. `N:N`.

---

## Znaki zapytania do rozstrzygnięcia przed wypełnieniem

| # | Pytanie |
|---|---|
| 26 | czy przepływ realizuje scenariusz, czy zdolność |
| 27 | czy proces silnika wskazuje wymaganie, czy zdolność |
| 46 | czy aktywności mają kolejność, czy wynika ona z diagramu |
| — | czy `STM` wskazuje dodatkowo `ENT`, czy tylko pojęcie |
| — | czy `QUE` odróżnia producenta od odbiorcy |

---

## Jak wypełniać

Nie po kolei. Najpierw grupy, w których odpowiedź jest ta sama dla wszystkich wierszy — zawieranie wierszy (#1–10), realizacja artefaktów (#20–22), ograniczenia (#38–40). Zostaną kandydaci na wyjątki, których jest kilkanaście, i tym warto poświęcić uwagę osobno.

Po wypełnieniu matryca staje się plikiem konfiguracyjnym walidatora i zapytań o zasięg. Wiersz spoza matrycy to błąd scalenia.
