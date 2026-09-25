# Business Functional Spec (BFS)

Szablon do skopiowania: [template.md](template.md).

## 1. Jakiego artefaktu to szablon?

Wymagania funkcjonalne i reguły biznesowe jednego procesu biznesowego.
Odpowiada na pytanie „Co proces musi robić i dlaczego?”. Dokument nadrzędny
wobec przypadków użycia.

## 2. Kiedy analityk powinien go użyć?

**Użyj gdy:**

- startuje projekt i trzeba skatalogować wymagania,
- trzeba zebrać reguły biznesowe przed rozbiciem na przypadki użycia,
- trzeba zgrupować wymagania biznesowe, reguły, wymagania prawne, UX (WCAG), zgodność i wspólny słownik pojęć.

**Nie używaj gdy:**

- opisujesz szczegółowy scenariusz użytkownika → [use-case](../use-case/guide.md).

Powiązane szablony: [use-case](../use-case/guide.md), [non-functional-requirements](../non-functional-requirements/guide.md).

## 3. Co analityk musi wiedzieć, zanim zacznie wypełniać?

- Jeden BFS opisuje jeden proces: jeden start i jeden koniec, koniec może mieć warianty. BFS nie dzieli się po iteracjach, ścieżkach ani komponentach ([methodology.md](../../methodology.md), sekcja 5).
- Wymagania `REQ-{nn}` i reguły `RB-{nn}` to wiersze. Inne dokumenty wskazują je pełnym ID: `UC-001 realizes BFS-001.REQ-01`. Cały BFS nie jest celem relacji.
- BFS nie wymienia scenariuszy. Relację zapisuje UC albo TUC, który realizuje wymaganie: `TUC-017 realizes BFS-010.REQ-01`.
- Numer REQ i RB nie wraca do obiegu. Usunięty wiersz znika z dokumentu, historię trzyma repozytorium.
- Wymaganie niefunkcjonalne wskazujesz wierszem NFR: `BFS-001 constrained_by NFR-001.NFRT-PERF-01`.
- Zmianę albo usunięcie wymagania zaczynasz od zapytania `change_scope` ([methodology.md](../../methodology.md), sekcja 6).

## 4. Warianty

- **BFS dla nowego procesu**: tabela wymagań to zaległości do rozbicia na przypadki użycia.
- **BFS dla istniejącego procesu** (dokumentacja wsteczna): start od reguł biznesowych wydobytych z kodu.
